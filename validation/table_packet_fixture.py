"""In-memory byte port for the actual pinned SDK packet handlers. No serial I/O."""
import json
from pathlib import Path
from test_sdk_packets import api,SDKPortHandler
ROOT=Path(__file__).resolve().parents[1]
INVENTORY=json.loads((ROOT/'references/control-items.json').read_text())
CATALOG=json.loads((ROOT/'references/control-tables.json').read_text())
def fixture(catalog_id,firmware=52,protocol=2,baud=57600):
    model=next(m for m in CATALOG['models']if m.get('catalogId')==catalog_id);entry=next(m for m in INVENTORY['models']if m['catalogId']==catalog_id);names={i['name']:i for i in entry['items']};memory={};state={'id':1,'rate':baud,'protocol':protocol,'memory':memory,'frames':[]}
    def put(name,value):
        if name not in names:return
        i=names[name]
        for n,b in enumerate(int(value).to_bytes(i['width'],'little',signed=value<0)):memory[i['address']+n]=b
    def get(name):
        i=names[name];return int.from_bytes(bytes(memory.get(i['address']+n,0)for n in range(i['width'])),'little')
    for name,value in {'Model Number':model['modelNumbers'][0],'Firmware Version':firmware,'ID':1,'Baud Rate':model['bauds'][str(baud)],'Torque Enable':0,'Operating Mode':3,'Drive Mode':0,'Protocol Type':protocol,'Status Return Level':2,'Current Limit':100,'Torque Limit':100,'PWM Limit':1000,'Velocity Limit':1000,'Acceleration Limit':1000,'Max Position Limit':4095,'Min Position Limit':0,'Controller State':0,'Lock':0,'Bus Watchdog':0}.items():put(name,value)
    def physical(address,seen=None):
        seen=set()if seen is None else set(seen)
        if address in seen or len(seen)>=8:raise ValueError('Fixture alias cycle')
        data=next((i for i in entry['items']if i['address']==address and i['name'].startswith('Indirect Data ')),None)
        if not data:return address
        seen.add(address);mapping=names['Indirect Address '+data['name'].removeprefix('Indirect Data ')];destination=int.from_bytes(bytes(memory.get(mapping['address']+n,0)for n in range(mapping['width'])),'little');return physical(destination,seen)
    class Port:
        def __init__(self,name):self.is_open=False;self.is_using=False;self.buffer=[];self.baudrate=baud;self.name=name
        def getCFlagBaud(self,rate):return SDKPortHandler.getCFlagBaud(self,rate)
        def setBaudRate(self,rate):
            if self.getCFlagBaud(rate)<0:return False
            self.baudrate=rate;self.is_open=True;return True
        def setPacketTimeout(self,length):pass
        def setPacketTimeoutMillis(self,timeout):pass
        def isPacketTimeout(self):return not self.buffer
        def closePort(self):self.is_open=False
        def clearPort(self):self.buffer=[]
        def getBytesAvailable(self):return len(self.buffer)
        def readPort(self,length):out=self.buffer[:length];del self.buffer[:length];return out
        def writePort(self,packet):
            state['frames'].append(list(packet));wire=2 if packet[2:4]==[253,0]else 1;device_id=packet[2 if wire==1 else 4];instruction=packet[4 if wire==1 else 7];params=packet[5:-1]if wire==1 else packet[8:-2];data=[]
            if wire!=state['protocol']or device_id!=state['id']or self.baudrate!=state['rate']:return len(packet)
            if instruction==1:
                if wire==2:data=[model['modelNumbers'][0]&255,model['modelNumbers'][0]>>8,firmware]
            elif instruction==2:
                if get('Status Return Level')==0:return len(packet)
                address=params[0]if wire==1 else params[0]|params[1]<<8;size=params[1]if wire==1 else params[2]|params[3]<<8;data=[memory.get(physical(address+n),0)for n in range(size)]
            elif instruction==3:
                address=params[0]if wire==1 else params[0]|params[1]<<8;payload=params[1:]if wire==1 else params[2:];destinations=[physical(address+n)for n in range(len(payload))]
                for a,b in zip(destinations,payload):memory[a]=b
                state['id']=get('ID');state['rate']=next((int(k)for k,v in model['bauds'].items()if v==get('Baud Rate')),state['rate'])
                if 'Protocol Type'in names and get('Protocol Type')in [1,2]:state['protocol']=get('Protocol Type')
                if get('Status Return Level')<2:return len(packet)
            if wire==1:
                response=[255,255,device_id,len(data)+2,0]+data;response.append((~sum(response[2:]))&255)
            else:
                response=[255,255,253,0,device_id,len(data)+4,0,85,0]+data+[0,0];crc=api.Protocol2PacketHandler().updateCRC(0,response,len(response)-2);response[-2:]=[crc&255,crc>>8]
            self.buffer=response;return len(packet)
    return {'model':model,'entry':entry,'names':names,'state':state,'Port':Port,'put':put,'get':get}
