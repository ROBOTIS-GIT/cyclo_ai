"""The independent golden rules execute in Python as well as JavaScript."""
import importlib.util,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'modules/dynamixel'))
from table_conditions import scalar,live
INVENTORY=json.loads((ROOT/'references/control-items.json').read_text())
class Conditions(unittest.TestCase):
    def test_shared_official_boundary_cases(self):
        cases=json.loads((ROOT/'validation/fixtures/item-condition-cases.json').read_text())['cases']
        for c in cases:
            with self.subTest(c['name']):
                entry=next(m for m in INVENTORY['models']if m['catalogId']==c['catalogId']);item=next(i for i in entry['items']if i['name']==c['item']);state={'Torque Enable':0,'Lock':0,'Operating Mode':3,'Control Mode':2,'Drive Mode':0,'Current Limit':100,'Velocity Limit':1000,'PWM Limit':1000,'Torque Limit':100,'Min Position Limit':0,'Max Position Limit':4095,'CW Angle Limit':0,'CCW Angle Limit':1023,'Controller State':0,'Bus Watchdog':0,**c['state']};accepted=True;error=None
                try:scalar(item['write'],item,c['value'],c['firmware'],c['protocol']);live(item['write'],c['value'],lambda n:state[n],c['firmware'],c['protocol'],has_item=lambda n:any(i['name']==n for i in entry['items']))
                except(ValueError,KeyError)as e:accepted=False;error=str(e)
                self.assertEqual(accepted,c['allowed'],f'{c["name"]}: {error}')
