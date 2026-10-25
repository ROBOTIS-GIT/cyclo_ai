// Public-source evidence only. Never builds or changes the execution registry.
import {createHash} from 'node:crypto';
const HANGUL=/[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7af\ud7b0-\ud7ff\uffa0-\uffdc]/u;
export function englishSource(text) {
 return text.replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g,comment=>{
  if(/copyright|license|permission to|redistribution/i.test(comment)){
   if(HANGUL.test(comment))throw Error('Source legal notice conflicts with English-only output; use original official source without rewriting the notice');
   return comment;
  }
  return '\n'.repeat((comment.match(/\n/g)??[]).length);
 });
}
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9+]/g,'');
export function listModels(index,query='') {
 const q=normalize(query);
 return index.models.filter(m=>!q||[m.id,m.title,...m.aliases].some(a=>normalize(a).includes(q)));
}
export function resolveModel(index,value) {
 const exact=index.models.find(m=>m.id===value);if(exact)return exact;
 const matches=index.models.filter(m=>[m.title,...m.aliases].some(a=>normalize(a)===normalize(value)));
 if(matches.length!==1)throw Error(matches.length?'Model/generation is ambiguous; use an exact catalog ID and firmware generation':'Unknown model: search the official model catalog; do not substitute a related model');
 return matches[0];
}
export async function readManual(index,args,{fetchSource=fetch,signal}={}) {
 let model;
 if(Boolean(args.model)===Boolean(args.guide))throw Error('Choose exactly one model or indexed guide');
 if(args.guide){
  const g=index.guides.find(g=>g.id===args.guide);if(!g)throw Error('Unknown guide; use an indexed official guide ID');
  model={...g,kind:'cross-model-guide',generation:'Verify applicability against the exact model',componentPaths:[]};
 }else model=resolveModel(index,args.model);
 const path=args.sourcePath??model.sourcePath;
 if(path!==model.sourcePath&&!model.componentPaths.includes(path))throw Error('Source is outside this model dependency graph');
 if((!path.startsWith('docusaurus/docs/')&&path!=='docusaurus/src/components/Show/index.tsx')||path.split('/').includes('..')||!path.match(/\.(mdx|tsx)$/))throw Error('Invalid official English source path');
 const meta=index.files[path];if(!meta)throw Error('Unresolved source dependency; inspect the original caller and official component before an exact claim');
 const url=`https://raw.githubusercontent.com/ROBOTIS-GIT/docs/${index.revision}/${path}`;
 const response=await fetchSource(url,{redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Official source retrieval failed (${response.status}); do not infer unsupported features from a network failure`);
 let bytes;
 if(response.body?.getReader){
  const reader=response.body.getReader(),chunks=[];let total=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>1024*1024)throw Error('Source exceeds the bounded reader size; use the exact official page');chunks.push(Buffer.from(value));}bytes=Buffer.concat(chunks);}
  finally{await reader.cancel().catch(()=>{});}
 }else{bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>1024*1024)throw Error('Source exceeds bounded reader size');}
 const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 if(blob!==meta.blobSha)throw Error('Pinned source blob mismatch; no evidence is returned');
 const cleaned=englishSource(bytes.toString('utf8'));
 const sourcePolicyOmissions=[];
 const lines=cleaned.split('\n').map((line,i)=>{
  if(!HANGUL.test(line))return line;
  if(/copyright|license|permission to|redistribution/i.test(line))throw Error('Non-English legal notice cannot be rewritten or withheld; inspect the original source and report the policy conflict');
  sourcePolicyOmissions.push({line:i+1,reason:'Official English source contains non-English text; original line withheld, not translated. Resolve the original source before any exact claim involving this line.'});
  return '[Source line withheld under English-only policy; see original official source and omission record.]';
 }),count=Math.min(args.lineCount??100,160);
 let start=Math.max(1,args.startLine??1);
 if(args.topic){
  const q=args.topic.toLowerCase(),heading=meta.headings.find(h=>h.title.toLowerCase().includes(q));
  const match=heading?heading.line-1:lines.findIndex(line=>!line.trim().startsWith('import ')&&line.toLowerCase().includes(q));
  if(match>=0)start=Math.max(1,match-2);
 }
 const callers=[model.sourcePath,...model.componentPaths].flatMap(p=>(index.files[p]?.calls??[]).filter(c=>c.path===path).map(c=>({callerPath:p,...c})));
 return {model:{id:model.id,title:model.title,kind:model.kind,generation:model.generation},revision:index.revision,sourceUrl:`https://github.com/ROBOTIS-GIT/docs/blob/${index.revision}/${path}#L${start}`,sourcePath:path,sourceBlobVerified:true,sourcePolicyOmissions,sourceLines:lines.slice(start-1,start-1+count).map((text,i)=>({line:start+i,text})),nextLine:start-1+count<lines.length?start+count:null,headings:meta.headings,imports:meta.imports,callerInvocations:callers,conditions:{rendered:false,present:meta.containsConditions,policy:'Raw MDX evidence, not rendered feature support. Read caller props, component defaults, conditional Show/ternary branches and firmware notes together. If conditions or imported dependencies remain unresolved, block an exact applicability claim. Never concatenate branches as universal behavior.'},commentPolicy:'Developer comments omitted while preserving original line numbers; legal notices are not rewritten',execution:'Documentation retrieval only; no register writes or hardware access'};
}
