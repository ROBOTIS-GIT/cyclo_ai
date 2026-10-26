"""Inspect explicitly supplied expanded robot XML and controller YAML offline.

Does not expand xacro, import ROS, execute launch files, read ports or modify files.
Static observations and source-tracing obligations are not observed runtime state.
"""
import argparse,hashlib,json,math,re
from pathlib import Path
from xml.etree import ElementTree as ET
import yaml
ROOT=Path(__file__).resolve().parents[1]
MAX_BYTES=2*1024*1024
class UniqueLoader(yaml.SafeLoader):
 def compose_node(self,parent,index):
  self.inspect_depth=getattr(self,'inspect_depth',0)+1;self.inspect_nodes=getattr(self,'inspect_nodes',0)+1
  if self.inspect_depth>32 or self.inspect_nodes>10000:raise ValueError('YAML exceeds parser depth/node bound')
  try:return super().compose_node(parent,index)
  finally:self.inspect_depth-=1
def mapping(loader,node,deep=False):
 pairs=loader.construct_pairs(node,deep=deep);out={}
 for k,v in pairs:
  if not isinstance(k,(str,int,float,bool,type(None))):raise ValueError('Unsupported YAML mapping key')
  if k in out:raise ValueError('Duplicate YAML key: '+str(k))
  out[k]=v
 return out
UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,mapping)
def bounded_tree(value,seen=None,depth=0,budget=None):
 if isinstance(value,float)and not math.isfinite(value):raise ValueError('Non-finite YAML values require explicit interpretation')
 seen=set()if seen is None else seen;budget=[10000]if budget is None else budget;budget[0]-=1
 if depth>32 or budget[0]<0:raise ValueError('Configuration exceeds bounded structure limits')
 if isinstance(value,(dict,list)):
  if id(value)in seen:raise ValueError('Recursive/shared YAML aliases are unresolved; provide explicit bounded configuration')
  seen.add(id(value))
  for x in (value.values()if isinstance(value,dict)else value):bounded_tree(x,seen,depth+1,budget)
  seen.remove(id(value))
def params(node):
 out={}
 for p in node.findall('param'):
  name=p.get('name');value=(p.text or '').strip()
  if not name or name in out:raise ValueError('Missing or duplicate XML parameter: '+str(name))
  out[name]=value
 return out
def scalar(v):
 try:return float(v)if '.'in v else int(v,10)
 except (ValueError,TypeError):return None
def interfaces(node,tag):return [{'name':x.get('name'),'parameters':params(x)}for x in node.findall(tag)]
def load_yaml(text):
 if len(text.encode())>MAX_BYTES:raise ValueError('Controller YAML exceeds size bound')
 value=yaml.load(text,Loader=UniqueLoader)
 if value is None:value={}
 bounded_tree(value)
 if not isinstance(value,dict):raise ValueError('Controller YAML root must be a mapping')
 return value
def controller_blocks(text):
 if len(text.encode())>MAX_BYTES:raise ValueError('Controller YAML exceeds size bound')
 rows=[]
 # Compose preserves repeated namespace selector blocks; safe_load would silently
 # discard earlier blocks. Do not guess ROS-version-specific merge precedence.
 for document,tree in enumerate(yaml.compose_all(text,Loader=UniqueLoader)):
  def visit(node,path,stack):
   if not isinstance(node,yaml.MappingNode):return
   if id(node)in stack:raise ValueError('Recursive controller YAML mapping')
   stack=stack|{id(node)}
   for key,value in node.value:
    if not isinstance(key,yaml.ScalarNode):raise ValueError('Controller selector must be scalar')
    if key.value=='ros__parameters':
     if not isinstance(value,yaml.MappingNode):raise ValueError('ros__parameters must be a mapping')
     parameters=load_yaml(yaml.serialize(value))
     rows.append({'selector':'/'.join(path),'document':document,'parameters':parameters,'activeState':'unknown; YAML presence does not prove loading/activation/claims'})
    else:visit(value,path+[str(key.value)],stack)
  visit(tree,[],set())
 return rows
def inspect(xml_text,controller_text='',*,profile=None,distro=None,index=None):
 if len(xml_text.encode())>MAX_BYTES or re.search(r'<!DOCTYPE|<!ENTITY',xml_text,re.I):raise ValueError('Oversized XML or external/entity declarations are not accepted')
 robot=ET.fromstring(xml_text);controllers=controller_blocks(controller_text);index=index or json.loads((ROOT/'references/dhi-sources.json').read_text());source=index['packages']['dynamixel_hardware_interface'];matches=[(n,p)for n,p in source['profiles'].items()if n==profile or p['revision']==profile];known=matches[0]if matches else None
 result={'scope':'Offline static evidence; no ROS, xacro or launch execution; no observed device/controller state','sourceProfile':{'requested':profile,'resolved':known[0]if known else None,'revision':known[1]['revision']if known else None,'distro':distro,'installedBinaryVerified':False},'artifacts':{'robotSha256':hashlib.sha256(xml_text.encode()).hexdigest(),'controllerSha256':hashlib.sha256(controller_text.encode()).hexdigest()},'components':[],'controllers':[],'diagnostics':[],'missingEvidence':['Actual loaded hardware binary/overlay and local patches','Expanded launch arguments, namespaces and selected controller-manager parameters','Runtime hardware lifecycle/controller/interface claims and device feedback; do not obtain without authorization']}
 def diag(code,message,where):result['diagnostics'].append({'code':code,'message':message,'location':where})
 unresolved=bool(re.search(r'\$\{|\$\(',xml_text))or any(isinstance(e.tag,str)and e.tag.startswith('{http://www.ros.org/wiki/xacro}')for e in robot.iter())
 if unresolved:diag('unexpanded-xacro','Substitutions/macros/includes are not evaluated. Supply the exact expanded robot_description; derived paths and component counts are incomplete.','robot')
 if not known:diag('unknown-source','No matching pinned source profile. Observations remain useful, but exact DHI behavior requires local source/patch review.','sourceProfile')
 if known and distro in ['humble','jazzy']and known[0]not in[distro]:diag('version-evidence-conflict','Selected source profile differs from ROS distribution. Verify API compatibility and actual overlays; branch name alone is not runtime evidence.','sourceProfile')
 if distro=='rolling':diag('rolling-branch-unavailable','README/CI names Rolling but indexed repository has no rolling profile; identify the actual revision, do not clone a fabricated branch.','sourceProfile')
 for control in robot.findall('.//ros2_control'):
  hw=control.find('hardware');plugin=(hw.findtext('plugin')or'').strip()if hw is not None else '';hp=params(hw)if hw is not None else {};component={'name':control.get('name'),'type':control.get('type'),'plugin':plugin,'pluginCandidates':[(x.text or'').strip()for x in control.findall('.//hardware//plugin')],'hardwareParameters':hp,'controlParameters':params(control),'joints':[],'gpios':[],'sensors':[],'derived':{},'sourceTrace':[]}
  for tag,key in [('joint','joints'),('gpio','gpios'),('sensor','sensors')]:
   for n in control.findall(tag):component[key].append({'name':n.get('name'),'parameters':params(n),'command':interfaces(n,'command_interface'),'state':interfaces(n,'state_interface')})
  result['components'].append(component);where=component['name']or'unnamed';dhi=plugin=='dynamixel_hardware_interface/DynamixelHardware'
  if not dhi:
   diag('different-hardware-plugin','This component does not use the indexed DHI plugin. Do not apply DHI torque or bus behavior to mock, simulator, receiver or custom implementations.',where);continue
  if unresolved:
   component['derived']['incompleteExpansion']=True
   continue
  if not known:continue
  p=known[1];component['sourceTrace']=[{'query':q,'package':'dynamixel_hardware_interface','profile':known[0]}for q in ['on_init','InitItem','InitDxlReadItems','InitDxlWriteItems','MapInterfaces','start','stop','ChangeDxlTorqueState','WriteItemBuf','CheckError','CommReset']]
  for key in ['number_of_joints','number_of_transmissions','port_name','baud_rate','dynamixel_model_folder']:
   if key not in hp:diag('required-hardware-parameter','Missing required source parameter '+key,where)
  for key,value in hp.items():
   if key not in p['hardwareParameters']:diag('unrecognized-hardware-parameter','Not found among hardware parameter access sites: '+key+'; inspect custom code or parameter placement.',where)
  dims=[scalar(hp.get(k))for k in ['number_of_joints','number_of_transmissions']]
  if not all(isinstance(x,int)and 0<=x<=4096 for x in dims):diag('invalid-component-dimensions','Counts must be explicit bounded nonnegative integers for static matrix analysis.',where)
  if dims[0]is not None and dims[0]!=len(component['joints']):diag('joint-count-mismatch','Declared number_of_joints differs from observed joints; inspect the exact source validation and expansion.',where)
  for key in ['joint_to_transmission_matrix','transmission_to_joint_matrix']:
   if key not in hp:component['derived'][key]={'assumedByPinnedSource':'identity-like matrix; verify dimensions and actual mapping'};continue
   vals=[]
   for x in hp[key].split(','):
    try:
     number=float(x.strip());vals.append(number if math.isfinite(number)else None)
    except ValueError:vals.append(None)
   expected=dims[0]*dims[1]if all(isinstance(x,int)and x>=0 for x in dims)else None
   component['derived'][key]={'values':vals,'expectedEntries':expected}
   if any(x is None or not math.isfinite(x)for x in vals)or expected is None or len(vals)!=expected:diag('matrix-shape-or-value','Matrix cannot match the declared finite dimensions: '+key,where)
  enable=[];identities=set()
  for gpio in component['gpios']:
   gp=gpio['parameters'];kind=gp.get('type');idv=scalar(gp.get('ID'));comm=scalar(gp.get('comm_id',gp.get('ID')));gwhere=where+'/'+str(gpio['name']);gpio['sourceReview']={}
   if kind not in ['dxl','virtual_dxl','sensor','virtual_sensor','controller']:diag('unknown-gpio-type','Source GPIO type is missing/unknown; no default motor role is inferred.',gwhere)
   if not isinstance(idv,int)or not 0<=idv<=255:diag('invalid-gpio-id','ID is missing or cannot be represented safely as the source uint8_t; physical protocol limits require separate validation.',gwhere)
   if (comm,idv)in identities:diag('duplicate-gpio-identity','Repeated comm_id/ID pair; resolve physical/virtual addressing.',gwhere)
   identities.add((comm,idv))
   if kind in ['virtual_dxl','virtual_sensor']and ('model_num'not in gp or 'comm_id'not in gp):diag('missing-virtual-identity','Virtual entries require explicit model_num and comm_id in the selected implementation.',gwhere)
   activation=(kind in ['dxl','virtual_dxl'])if 'Torque Enable'not in gp else (scalar(gp['Torque Enable'])!=0 if scalar(gp['Torque Enable'])is not None else None)
   if activation is None:diag('unresolved-torque-selection','Torque Enable cannot be interpreted as a literal integer; inspect expanded configuration.',gwhere)
   elif activation:enable.append({'gpio':gpio['name'],'commId':comm,'id':idv,'basis':'explicit Torque Enable'if 'Torque Enable'in gp else 'source default for GPIO type'})
   gpio['sourceReview']['initWriteGroups']={'operatingMode':{k:v for k,v in gp.items()if k=='Operating Mode'},'limits':{k:v for k,v in gp.items()if 'Limit'in k},'remaining':{k:v for k,v in gp.items()if k not in ['ID','type','comm_id','model_num','Reboot','Torque Enable','Operating Mode','[unit info]']and 'Limit'not in k}}
   gpio['sourceReview']['torqueActivationSelected']=activation;gpio['sourceReview']['unitOverride']=gp.get('[unit info]');gpio['sourceReview']['rebootRequested']=scalar(gp.get('Reboot','0'))not in[None,0]
   if kind in ['dxl','sensor','controller']and comm!=idv:diag('physical-comm-id-routing','Initialization accepts comm_id, but cyclic physical GPIO handlers assign comm_id=ID. Trace both paths before predicting addressing.',gwhere)
   mode=gp.get('Operating Mode');gpio['sourceReview']['configuredOperatingMode']=mode;gpio['sourceReview']['modelNumberSupplied']=gp.get('model_num');gpio['sourceReview']['modelTableCandidates']=[m['file']for m in p['modelLookup']if str(m['modelNumber'])==gp.get('model_num')]
   if any('Table Sync'in k or 'TableSync'in k or 'SyncTable'in k for k in gp):diag('tablesync-review','TableSync configuration is present: inspect controller/model/firmware, ordered init groups and virtual comm routing; this is not SDK Sync Read/Write proof.',gwhere)
  component['derived']['activationTorqueSelection']=enable;component['derived']['initialTorquePolicy']={'literal':hp.get('disable_torque_at_init'),'sourceRequestsDisableIfAlreadyOn':hp.get('disable_torque_at_init')=='true','notObservedTorqueState':True}
  cmdmap={x['from']:x['to']for x in p['interfaceMaps']['ros2_to_dxl_cmd_map']};statemap={x['from']:x['to']for x in p['interfaceMaps']['ros2_to_dxl_state_map']}
  for j in component['joints']:
   j['mappedCommandItems']={i['name']:cmdmap.get(i['name'])for i in j['command']};j['mappedStateItems']={i['name']:statemap.get(i['name'])for i in j['state']}
   for typ,maps in [('command',cmdmap),('state',statemap)]:
    for it in j[typ]:
     if it['name']not in maps:diag('unmapped-interface','Declared '+typ+' interface '+str(it['name'])+' has no cyclic conversion map entry; export/acceptance alone is not functional support. Trace special state paths separately.',where+'/'+str(j['name']))
   if 'effort'in j['mappedCommandItems']:diag('effort-unit-unverified','Effort maps to Goal Current, not proven calibrated N.m. Read the selected .model unit row, overrides, matrices and calibration.',where+'/'+str(j['name']))
  transmissions=[g for g in component['gpios']if g['parameters'].get('type')in ['dxl','virtual_dxl']]
  if dims[1]is not None and dims[1]!=len(transmissions):diag('transmission-count-mismatch','Declared transmissions differ from source-selected physical/virtual DXL GPIO handlers.',where)
  routes=[];used=set();reverse={x['from']:x['to']for x in p['interfaceMaps']['dxl_to_ros2_cmd_map']}
  matrix=component['derived']['joint_to_transmission_matrix'].get('values')
  shape_ok=all(isinstance(n,int)and 0<=n<=4096 for n in dims)and dims==[len(component['joints']),len(transmissions)]
  if shape_ok and (matrix is None or len(matrix)==dims[0]*dims[1]and all(isinstance(x,(int,float))and math.isfinite(x)for x in matrix)):
   for ti,g in enumerate(transmissions):
    for interface in g['command']:
     targets=reverse.get(interface['name']);contributors=[]
     if targets:
      for ji,j in enumerate(component['joints']):
       coefficient=matrix[ti*dims[0]+ji]if matrix is not None else int(ti==ji)
       matched=[x['name']for x in j['command']if x['name']in targets]
       if coefficient and matched:
        contributors.append({'joint':j['name'],'interfaces':matched,'coefficient':coefficient});used.update((j['name'],n)for n in matched)
     routes.append({'gpio':g['name'],'field':interface['name'],'mappedRosInterfaces':targets,'contributors':contributors,'qualification':'Static declared route; unit conversion, mode, observed state and output success require separate evidence'})
   for j in component['joints']:
    for interface in j['command']:
     if (j['name'],interface['name'])not in used:diag('unrouted-joint-command','No nonzero declared matrix/GPIO command path found for '+str(interface['name'])+'; declaration alone is insufficient.',where+'/'+str(j['name']))
  component['derived']['cyclicCommandRoutes']=routes
  component['derived']['behaviorQualification']='Configuration predicts selected code paths only. Initialization can communicate/write before activation; successful service/lifecycle return is not device readback.'
 # Preserve namespace selectors and document order without inventing merge precedence.
 result['controllers']=controllers
 declared={}
 for component in result['components']:
  for j in component['joints']:declared.setdefault(j['name'],[]).append({'component':component['name'],'interfaces':{i['name']for i in j['command']}})
 for c in result['controllers']:
  par=c['parameters'];js=par.get('joints',([par['joint']]if isinstance(par.get('joint'),str)else[]));ifs=par.get('command_interfaces')or([par['interface_name']]if isinstance(par.get('interface_name'),str)else[])
  if js and not ifs:diag('controller-interface-requirements-unresolved','Read the exact controller type/schema; no command requirement is inferred from its name or YAML presence.',c['selector'])
  if not isinstance(js,list)or not isinstance(ifs,list):diag('controller-schema-unresolved','Controller joints/interfaces are not literal lists; resolve controller type/schema before checking claims.',c['selector']);continue
  if isinstance(js,list)and isinstance(ifs,list):
   if not all(isinstance(i,str)for i in ifs):diag('controller-interface-type','Requested interfaces are not literal strings.',c['selector']);continue
   for j in js:
    if not isinstance(j,str):diag('controller-joint-type','Controller joint name is not a literal string.',c['selector']);continue
    if j not in declared:diag('controller-joint-missing','Controller references a joint absent from supplied robot_description: '+j,c['selector'])
    elif len(declared[j])!=1:diag('controller-component-ambiguous','Joint occurs in multiple components; supply controller-manager/namespace association instead of guessing: '+j,c['selector'])
    elif not set(ifs)<=declared[j][0]['interfaces']:diag('controller-interface-mismatch','Requested command interfaces are not exported for '+j,c['selector'])
 return result
if __name__=='__main__':
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--urdf',type=Path,required=True);ap.add_argument('--controllers',type=Path);ap.add_argument('--profile');ap.add_argument('--ros-distro');a=ap.parse_args()
 for path in [a.urdf,a.controllers]:
  if path and path.stat().st_size>MAX_BYTES:ap.error('Input file exceeds2MiB bound')
 try:print(json.dumps(inspect(a.urdf.read_text(),a.controllers.read_text()if a.controllers else'',profile=a.profile,distro=a.ros_distro),indent=2,allow_nan=False))
 except (ValueError,ET.ParseError,yaml.YAMLError)as e:ap.exit(2,'Configuration inspection failed: '+str(e)+'\n')
