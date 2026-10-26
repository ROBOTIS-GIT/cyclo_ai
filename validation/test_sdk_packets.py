"""Real pinned SDK parsers over an in-memory byte port. No serial dependency/I/O."""
import importlib.util,sys,types,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
serial=types.ModuleType('serial')
def prohibited(*args,**kwargs):raise AssertionError('Real serial access prohibited in offline packet tests')
serial.Serial=prohibited;sys.modules['serial']=serial
spec=importlib.util.spec_from_file_location('bridge',ROOT/'modules/dynamixel/sdk_bridge.py')
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
api=bridge.sdk()
SDKPortHandler=api.PortHandler

class FakePort:
    def __init__(self,name='MOCK'):
        self.is_open=False;self.is_using=False;self.buffer=[];self.sent=[];self.error=0;self.corrupt=False;self.deny_read=False;self.protocol=2;self.baudrate=57600
        self.model=350;self.firmware=42;self.values={0:[94,1],2:[42],3:[1],4:[1],24:[0],25:[0]}
    def getCFlagBaud(self,baud):return SDKPortHandler.getCFlagBaud(self,baud)
    def setBaudRate(self,baud):
        if self.getCFlagBaud(baud)<0:return False
        self.baudrate=baud;self.is_open=True;return True
    def setPacketTimeout(self,length):pass
    def setPacketTimeoutMillis(self,timeout):pass
    def isPacketTimeout(self):return not self.buffer
    def closePort(self):self.is_open=False
    def clearPort(self):self.buffer=[]
    def getBytesAvailable(self):return len(self.buffer)
    def readPort(self,length):out=self.buffer[:length];del self.buffer[:length];return out
    def writePort(self,packet):
        self.sent.append(list(packet));wire=2 if packet[2:4]==[253,0]else 1;self.protocol=wire
        device_id=packet[2 if wire==1 else 4];instruction=packet[4 if wire==1 else 7]
        params=packet[5:-1] if wire==1 else packet[8:-2];data=[]
        if instruction==1 and wire==2:data=[self.model&255,self.model>>8,self.firmware]
        elif instruction==2:
            if self.deny_read:return len(packet)
            address=params[0] if wire==1 else params[0]|params[1]<<8
            size=params[1] if wire==1 else params[2]|params[3]<<8;data=self.values.get(address,[0]*size)[:size]
        elif instruction==3:
            address=params[0] if wire==1 else params[0]|params[1]<<8;self.values[address]=params[1:] if wire==1 else params[2:]
        if wire==1:
            response=[255,255,device_id,len(data)+2,self.error]+data;response.append((~sum(response[2:]))&255)
        else:
            response=[255,255,253,0,device_id,len(data)+4,0,85,self.error]+data+[0,0]
            crc=api.Protocol2PacketHandler().updateCRC(0,response,len(response)-2);response[-2:]=[crc&255,crc>>8]
        if self.corrupt:response[-1]^=1
        self.buffer=response;return len(packet)

class Packets(unittest.TestCase):
    def test_protocol1_ping_is_presence_only_and_no_hidden_model_read(self):
        p=FakePort();h=api.PacketHandler(1);p.deny_read=True
        self.assertEqual(bridge.raw_ping(h,p,1,1),{'id':1,'present':True});self.assertEqual(len(p.sent),1);self.assertEqual(p.sent[0],[255,255,1,2,1,251])
        _,result,_=h.ping(p,1);self.assertNotEqual(result,0)
    def test_protocol2_ping_retains_payload_firmware_and_model(self):
        p=FakePort();h=api.PacketHandler(2);r=bridge.raw_ping(h,p,1,2)
        self.assertEqual(r['modelNumber'],350);self.assertEqual(r['firmwareVersion'],42);self.assertEqual(p.sent[0][:8],[255,255,253,0,1,3,0,1])
    def test_both_protocols_read_write_endian_packets_without_serial(self):
        for protocol in [1,2]:
            p=FakePort();h=api.PacketHandler(protocol)
            data,result,error=h.readTxRx(p,1,0,2);self.assertEqual((data,result,error),([94,1],0,0))
            result,error=h.writeTxRx(p,1,25,1,[1]);self.assertEqual((result,error),(0,0));self.assertEqual(p.values[25],[1])
    def test_bad_checksum_crc_and_error_status_are_not_absence(self):
        for protocol in [1,2]:
            p=FakePort();p.corrupt=True
            with self.assertRaisesRegex(RuntimeError,'communication'):bridge.raw_ping(api.PacketHandler(protocol),p,1,protocol)
            p=FakePort();p.error=4
            r=bridge.raw_ping(api.PacketHandler(protocol),p,1,protocol);self.assertTrue(r['present']);self.assertIn('statusError',r)
    def test_unknown_protocol_broadcast_and_backend_rate_bounds(self):
        p=FakePort()
        with self.assertRaises(ValueError):bridge.raw_ping(api.PacketHandler(2),p,254,2)
        with self.assertRaises(ValueError):bridge.raw_ping(api.PacketHandler(2),p,1,3)
        for rate in [4500000,6000000,10500000,250000,400000]:self.assertEqual(p.getCFlagBaud(rate),-1)
        self.assertGreater(p.getCFlagBaud(1000000),0)
        _,result=api.PacketHandler(1).broadcastPing(p);self.assertEqual(result,api.COMM_NOT_AVAILABLE)
    def test_bridge_named_write_requires_bound_metadata_and_rejects_motion(self):
        mock=types.SimpleNamespace(PortHandler=FakePort,PacketHandler=api.PacketHandler)
        b=bridge.Bridge(mock);b.command({'op':'open','port':'MOCK','baud':57600,'protocol':2});b.port.protocol=2
        with self.assertRaisesRegex(ValueError,'source-bound'):b.command({'op':'write','id':1,'address':25,'data':[1]})
        b.command({'op':'bind','catalogId':'x_series/xl_series/xl320','model':350,'firmware':42,'id':1})
        b.command({'op':'write','id':1,'address':25,'data':[1]});self.assertEqual(b.port.values[25],[1])
        for address in [24,30,11]:
            with self.assertRaises(ValueError):b.command({'op':'write','id':1,'address':address,'data':[1]})
        b.close();self.assertIsNone(b.port)

if __name__=='__main__':unittest.main()
