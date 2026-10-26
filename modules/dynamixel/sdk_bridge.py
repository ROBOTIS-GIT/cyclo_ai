"""Private stdio adapter to the pinned official SDK. Not a public raw-write CLI.

Only launched for an explicitly requested product-provider operation.
No port is enumerated/opened on import. Tests use fake ports and packets only.
"""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'sdk-upstream'))

def sdk():
    try:
        import dynamixel_sdk as api
        return api
    except ImportError as e:raise RuntimeError('Official SDK runtime requires local pyserial==3.5; use an isolated environment and CYCLO_PRODUCTS_PYTHON. No global installation is performed.') from e

def raw_ping(handler,port,device_id,protocol):
    """Use SDK packet parsing; P1 presence must not depend on its extra model READ."""
    if protocol not in [1,2] or not 0<=device_id<=252:raise ValueError('Bounded unicast Protocol 1/2 only')
    tx=[0]*(6 if protocol==1 else 10)
    if protocol==1:tx[2]=device_id;tx[3]=2;tx[4]=1
    else:tx[4]=device_id;tx[5]=3;tx[7]=1
    packet,result,error=handler.txRxPacket(port,tx)
    if result==-3001:return None
    if result!=0:raise RuntimeError('Ping communication error: '+handler.getTxRxResult(result))
    actual=packet[2 if protocol==1 else 4]
    if actual!=device_id:raise RuntimeError('Unexpected status responder ID')
    out={'id':actual,'present':True}
    if error:return {**out,'statusError':handler.getRxPacketError(error)}
    if protocol==2:
        if len(packet)<14:raise RuntimeError('Incomplete Protocol 2 Ping identity payload')
        out.update(modelNumber=packet[9]|packet[10]<<8,firmwareVersion=packet[11])
    return out

class Bridge:
    def __init__(self,api):self.api=api;self.port=None;self.handler=None;self.protocol=None;self.bound=None
    def command(self,r):
        op=r['op']
        if op=='ports':
            from serial.tools import list_ports
            return [{'path':p.device,'description':p.description,'serialNumber':p.serial_number} for p in list_ports.comports()]
        if op=='open':
            if self.port is not None:raise ValueError('Close the existing transport first')
            protocol=r['protocol']
            if protocol not in [1,2]:raise ValueError('Explicit Protocol 1 or 2 is required; SDK fallback is prohibited')
            timeout=r.get('timeoutMs',100)
            if not 10<=timeout<=200:raise ValueError('Invalid bounded packet timeout')
            api=self.api
            class BoundedPort(api.PortHandler):
                def setPacketTimeout(self,packet_length):self.setPacketTimeoutMillis(timeout)
            self.port=BoundedPort(r['port']);self.handler=api.PacketHandler(protocol);self.protocol=protocol
            try:
                if not self.port.setBaudRate(r['baud']):raise RuntimeError('Official SDK does not support this host baud')
            except Exception:
                self.close();raise
            return {'opened':True}
        if op=='close':self.close();return {'closed':True}
        if self.port is None:raise ValueError('No open transport')
        if op=='canBaud':return self.port.getCFlagBaud(r['baud'])>0
        if op in ['ping','probe']:return raw_ping(self.handler,self.port,r['id'],self.protocol)
        if op=='read':return self.read(r['id'],r['address'],r['size'])
        if op=='bind':
            catalog=json.loads((Path(__file__).resolve().parents[2]/'references/control-tables.json').read_text())
            m=next((m for m in catalog['models'] if m['catalogId']==r['catalogId'] and m['kind']=='actuator'),None)
            if not m or self.protocol not in m['protocols'] or r['model'] not in m['modelNumbers']:raise ValueError('Invalid source-bound identity')
            if m['dualAxis'] and (len(r.get('peerIds',[]))!=1 or r['id'] in r.get('peerIds',[])):raise ValueError('Distinct dual-axis peer cohort is required')
            for device_id in [r['id']]+r.get('peerIds',[]):
                if not raw_ping(self.handler,self.port,device_id,self.protocol):raise RuntimeError('Identity disappeared before binding')
                model=int.from_bytes(bytes(self.read(device_id,0,2)),'little');fw=m['registers']['Firmware Version']
                firmware=int.from_bytes(bytes(self.read(device_id,fw['address'],fw['width'])),'little')
                if model!=r['model'] or firmware!=r['firmware']:raise ValueError('Binding identity mismatch')
            self.bound=(m,r);return {'bound':True}
        if op=='write':
            self.validate_write(r)
            result,error=self.handler.writeTxRx(self.port,r['id'],r['address'],len(r['data']),r['data'])
            self.check(result,error);return {'acknowledged':True}
        raise ValueError('Unsupported bridge operation; use a source-bound item, not an arbitrary protocol command')
    def read(self,device_id,address,size):
        if not 0<=device_id<=252 or not 1<=size<=1024 or not 0<=address<=65536-size or self.protocol==1 and address+size>256:raise ValueError('Invalid bounded register read')
        data,result,error=self.handler.readTxRx(self.port,device_id,address,size);self.check(result,error)
        if len(data)!=size:raise RuntimeError('Unexpected register read width')
        return data
    def check(self,result,error):
        if result!=0:raise RuntimeError(self.handler.getTxRxResult(result))
        if error:raise RuntimeError('Device status error: '+self.handler.getRxPacketError(error))
    def validate_write(self,r):
        if not self.bound:raise ValueError('No verified source-bound configuration target')
        m,b=self.bound;ids=[b['id']]+b.get('peerIds',[])
        if r['id'] not in ids:raise ValueError('Write target changed without re-identification')
        if b.get('tableItem'):
            if r['id']!=b['id']:raise ValueError('Generic item write must address the selected primary target; peer IDs are preconditions only')
            return self.validate_table_write(r,m,b)
        allowed=set()
        for op,c in m['capabilities'].items():
            if c['status']!='resolved':continue
            allowed.update(c.get('channels',[]));allowed.update(c.get('registers',[]))
            if c.get('register'):allowed.add(c['register'])
            # Legacy named grants exclude mode fields; generic items use canonical rules above.
        matches=[(name,reg) for name,reg in m['registers'].items() if name in allowed and reg['address']==r['address'] and reg['width']==len(r['data']) and reg['access']=='RW']
        if len(matches)!=1 or any(not isinstance(x,int) or not 0<=x<=255 for x in r['data']):raise ValueError('Write is not a typed named configuration capability')
        name,reg=matches[0];value=int.from_bytes(bytes(r['data']),'little')
        if reg['range'] and not reg['range'][0]<=value<=reg['range'][1]:raise ValueError('Value outside source range')
        if name=='ID' and not 0<=value<=252:raise ValueError('Invalid unicast ID')
        if name=='Baud Rate':
            rates=[int(k) for k,v in m['bauds'].items() if v==value]
            if len(rates)!=1 or self.port.getCFlagBaud(rates[0])<=0:raise ValueError('Destination baud unavailable in official SDK')
        if name.startswith('LED') and value>255:raise ValueError('Invalid LED value')
        torque=m['registers']['Torque Enable']
        if m['dualAxis'] and len(b.get('peerIds',[]))!=1:raise ValueError('Both axes must be bound')
        for device_id in ids:
            fields={'Model Number':b['model'],'Firmware Version':b['firmware'],'ID':device_id,'Protocol Type':self.protocol,'Baud Rate':m['bauds'].get(str(self.port.baudrate))}
            for key,expected in fields.items():
                reg=m['registers'].get(key)
                if reg and int.from_bytes(bytes(self.read(device_id,reg['address'],reg['width'])),'little')!=expected:raise ValueError('Bound axis identity/protocol/baud changed')
            shadow=m['registers'].get('Secondary(Shadow) ID')
            if shadow and int.from_bytes(bytes(self.read(device_id,shadow['address'],shadow['width'])),'little')<253:raise ValueError('Active secondary ID on a bound axis')
            if int.from_bytes(bytes(self.read(device_id,torque['address'],torque['width'])),'little')!=0:raise ValueError('Torque must already be off on every bound axis')
    def validate_table_write(self,r,m,b):
        inventory=json.loads((Path(__file__).resolve().parents[2]/'references/control-items.json').read_text())
        entry=next((e for e in inventory['models'] if e['catalogId']==m['catalogId']),None)
        item=next((i for i in entry['items'] if i['key']==b['tableItem']),None) if entry else None
        if not item or item['access']!='RW' or item['write']['status']!='resolved' or item['write']['kind']!='direct':raise ValueError('Item semantics are not source-resolved for direct writes')
        rule=item['write'];data=r['data']
        if r['address']!=item['address'] or len(data)!=item['width'] or any(type(x)!=int or not 0<=x<=255 for x in data):raise ValueError('Typed item address/width/data mismatch')
        value=int.from_bytes(bytes(data),'little',signed=rule['encoding']=='twos-complement')
        if rule.get('values') is not None and value not in rule['values']:raise ValueError('Undocumented item enum/sentinel')
        if rule.get('bounds') and not rule['bounds'][0]<=value<=rule['bounds'][1]:raise ValueError('Item value outside source bounds')
        if b['firmware']<rule.get('minimumFirmware',0):raise ValueError('Unsupported item firmware')
        def read(name,device_id=b['id']):
            rows=[i for i in entry['items'] if i['name']==name and i['readStatus']=='resolved-raw']
            if len(rows)!=1:raise ValueError('Precondition item source is ambiguous')
            row=rows[0];return int.from_bytes(bytes(self.read(device_id,row['address'],row['width'])),'little',signed=row['encoding']=='twos-complement')
        for name,expected in {'Model Number':b['model'],'Firmware Version':b['firmware'],'ID':b['id'],'Protocol Type':self.protocol,'Baud Rate':m['bauds'].get(str(self.port.baudrate))}.items():
            if name in m['registers'] and read(name)!=expected:raise ValueError('Bound identity/protocol/rate changed')
        if rule.get('requiresTorqueOff'):
            ids=[b['id']]+b.get('peerIds',[])
            if m['dualAxis'] and len(ids)!=2:raise ValueError('Required dual-axis cohort is missing')
            for device_id in ids:
                if read('Torque Enable',device_id)!=0:raise ValueError('EEPROM/item requires torque already off')
            if 'Lock' in m['registers'] and read('Lock')!=0:raise ValueError('EEPROM lock is active')
        if rule.get('requiresMode'):
            mode=read('Operating Mode')
            if mode not in rule['modes']:raise ValueError('Item not applicable in observed mode')
            if rule.get('modeBounds'):
                bounds=rule['modeBounds'][str(mode)];lo=read(bounds['minItem']) if 'minItem' in bounds else bounds['min'];hi=read(bounds['maxItem']) if 'maxItem' in bounds else bounds['max']
                if not lo<=value<=hi:raise ValueError('Goal outside mode-specific bounds')
        if rule.get('dynamicLimit') and abs(value)>read(rule['dynamicLimit']):raise ValueError('Goal exceeds observed limit')
        for name,bits in rule.get('forbiddenBits',{}).items():
            if read(name)&bits:raise ValueError('Control bits would enable torque implicitly')
        for name,states in rule.get('forbiddenStates',{}).items():
            if read(name) in states:raise ValueError('Controller state prevents item write')

    def close(self):
        old=self.port;self.port=None;self.bound=None
        if old is not None and old.is_open:old.closePort()

def main():
    import os
    if os.environ.get('CYCLO_PRODUCTS_ENABLE_HARDWARE')!='1':raise RuntimeError('Hardware bridge disabled; no serial import, discovery or port access occurred')
    bridge=Bridge(sdk())
    try:
        for line in sys.stdin:
            try:
                if len(line)>65536:raise ValueError('Bridge request exceeds bound')
                request=json.loads(line);result=bridge.command(request);print(json.dumps({'ok':True,'result':result}),flush=True)
            except Exception as e:print(json.dumps({'ok':False,'error':str(e)}),flush=True)
    finally:bridge.close()
if __name__=='__main__':main()
