// Plugin-owned cooperative reservation. No device is opened by this module.
import {createHash, randomUUID} from 'node:crypto';
import {mkdir,lstat,realpath,stat,open,unlink} from 'node:fs/promises';
import {join} from 'node:path';

export async function acquireBusLease(target) {
 const dir=join('/tmp',`cyclo-products-${process.getuid?.()??'user'}`);
 await mkdir(dir,{mode:0o700,recursive:true});
 const info=await lstat(dir);
 if(!info.isDirectory()||info.mode&0o077||process.getuid&&info.uid!==process.getuid())throw Error('Unsafe bus reservation directory');
 let port=target.port,pinned;
 const keys=[];
 if(/^(tcp|udp):\/\//.test(port)){
  const url=new URL(port);
  if(!url.hostname||!url.port||url.username||url.password||url.pathname&&url.pathname!=='/'||url.search||url.hash)throw Error('Invalid explicit bridge endpoint');
  keys.push('bridge:'+url.hostname.toLowerCase());
 }else{
  port=await realpath(port);pinned=await stat(port,{bigint:true});
  if(!pinned.isCharacterDevice())throw Error('Selected port is not a serial character device');
  keys.push('path:'+port,'device:'+pinned.rdev);
 }
 const held=[];
 const verify=async()=>{
  if(!pinned)return;
  if(await realpath(target.port)!==port)throw Error('Serial alias binding changed');
  const now=await stat(port,{bigint:true});
  if(['dev','ino','rdev','ctimeNs'].some(k=>now[k]!==pinned[k]))throw Error('Physical serial binding changed');
 };
 const release=async()=>{
  let ok=true;
  for(const {handle,path,ino,dev,token}of held.splice(0).reverse())try{
   const current=await lstat(path),buffer=Buffer.alloc(1024);
   const {bytesRead}=await handle.read(buffer,0,buffer.length,0);
   if(current.ino!==ino||current.dev!==dev||JSON.parse(buffer.subarray(0,bytesRead).toString()).token!==token){ok=false;continue;}
   await unlink(path);
  }catch{ok=false;}finally{await handle.close().catch(()=>{ok=false;});}
  return ok;
 };
 try{
  for(const key of keys.sort()){
   const path=join(dir,createHash('sha256').update(key).digest('hex')+'.lock');
   let handle;try{handle=await open(path,'wx+',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Bus is reserved; confirm owner/transport closure before operator cleanup');throw e;}
   const {ino,dev}=await handle.stat(),token=randomUUID();held.push({handle,path,ino,dev,token});
   await handle.writeFile(JSON.stringify({pid:process.pid,token,key}));
  }
  await verify();return {port,verify,release};
 }catch(e){await release();throw e;}
}
