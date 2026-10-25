import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {listModels,resolveModel,readManual,englishSource} from '../modules/dynamixel/manual.mjs';
const index=JSON.parse(await readFile(new URL('../references/dynamixel-docs.json',import.meta.url),'utf8'));
test('full-tree inventory includes all families, orphan source and mechanical reducers',()=>{
 assert.deepEqual(index.summary.actuatorDocumentsByFamily,{ax_series:3,dx_series:3,ex_series:1,mx_series:7,p_series:6,pro_series:17,rx_series:4,x_series:36,y_series:12});
 assert.equal(index.models.length,92);assert.equal(index.summary.sharedPartialDocuments,463);
 assert.ok(resolveModel(index,'XW540-H260'));assert.equal(resolveModel(index,'DYD-11').kind,'mechanical-reducer');
 for(const m of index.models){assert.ok(index.files[m.sourcePath]);assert.equal(m.coverage.conditionsRendered,false);assert.equal(m.coverage.allFeatureClaimsSemanticallyVerified,false);}
});
test('aliases preserve document grouping but never merge firmware generations',()=>{
 assert.equal(resolveModel(index,'AX-12+').id,resolveModel(index,'AX-12A').id);
 assert.equal(resolveModel(index,'AX-18F').id,resolveModel(index,'AX-18A').id);
 assert.equal(resolveModel(index,'XL-320').id,resolveModel(index,'XL320').id);
 assert.throws(()=>resolveModel(index,'MX-28AR'),/ambiguous/);
 assert.throws(()=>resolveModel(index,'MX-28T'),/ambiguous/);
 for(const name of ['MX-28','MX-64','MX-106'])assert.throws(()=>resolveModel(index,name),/ambiguous/);
 const old=resolveModel(index,'mx_series/mx-28'),modern=resolveModel(index,'mx_series/mx-28-2');assert.notEqual(old.sourcePath,modern.sourcePath);
 const pro=index.models.filter(m=>m.family==='pro_series'&&m.id.includes('h54-200-s500'));assert.equal(pro.length,2);assert.deepEqual(new Set(pro.map(m=>m.generation)),new Set(['R(A)','R; inspect exact revision']));
 assert.equal(listModels(index,'XW430-T260').length,0,'a compatibility-table typo must not create a product alias');
});
test('model call props and conditional components remain separate evidence',()=>{
 const m=resolveModel(index,'XM430-W350');const f=index.files[m.sourcePath];
 const call=f.calls.find(c=>c.symbol==='ControlTableDrivemode');assert.match(call.propsSource,/since=\{38\}/);
 assert.ok(index.files[call.path].containsConditions);assert.ok(m.componentPaths.includes('docusaurus/src/components/Show/index.tsx'));
 assert.ok(index.guides.some(g=>g.id.endsWith('advanced_features.mdx')));
 for(const word of ['indirect','shadowid','shutdown','watchdog','profile','present'])assert.ok(m.componentPaths.some(p=>p.toLowerCase().includes(word)),word);
 const axis=index.models.find(m=>/2xc430/.test(m.id));assert.ok(axis&&axis.sourceTopics.length);
 assert.ok(index.models.filter(m=>m.family==='y_series').every(m=>m.componentPaths.some(p=>p.includes('protocol'))));
});
function fixture(text){
 const bytes=Buffer.from(text),blobSha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 const path='docusaurus/docs/dxl/_partials/x/conditional.mdx',caller='docusaurus/docs/dxl/model_reference/x_series/fixture.mdx';
 const meta={blobSha,imports:[],calls:[],headings:[],containsConditions:true};
 return {path,bytes,index:{revision:'a'.repeat(40),models:[{id:'fixture',title:'Fixture',aliases:['Fixture'],kind:'actuator',generation:'test-only',sourcePath:caller,componentPaths:[path]}],guides:[],files:{[path]:meta,[caller]:{...meta,calls:[{path,symbol:'Feature',propsSource:'<Feature since={38} enabled={false} />',sourceLine:12}]}}}};
}
test('bounded reader retains conditional source/defaults and caller props, not rendered claims',async()=>{
 const f=fixture('import Show from "@site/src/components/Show";\n<Show when={props.enabled !== false}>\nTime profile requires V42. Torque-on default is V{props.torqueOnFw ?? 45}.\n</Show>');
 const r=await readManual(f.index,{model:'fixture',sourcePath:f.path,lineCount:160},{fetchSource:async()=>new Response(f.bytes)});
 assert.equal(r.sourceBlobVerified,true);assert.equal(r.conditions.rendered,false);assert.match(r.callerInvocations[0].propsSource,/enabled=\{false\}/);assert.match(r.sourceLines.map(l=>l.text).join('\n'),/\?\? 45/);
});
test('wrong blobs, unrelated source paths and unavailable source do not become evidence',async()=>{
 const f=fixture('Official English source');
 await assert.rejects(readManual(f.index,{model:'fixture',sourcePath:f.path},{fetchSource:async()=>new Response('changed')}),/blob mismatch/);
 await assert.rejects(readManual(f.index,{model:'fixture',sourcePath:'docusaurus/docs/dxl/unrelated.mdx'},{fetchSource:()=>{throw Error('must not fetch');}}),/outside/);
 await assert.rejects(readManual(f.index,{model:'fixture',sourcePath:f.path},{fetchSource:async()=>new Response('',{status:404})}),/retrieval failed/);
});
test('developer comments omitted with source line positions; legal notices stay intact',()=>{
 const nonEnglish=String.fromCodePoint(0xac00);
 const source=`{/* developer ${nonEnglish}\ncomment */}\nVisible English`;
 assert.equal(englishSource(source).split('\n').length,source.split('\n').length);assert.ok(!englishSource(source).includes(nonEnglish));
 assert.equal(englishSource('{/* Copyright owner. License notice. */}'),'{/* Copyright owner. License notice. */}');
 assert.throws(()=>englishSource(`{/* License ${nonEnglish} */}`),/legal notice/);
});
test('non-English official prose is explicitly withheld, not silently translated into a claim',async()=>{
 const f=fixture('English source\n'+String.fromCodePoint(0x3137)+' source typo\nEnglish continuation');
 const r=await readManual(f.index,{model:'fixture',sourcePath:f.path},{fetchSource:async()=>new Response(f.bytes)});
 assert.equal(r.sourcePolicyOmissions[0].line,2);assert.match(r.sourceLines[1].text,/withheld/);assert.equal(r.sourceLines[2].line,3);
});
