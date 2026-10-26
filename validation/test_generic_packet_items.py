"""Canonical Control Table writes through the actual SDK over a fake byte port."""
import unittest
from test_sdk_packets import bridge,api
from table_packet_fixture import fixture
class GenericPackets(unittest.TestCase):
    def motor(self,catalog_id='x_series/xm_series/xm430-w350',protocol=2):
        f=fixture(catalog_id,protocol=protocol);old=api.PortHandler;api.PortHandler=f['Port'];self.addCleanup(setattr,api,'PortHandler',old);b=bridge.Bridge(api);b.command({'op':'open','port':'/MOCK-NOT-SERIAL','baud':57600,'timeoutMs':30,'protocol':protocol});self.addCleanup(b.close);return b,f
    def bind(self,b,f,name,**extra):
        i=f['names'][name];b.command({'op':'bind','catalogId':f['model']['catalogId'],'model':f['model']['modelNumbers'][0],'firmware':52,'id':1,'tableItem':i['key'],**extra});return i
    def test_every_family_uses_real_sdk_packets_and_same_descriptor_engine(self):
        models=[('ax_series/ax-12a',1),('dx_series/dx-113',1),('ex_series/ex-106+',1),('mx_series/mx-28-2',2),('p_series/ph42-020-s300-r',2),('pro_series/pro_h_series/h42-20-s300-r',2),('rx_series/rx-10',1),('x_series/xm_series/xm430-w350',2),('y_series/ym070-210-a051-rh',2)]
        for catalog_id,protocol in models:
            with self.subTest(catalog_id):
                b,f=self.motor(catalog_id,protocol);i=self.bind(b,f,'Return Delay Time');b.command({'op':'write','id':1,'address':i['address'],'data':[100]});self.assertEqual(f['get']('Return Delay Time'),100)
    def test_negative_signed_current_is_encoded_and_bounded(self):
        b,f=self.motor();f['put']('Torque Enable',1);i=self.bind(b,f,'Goal Current');b.command({'op':'write','id':1,'address':i['address'],'data':[246,255]});self.assertEqual(f['get']('Goal Current'),65526)
        with self.assertRaisesRegex(ValueError,'bounds'):b.command({'op':'write','id':1,'address':i['address'],'data':[155,255]})
    def test_complete_multibyte_alias_and_binding_continuity(self):
        b,f=self.motor();proof=[]
        for n in range(1,5):f['put']('Indirect Address '+str(n),115+n);proof.append({'item':f['names']['Indirect Address '+str(n)]['key'],'value':115+n})
        self.bind(b,f,'Indirect Data 2',expectedEffectiveItem=f['names']['Goal Position']['key'],expectedAliasMappings=proof);b.command({'op':'write','id':1,'address':224,'data':[0,4,0,0]});self.assertEqual(f['get']('Goal Position'),1024)
        f['put']('Indirect Address 1',65)
        with self.assertRaisesRegex(ValueError,'group|changed'):b.command({'op':'write','id':1,'address':224,'data':[0,4,0,0]})
    def test_alias_readonly_and_cycles_never_grant_raw_writes(self):
        b,f=self.motor();proof=[]
        for n in range(1,5):f['put']('Indirect Address '+str(n),131+n);proof.append({'item':f['names']['Indirect Address '+str(n)]['key'],'value':131+n})
        self.bind(b,f,'Indirect Data 1',expectedEffectiveItem=f['names']['Present Position']['key'],expectedAliasMappings=proof)
        with self.assertRaisesRegex(ValueError,'read-only'):b.command({'op':'write','id':1,'address':224,'data':[0,0,0,0]})
        f['put']('Indirect Address 1',224)
        with self.assertRaisesRegex(ValueError,'cycle'):b.command({'op':'write','id':1,'address':224,'data':[0]})
    def test_documented_no_reply_policy_and_protocol2_restore(self):
        b,f=self.motor();i=self.bind(b,f,'Status Return Level');b.command({'op':'write','id':1,'address':i['address'],'data':[1],'expectStatus':False});self.assertEqual(b.command({'op':'read','id':1,'address':i['address'],'size':1}),[1])
        led=self.bind(b,f,'LED');b.command({'op':'write','id':1,'address':led['address'],'data':[1],'expectStatus':False});self.assertEqual(f['get']('LED'),1)
        i=self.bind(b,f,'Status Return Level');b.command({'op':'write','id':1,'address':i['address'],'data':[0],'expectStatus':False})
        with self.assertRaises(bridge.CommunicationError):b.command({'op':'read','id':1,'address':i['address'],'size':1})
        self.bind(b,f,'Status Return Level',identityMode='ping-payload');b.command({'op':'write','id':1,'address':i['address'],'data':[2],'expectStatus':False});self.assertEqual(b.command({'op':'read','id':1,'address':i['address'],'size':1}),[2])
    def test_protocol2_to_protocol1_keeps_same_model_generation(self):
        b,f=self.motor();i=self.bind(b,f,'Protocol Type');b.command({'op':'write','id':1,'address':i['address'],'data':[1],'expectStatus':False});b.command({'op':'close'});b.command({'op':'open','port':'/MOCK-NOT-SERIAL','baud':57600,'timeoutMs':30,'protocol':1});self.bind(b,f,'LED');self.assertEqual(b.command({'op':'read','id':1,'address':0,'size':2}),[252,3])
    def test_legacy_id253_is_not_confused_with_protocol2_header(self):
        b,f=self.motor('ax_series/ax-12a',1);i=self.bind(b,f,'ID');b.command({'op':'write','id':1,'address':i['address'],'data':[253]});self.assertEqual(b.command({'op':'probe','id':253})['id'],253);self.assertEqual(b.command({'op':'read','id':253,'address':0,'size':2}),[12,0])
    def test_y_sixteen_bit_watchdog_state_is_not_truncated(self):
        b,f=self.motor('y_series/ym070-210-a051-rh',2);f['put']('Bus Watchdog',65535);i=self.bind(b,f,'Goal Current')
        with self.assertRaisesRegex(ValueError,'read-only'):b.command({'op':'write','id':1,'address':i['address'],'data':[0,0]})
    def test_only_two_genuine_manufacturer_write_contracts_remain_unknown(self):
        b,f=self.motor('mx_series/mx-64',1);i=self.bind(b,f,'Current')
        with self.assertRaisesRegex(ValueError,'source-resolved'):b.command({'op':'write','id':1,'address':i['address'],'data':[0,0]})

    def test_conditional_external_port_alias_requires_output_mode(self):
        b,f=self.motor('p_series/ph42-020-s300-r');f['put']('External Port Mode 1',1);proof=[]
        for n in (1,2):
            f['put']('Indirect Address '+str(n),599+n);proof.append({'item':f['names']['Indirect Address '+str(n)]['key'],'value':599+n})
        self.bind(b,f,'Indirect Data 1',expectedEffectiveItem=f['names']['External Port Data 1']['key'],expectedAliasMappings=proof)
        b.command({'op':'write','id':1,'address':634,'data':[1,0]});self.assertEqual(f['get']('External Port Data 1'),1)
        f['put']('External Port Mode 1',0)
        with self.assertRaises(ValueError):b.command({'op':'write','id':1,'address':634,'data':[0,0]})
