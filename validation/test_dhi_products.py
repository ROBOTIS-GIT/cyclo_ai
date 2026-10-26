"""Source inventory witnesses, not launched products or evaluated xacro claims."""
import unittest,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from index_dhi_products import artifacts
ROOT=Path(__file__).resolve().parents[1]
D=json.loads((ROOT/'references/dhi-products.json').read_text());INDEX=json.loads((ROOT/'references/dhi-sources.json').read_text())
def product(name):return next(p for p in D['products']if p['package']==name)
def artifact(name,end):return next(a for a in product(name)['artifacts']if a['path'].endswith(end))
class DhiProducts(unittest.TestCase):
 def test_every_promoted_consumer_has_exact_plugin_witness_and_indexed_artifacts(self):
  self.assertEqual(len(D['products']),7)
  for p in D['products']:
   with self.subTest(p['package']):
    self.assertTrue(p['dhiDeclaredIn']);profile=INDEX['packages'][p['package']]['profiles'][p['profile']];self.assertEqual(p['revision'],profile['revision'])
    for a in p['artifacts']:self.assertIn(a['path'],profile['files']);self.assertFalse(a['conditionsEvaluated'])
 def test_hand_revision_and_side_variants_preserve_physical_mock_and_sim_choices(self):
  for side in ['right','left']:
   a=artifact('robotis_hand',f'hx5_d20_rev2/hx5_d20_{side}.ros2_control.xacro');self.assertIn('dynamixel_hardware_interface/DynamixelHardware',a['plugins']);self.assertIn('mock_components/GenericSystem',a['plugins']);self.assertIn('gz_ros2_control/GazeboSimSystem',a['plugins']);self.assertTrue(a['xacroConditions'])
 def test_hand_tablesync_is_ordered_controller_configuration_not_a_global_driver_flag(self):
  a=artifact('robotis_hand','hx5_d20_rev2/hx5_d20_right.ros2_control.xacro');seq=[(g['name'],p['value'])for g in a['gpioInitSequence']for p in g['params']if p['name']=='Table Sync Enable'];self.assertEqual([v for _,v in seq],['0','1']);self.assertNotEqual(seq[0][0],seq[1][0]);self.assertNotIn('use_table_sync',INDEX['packages']['dynamixel_hardware_interface']['profiles']['main']['hardwareParameters'])
 def test_k1_simulator_receiver_and_physical_hardware_are_distinct(self):
  self.assertIn('mujoco_hardware_interface/MujocoSystem',artifact('ai_sapiens','k1_mujoco.ros2_control.xacro')['plugins']);self.assertIn('radiomaster_usb_hardware_interface/RadiomasterUsbHardwareInterface',artifact('ai_sapiens','k1_radiomaster_usb.ros2_control.xacro')['plugins']);self.assertIn('dynamixel_hardware_interface/DynamixelHardware',artifact('ai_sapiens','k1_hat.ros2_control.xacro')['plugins'])
 def test_launch_argument_defaults_are_source_expressions_not_evaluated_runtime(self):
  candidates=[a for a in product('robotis_hand')['artifacts']if a['path'].endswith('hx5_d20_right.launch.py')];self.assertTrue(candidates);self.assertTrue(candidates[0]['launchArguments']);self.assertFalse(candidates[0]['conditionsEvaluated'])
 def test_product_rates_are_configured_values_not_measured_control_frequency(self):
  for name,expected in [('open_manipulator',100),('robotis_hand',100),('ai_worker',100),('ai_sapiens',1000)]:
   rates=[row['parameters']['update_rate']for a in product(name)['artifacts']for row in a.get('controllerParameters',[])if 'update_rate'in row['parameters']];self.assertIn(expected,rates,name)
 def test_mutable_dependency_references_never_claim_installed_commit_lock(self):
  deps=[d for a in product('ai_worker')['artifacts']for d in a.get('dependencies',[])if d['ref']=='main'];self.assertTrue(deps);self.assertTrue(all(not d['immutableRef']for d in deps))
 def test_legacy_fake_plugin_spelling_and_arm_scope_are_preserved(self):
  self.assertIn('fake_components/GenericSystem',product('RH-P12-RN-A')['otherPluginDeclarations']);self.assertTrue(any('turtlebot3_arm' in p for p in product('turtlebot3_autorace')['dhiDeclaredIn']))
 def test_argument_and_namespace_mutations_remain_separate_configuration_evidence(self):
  for namespace in ['arm_a','arm_b']:
   text='from launch.actions import DeclareLaunchArgument\narg=DeclareLaunchArgument("namespace",default_value="'+namespace+'")\n';a=artifacts(text,'bringup.launch.py');self.assertEqual(a['launchArguments'][0]['defaultExpression'],repr(namespace))
  x='<robot xmlns:xacro="http://www.ros.org/wiki/xacro"><xacro:if value="${use_mock}"><hardware><plugin>mock_components/GenericSystem</plugin></hardware></xacro:if><xacro:unless value="${use_mock}"><hardware><plugin>custom/Hardware</plugin></hardware></xacro:unless></robot>';a=artifacts(x,'system.xacro');self.assertEqual(len(a['plugins']),2);self.assertEqual(len(a['xacroConditions']),2);self.assertFalse(a['conditionsEvaluated'])
