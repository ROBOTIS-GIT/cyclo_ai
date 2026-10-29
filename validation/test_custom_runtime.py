import copy, importlib.util, json, os, socket, tempfile, threading, types, unittest
from pathlib import Path
from unittest.mock import patch
from custom_fixture import profile
from test_sdk_packets import bridge, api, FakePort, SDKPortHandler
from custom_tables import load_custom
from transports import port_class

class Custom(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.path,self.entry=profile(self.tmp.name)
    def save(self,entry):self.path.write_text(json.dumps({'schemaVersion':1,'models':[entry]}))
    def test_normalizes_external_registers_and_retains_signed_scale(self):
        result=load_custom(self.path);m=result['models'][0];items=result['itemModels'][0]['items']
        self.assertEqual(m['modelNumbers'],[65000]);self.assertEqual(m['registers']['Torque Enable']['address'],512)
        self.assertEqual(m['capabilities']['id']['status'],'resolved');self.assertEqual(len(m['customHash']),64)
        self.assertEqual(items[-1]['encoding'],'twos-complement');self.assertEqual(items[-1]['scale'],.0054931640625)
    def test_source_hash_and_schema_fail_before_any_io(self):
        Path(self.entry['source']['path']).write_text('changed')
        with self.assertRaisesRegex(ValueError,'hash mismatch'):load_custom(self.path)
    def test_invalid_contracts_never_silently_grant_writes(self):
        changes=[lambda e:e.update(catalogId='x_series/fake'),lambda e:e.update(firmwares=[]),
                 lambda e:e['items'][2]['write'].update(unknownCondition=True),
                 lambda e:e['items'][2]['write'].update(requiresTorqueOff=False),
                 lambda e:e['items'][2]['write'].update(bounds=[0,254]),
                 lambda e:e['items'][2].update(access='R'),
                 lambda e:e['items'][2]['write'].update(requiresItems={'Absent':[0]}),
                 lambda e:e['items'][3].update(address=7)]
        for change in changes:
            with self.subTest(change=change):
                e=copy.deepcopy(self.entry);change(e);self.save(e)
                with self.assertRaises(ValueError):load_custom(self.path)
    def motor(self):
        with patch.dict(os.environ,{'CYCLO_PRODUCTS_CUSTOM_TABLES':str(self.path)}):b=bridge.Bridge(api)
        p=FakePort();p.model=65000;p.firmware=6;p.baudrate=6000000
        p.values.update({0:[232,253],6:[6],7:[2],8:[8],512:[0],552:[246,255,255,255]})
        b.port=p;b.handler=api.PacketHandler(2);b.protocol=2
        binding=dict(op='bind',catalogId='custom/synthetic',model=65000,firmware=6,id=2,tableHash=b.custom['models'][0]['customHash'])
        return b,p,binding
    def test_actual_public_sdk_bridge_signed_read_and_write_and_torque_guard(self):
        b,p,binding=self.motor();b.command({**binding,'tableItem':'Homing Offset@52'})
        b.command(dict(op='write',id=2,address=52,data=[79,254,255,255]))
        self.assertEqual(int.from_bytes(bytes(b.read(2,52,4)),'little',signed=True),-433)
        p.values[512]=[1]
        with self.assertRaisesRegex(ValueError,'torque'):b.command(dict(op='write',id=2,address=52,data=[0,0,0,0]))
        self.assertEqual(p.values[52],[79,254,255,255])
    def test_named_custom_writes_also_apply_reviewed_conditions(self):
        b,p,binding=self.motor();b.command(binding);p.values[512]=[1]
        with self.assertRaisesRegex(ValueError,'torque'):b.command(dict(op='write',id=2,address=7,data=[5]))
    def test_changed_hash_firmware_or_readonly_item_is_rejected(self):
        b,p,binding=self.motor()
        for extra in [{'tableHash':'0'*64},{'firmware':7}]:
            with self.assertRaisesRegex(ValueError,'hash/firmware'):b.command({**binding,**extra})
        b.command({**binding,'tableItem':'Present Position@552'})
        with self.assertRaisesRegex(ValueError,'source-resolved'):b.command(dict(op='write',id=2,address=552,data=[0]*4))
    def test_xml_import_requires_review_for_signed_and_write_semantics(self):
        spec=importlib.util.spec_from_file_location('xml_import',Path(__file__).resolve().parents[1]/'scripts/import_control_table.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        xml=Path(self.tmp.name)/'table.xml';xml.write_text('<Table><Item Name="Offset" Address="52" Length="4" Memory="1" RW="3" Min="-1000" Sign="2147483647"/></Table>')
        args=dict(catalog_id='custom/xml',name='Fixture',model=65000,firmwares=[6],protocol=2,bauds={'6000000':8},review={})
        row=module.convert(xml,**args)['models'][0]['items'][0]
        self.assertEqual(row['encoding'],'unresolved');self.assertNotIn('write',row)
        xml.write_text('<!DOCTYPE Table [<!ENTITY x "bad">]><Table/>')
        with self.assertRaisesRegex(ValueError,'DTD/entities'):module.convert(xml,**args)
    def test_xml_sequences_aliases_and_source_range_are_preserved(self):
        spec=importlib.util.spec_from_file_location('xml_sequences',Path(__file__).resolve().parents[1]/'scripts/import_control_table.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        xml=Path(self.tmp.name)/'table.xml'
        xml.write_text('<Device ModelNumber="65000"><ControlItems><Item Name="Baud Rate (Bus)" Address="12" Length="1" Memory="1" RW="3" Min="0" Max="8"/><Category Name="History"><Item Name="{0}" Address="100" Length="2" Memory="2" RW="1" Continue="1~3"/></Category><Item Name="Position" Address="200" Length="4" Memory="2" RW="1" Min="addr20"/></ControlItems></Device>')
        args=dict(catalog_id='custom/xml',name='Fixture',model=65000,firmwares=[6],protocol=2,bauds={'6000000':8},review={'Baud Rate (Bus)':{'canonicalName':'Baud Rate'}})
        rows=module.convert(xml,**args)['models'][0]['items']
        self.assertEqual([r['name']for r in rows],['Baud Rate','History 1','History 2','History 3','Position'])
        self.assertEqual([r['address']for r in rows[1:4]],[100,102,104]);self.assertEqual(rows[-1]['encoding'],'unresolved')
        with self.assertRaisesRegex(ValueError,'model number'):module.convert(xml,**{**args,'model':65001})
        args['review']['Baud Rate (Bus)']['write']={'status':'resolved','bounds':[0,9]}
        with self.assertRaisesRegex(ValueError,'source range'):module.convert(xml,**args)

class Transport(unittest.TestCase):
    def test_sync_read_uses_official_instruction_and_retains_each_status_error(self):
        class BatchPort(FakePort):
            def writePort(self,packet):
                if packet[7]!=130:return super().writePort(packet)
                self.sent.append(list(packet));self.buffer=[]
                address=packet[8]|packet[9]<<8;size=packet[10]|packet[11]<<8
                for device_id in packet[12:-2]:
                    data=list((-433 if device_id==5 else 433).to_bytes(size,'little',signed=True))
                    response=[255,255,253,0,device_id,len(data)+4,0,85,self.error]+data+[0,0]
                    crc=api.Protocol2PacketHandler().updateCRC(0,response,len(response)-2);response[-2:]=[crc&255,crc>>8];self.buffer.extend(response)
                return len(packet)
        b=bridge.Bridge(api);p=BatchPort();b.port=p;b.handler=api.PacketHandler(2);b.protocol=2
        r=b.command(dict(op='syncRead',ids=[2,5],address=52,size=4))
        self.assertEqual([int.from_bytes(bytes(x['bytes']),'little',signed=True)for x in r],[433,-433]);self.assertEqual(len(p.sent),1);self.assertEqual(p.sent[0][7],130)
        p.error=4
        with self.assertRaises(bridge.DeviceStatusError):b.command(dict(op='syncRead',ids=[2,5],address=52,size=4))
        for request in [dict(ids=[2,2],address=52,size=4),dict(ids=[254],address=52,size=4),dict(ids=[2],address=65535,size=4)]:
            with self.assertRaises(ValueError):b.command(dict(op='syncRead',**request))
    def test_native_high_baud_adapter_keeps_public_sdk_unmodified(self):
        port=port_class(api,'/MOCK')('/MOCK')
        for rate in [4500000,6000000,10500000]:
            self.assertEqual(port.getCFlagBaud(rate),rate);self.assertEqual(SDKPortHandler.getCFlagBaud(port,rate),-1)
        self.assertEqual(port.getCFlagBaud(123456),-1)
    def test_os_baud_rejection_closes_transport_before_any_packet(self):
        port=port_class(api,'/MOCK')('/MOCK')
        with patch.object(__import__('sys').modules['serial'],'EIGHTBITS',8,create=True):
            with self.assertRaisesRegex(AssertionError,'prohibited'):port.setBaudRate(6000000)
        self.assertFalse(port.is_open)
    def test_loopback_tcp_and_udp_use_public_packet_parser(self):
        for kind in [socket.SOCK_STREAM,socket.SOCK_DGRAM]:
            with self.subTest(kind=kind):
                server=socket.socket(socket.AF_INET,kind);server.bind(('127.0.0.1',0));server.settimeout(2)
                if kind==socket.SOCK_STREAM:server.listen(1)
                errors=[]
                def peer():
                    connection=None
                    try:
                        if kind==socket.SOCK_STREAM:
                            connection,_=server.accept();connection.settimeout(2);request=connection.recv(1024)
                        else:request,address=server.recvfrom(1024)
                        fake=FakePort();fake.writePort(list(request));response=bytes(fake.buffer)
                        if kind==socket.SOCK_STREAM:connection.sendall(response)
                        else:server.sendto(response,address)
                    except Exception as e:errors.append(e)
                    finally:
                        if connection:connection.close()
                thread=threading.Thread(target=peer);thread.start()
                scheme='tcp'if kind==socket.SOCK_STREAM else'udp';endpoint=f'{scheme}://127.0.0.1:{server.getsockname()[1]}'
                b=bridge.Bridge(api)
                try:
                    b.command(dict(op='open',port=endpoint,baud=6000000,timeoutMs=100,protocol=2))
                    self.assertEqual(b.command(dict(op='ping',id=1))['modelNumber'],350)
                finally:b.close();thread.join(3);server.close()
                self.assertFalse(thread.is_alive());self.assertEqual(errors,[])

if __name__=='__main__':unittest.main()
