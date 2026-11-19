// Optional local source acceptance probe. Never executes MDX or contacts devices.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {readManual} from '../modules/dynamixel/manual.mjs';
const checkout=process.argv[2];if(!checkout)throw Error('Provide the pinned official source checkout');
const index=JSON.parse(await readFile(new URL('../references/dynamixel-docs.json',import.meta.url),'utf8'));
const verified=new Set(),errors=[],omitted=new Map();let documents=0;
const fetchSource=async url=>{
 const prefix=`https://raw.githubusercontent.com/ROBOTIS-GIT/docs/${index.revision}/`;
 if(!url.startsWith(prefix))throw Error('Unexpected source URL');
 const path=url.slice(prefix.length),file=resolve(checkout,path);
 if(!file.startsWith(resolve(checkout)+'/'))throw Error('Source path escapes checkout');
 return new Response(await readFile(file));
};
for(const model of index.models){
 try{
  await readManual(index,{model:model.id,lineCount:1},{fetchSource});documents++;verified.add(model.sourcePath);
  for(const sourcePath of model.componentPaths){
   if(verified.has(sourcePath))continue;
   const result=await readManual(index,{model:model.id,sourcePath,lineCount:1},{fetchSource});verified.add(sourcePath);
   if(result.sourcePolicyOmissions.length)omitted.set(sourcePath,result.sourcePolicyOmissions);
  }
 }catch(error){errors.push({model:model.id,error:error.message});}
}
const result={revision:index.revision,productDocumentsRead:documents,uniqueSourcesBlobVerified:verified.size,errors,sourcePolicyOmissions:Object.fromEntries(omitted),sourceComments:'ordinary developer comments omitted; original source line positions retained; legal notices not rewritten',conditionRendering:false,allFeatureClaimsSemanticallyVerified:false,scope:'Actual pinned English source bytes through bounded reader; not website retrieval, MDX rendering, host invocation or hardware acceptance'};
await writeFile(new URL('./current/model-source-probe-0.6.0.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
