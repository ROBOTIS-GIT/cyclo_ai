"""Generate a bounded, mock-only ROS 2 arm scaffold and separate DHI review plan.

No ROS import, network, serial, controller startup or host configuration changes.
Mechanical limits must be supplied; this is not a product-calibrated robot model.
"""
import argparse,json,math,re
from pathlib import Path
from xml.etree import ElementTree as ET
import yaml

DHI_REV='6bb5f93ecad1fe3c231e3ece580344e8f0a6efc3'
XACRO='http://www.ros.org/wiki/xacro'
ET.register_namespace('xacro',XACRO)
def validate(spec):
    if spec.get('rosDistro')!='jazzy':raise ValueError('This scaffold is reviewed for Jazzy only; verify other distributions separately')
    joints=spec.get('joints',[])
    if not 1<=len(joints)<=16:raise ValueError('Provide 1..16 explicitly described joints')
    names=set();ids=set()
    for j in joints:
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,47}',j['name']):raise ValueError('Invalid joint name')
        if j['name'] in names or j['id'] in ids:raise ValueError('Duplicate joint name or DYNAMIXEL ID')
        names.add(j['name']);ids.add(j['id'])
        if type(j['id']) is not int or not 0<=j['id']<=252:raise ValueError('Invalid unicast ID')
        for k in ['lower','upper','effort','velocity','lengthM']:
            if not isinstance(j[k],(int,float)) or not math.isfinite(j[k]):raise ValueError('Finite mechanical limits are required')
        if j['lower']>=j['upper'] or min(j['effort'],j['velocity'],j['lengthM'])<=0:raise ValueError('Invalid joint limits or dimensions')
        if not isinstance(j.get('model'),str) or not j['model'].strip():raise ValueError('Exact actuator model is required for the review plan')
    return joints

def generate(spec,out):
    joints=validate(spec);out=Path(out)
    if out.exists() and any(out.iterdir()):raise ValueError('Output must be a new or empty directory; user files are preserved')
    out.mkdir(parents=True,exist_ok=True)
    robot=ET.Element('robot',name='cyclo_mock_arm')
    macro=ET.SubElement(robot,f'{{{XACRO}}}macro',name='mock_control_joint',params='name initial')
    joint=ET.SubElement(macro,'joint',name='${name}');ET.SubElement(joint,'command_interface',name='position')
    state=ET.SubElement(joint,'state_interface',name='position');ET.SubElement(state,'param',name='initial_value').text='${initial}'
    ET.SubElement(joint,'state_interface',name='velocity')
    ET.SubElement(robot,'link',name='base_link');parent='base_link'
    for j in joints:
        link='link_'+j['name'];ET.SubElement(robot,'link',name=link)
        joint=ET.SubElement(robot,'joint',name=j['name'],type='revolute')
        ET.SubElement(joint,'parent',link=parent);ET.SubElement(joint,'child',link=link)
        ET.SubElement(joint,'origin',xyz=f"0 0 {j['lengthM']}",rpy='0 0 0');ET.SubElement(joint,'axis',xyz='0 0 1')
        ET.SubElement(joint,'limit',**{k:str(j[k]) for k in ['lower','upper','effort','velocity']});parent=link
    control=ET.SubElement(robot,'ros2_control',name='CycloMockArm',type='system')
    hardware=ET.SubElement(control,'hardware');ET.SubElement(hardware,'plugin').text='mock_components/GenericSystem'
    ET.SubElement(hardware,'param',name='calculate_dynamics').text='false'
    for j in joints:
        ET.SubElement(control,f'{{{XACRO}}}mock_control_joint',name=j['name'],initial=str((j['lower']+j['upper'])/2))
    ET.indent(robot)
    (out/'mock_arm.urdf.xacro').write_text(ET.tostring(robot,encoding='unicode')+'\n')
    controllers={'controller_manager':{'ros__parameters':{'update_rate':50,'joint_state_broadcaster':{'type':'joint_state_broadcaster/JointStateBroadcaster'},'forward_position_controller':{'type':'position_controllers/JointGroupPositionController'}}},'forward_position_controller':{'ros__parameters':{'joints':[j['name'] for j in joints]}}}
    (out/'controllers.yaml').write_text(yaml.safe_dump(controllers,sort_keys=False))
    launch='''# Mock-only: no real hardware branch or serial parameter is accepted.
from pathlib import Path
import xacro
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    root = Path(__file__).resolve().parent
    description = xacro.process_file(str(root / "mock_arm.urdf.xacro")).toxml()
    return LaunchDescription([
        Node(package="robot_state_publisher", executable="robot_state_publisher", parameters=[{"robot_description": description}]),
        Node(package="controller_manager", executable="ros2_control_node", parameters=[str(root / "controllers.yaml")], remappings=[("robot_description", "/robot_description")]),
        Node(package="controller_manager", executable="spawner", arguments=["joint_state_broadcaster", "--param-file", str(root / "controllers.yaml"), "--controller-manager", "/controller_manager", "--controller-manager-timeout", "10"]),
        Node(package="controller_manager", executable="spawner", arguments=["forward_position_controller", "--inactive", "--param-file", str(root / "controllers.yaml"), "--controller-manager", "/controller_manager", "--controller-manager-timeout", "10"]),
    ])
'''
    (out/'mock_bringup.launch.py').write_text(launch)
    plan={'status':'review-required; not executable hardware configuration','rosDistro':'jazzy','dhiPlugin':'dynamixel_hardware_interface/DynamixelHardware','dhiRevision':DHI_REV,'source':f'https://github.com/ROBOTIS-GIT/dynamixel_hardware_interface/tree/{DHI_REV}','joints':joints,'remaining':['Verify real platform URDF and calibrated joint/transmission mappings','Resolve port/electrical interface, baud, model/firmware tables and exact ROS distribution branches','Review DHI lifecycle and mode/torque behavior before any authorized hardware bringup','Validate real limits, zero offsets and current/effort conversion against each model manual'],'runtimeTested':False}
    (out/'dhi-review.json').write_text(json.dumps(plan,indent=2)+'\n')
    return {'output':str(out),'files':sorted(p.name for p in out.iterdir()),'backend':'mock_components/GenericSystem','hardwareRuntimeValidated':False}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('spec');p.add_argument('output');a=p.parse_args()
    try:print(json.dumps(generate(json.loads(Path(a.spec).read_text()),a.output),indent=2))
    except (ValueError,KeyError,TypeError) as error:p.error(str(error))
