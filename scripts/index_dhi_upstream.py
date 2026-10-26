"""Index exact upstream framework/controller source for inherited behavior.

No build or ROS execution. These snapshots do not resolve a user's binary ABI.
"""
import argparse,json
from pathlib import Path
from index_dhi_sources import git,metadata,ROOT
PINS={'ros2_control':{'humble':'7711a43d9903360c3aa07f1d1d0ee19218b971ba','jazzy':'67646cfe21853fe3a66386b106daed1853dc5197','master':'45e248614f64d6d8ed1ed35763d2329357be981a'},'ros2_controllers':{'humble':'65db73628ebac1948833f0fbdc60973c74d6cd0e','jazzy':'d71703b362a6bbb4637a246d22b9960f8d149b20','master':'e70c3573807076e93583a022620348d1a9244a3e'}}
def build(prefix,index):
 for name,profiles in PINS.items():
  package={'repository':'ros-controls/'+name,'role':'Upstream framework/controller implementation; separate from ROBOTIS product integration','license':'Apache-2.0; verify individual file notices','profiles':{}}
  for profile,rev in profiles.items():
   files={}
   for path in git(str(prefix)+name,'ls-tree','-r','--name-only',rev).decode().splitlines():
    if '/test/'in path or '/tests/'in path:continue
    families=['hardware_interface/','controller_interface/','controller_manager/']if name=='ros2_control'else['forward_command_controller/','joint_trajectory_controller/','position_controllers/','velocity_controllers/','effort_controllers/','joint_state_broadcaster/']
    if path not in ['README.md','LICENSE']and not(path.startswith(tuple(families))and path.endswith(('.cpp','.hpp','.h','.py','.xml','.yaml','.rst','.md'))):continue
    b=git(str(prefix)+name,'show',rev+':'+path);files[path]=metadata(b,path)
   package['profiles'][profile]={'revision':rev,'branchAtCheck':profile,'files':files,'runtimeTested':False}
  index['packages'][name]=package
 return index
if __name__=='__main__':
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--checkout-prefix',required=True);a=ap.parse_args();p=ROOT/'references/dhi-sources.json';d=build(a.checkout_prefix,json.loads(p.read_text()));p.write_text(json.dumps(d,separators=(',',':'))+'\n');print(json.dumps({n:{k:len(v['files'])for k,v in d['packages'][n]['profiles'].items()}for n in PINS}))
