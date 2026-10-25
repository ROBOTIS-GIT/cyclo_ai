"""Build source-location metadata from the official English MDX checkout.

No MDX execution/rendering and no register-write registry generation. Full manual
text is not redistributed. Pass an existing public-source checkout and its tree.
"""
import argparse,hashlib,json,posixpath,re,subprocess
from collections import Counter
from pathlib import Path

PREFIX='docusaurus/docs/dxl/'
MODEL=PREFIX+'model_reference/'
REVISION='c88527af0888baea6f7ef3305bbbbb911b960759'
COMMENTS=re.compile(r'\{/\*.*?\*/\}|<!--.*?-->',re.S)
IMPORT=re.compile(r"import\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]\s*;?")
EXTRA=('docusaurus/docs/software/dynamixel_wizard_2_0/','docusaurus/docs/faq/faq_dynamixel.mdx','docusaurus/docs/faq/dxl-selection-guide.mdx')
def clean_comments(text):
    return COMMENTS.sub(lambda m:'\n'*m.group().count('\n'),text)
def locate_import(source,spec):
    if spec.startswith('@site/'):return 'docusaurus/'+spec[6:]
    if spec.startswith('.'):return posixpath.normpath(posixpath.join(posixpath.dirname(source),spec))
    return None
def metadata(path,text):
    text=clean_comments(text)
    imports=[]
    for m in IMPORT.finditer(text):
        target=locate_import(path,m[2])
        imports.append({'symbol':m[1],'specifier':m[2],'path':target,'sourceLine':text[:m.start()].count('\n')+1})
    calls=[]
    for item in imports:
        for m in re.finditer(r'<'+re.escape(item['symbol'])+r'(?=[\s/>])',text):
            depth=0;quote=None;escape=False;end=None
            for i in range(m.end(),len(text)):
                char=text[i]
                if quote:
                    if escape:escape=False
                    elif char=='\\':escape=True
                    elif char==quote:quote=None
                elif char in ['"',"'",'`']:quote=char
                elif char=='{':depth+=1
                elif char=='}':depth-=1
                elif char=='>' and depth==0:end=i+1;break
            if end:calls.append({'symbol':item['symbol'],'path':item['path'],'propsSource':text[m.start():end],'sourceLine':text[:m.start()].count('\n')+1})
    headings=[{'title':m[2].strip(),'line':text[:m.start()].count('\n')+1,'level':len(m[1])} for m in re.finditer(r'^(#{1,6})\s+(.+)$',text,re.M)]
    return {'imports':imports,'calls':calls,'headings':headings,'containsConditions':bool(re.search(r'<Show|\bprops\.|\bexport\b|\?\?',text))}

def build(checkout,tree):
    checkout=Path(checkout);tree=json.loads(Path(tree).read_text())
    if tree.get('truncated'):raise ValueError('A truncated source tree cannot establish a denominator')
    state=subprocess.run(['git','-C',str(checkout),'rev-parse','HEAD','HEAD^{tree}'],capture_output=True,text=True,check=True).stdout.splitlines()
    if len(state)!=2 or state[0]!=REVISION:raise ValueError('Checkout HEAD does not match the pinned source revision')
    # Some source adapters return the requested commit ref in sha; native GitHub
    # tree objects identify the root tree. Both must be tied to this exact HEAD.
    if tree.get('sha') not in {REVISION,state[1]}:raise ValueError('Source tree is not tied to the pinned checkout revision')
    blobs={e['path']:e['sha'] for e in tree['tree'] if e['type']=='blob'}
    sidebar_path='docusaurus/sidebars/dxl.ts';sidebar_bytes=(checkout/sidebar_path).read_bytes()
    if hashlib.sha1(b'blob '+str(len(sidebar_bytes)).encode()+b'\0'+sidebar_bytes).hexdigest()!=blobs[sidebar_path]:raise ValueError('Sidebar differs from pinned source')
    sidebar_labels={m[1]:m[2] for m in re.finditer(r"doc\('([^']+)',\s*'([^']+)'\)",sidebar_bytes.decode())}
    files={}
    for path,sha in blobs.items():
        if ((path.startswith(PREFIX) or path.startswith(EXTRA)) and path.endswith(('.mdx','.md'))) or path=='docusaurus/src/components/Show/index.tsx':
            data=(checkout/path).read_bytes()
            if hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()!=sha:raise ValueError('Source checkout differs from pinned tree: '+path)
            files[path]={'blobSha':sha,**metadata(path,data.decode())}
    for source in files.values():
        for item in source['imports']:
            target=item['path']
            if target not in files and target and target+'/index.tsx' in files:item['path']=target+'/index.tsx'
        for call in source['calls']:
            target=call['path']
            if target not in files and target and target+'/index.tsx' in files:call['path']=target+'/index.tsx'
    models=[];indexes=[]
    extra_aliases={'ax-12a':['AX-12','AX-12+','AX-12A'],'ax-18a':['AX-18F','AX-18A'],'xl320':['XL-320','XL320']}
    for path,meta in sorted(files.items()):
        if not path.startswith(MODEL):continue
        p=Path(path);relative=path[len(MODEL):]
        if p.stem in [p.parent.name,'model_reference']:
            indexes.append(path);continue
        title=next((h['title'] for h in meta['headings'] if h['level']==1),p.stem)
        aliases={p.stem.upper(),title,*extra_aliases.get(p.stem,[])}
        if relative.startswith('mx_series/') and p.stem.endswith('-2'):aliases.add(p.stem[:-2].upper())
        sidebar_label=sidebar_labels.get('dxl/model_reference/'+relative[:-4])
        if sidebar_label:
            aliases.add(sidebar_label)
            mx=re.match(r'^(MX-\d+)([A-Z/]+)(.*)$',sidebar_label)
            if mx:
                for suffix in mx[2].split('/'):aliases.add(mx[1]+suffix);aliases.add(mx[1]+suffix+mx[3])
            interface=re.match(r'^(.*-)(T|R)/(T|R)$',sidebar_label)
            if interface:aliases.update([interface[1]+interface[2],interface[1]+interface[3]])
        # Hardware suffixes may name the same product document. Original and
        # Protocol-2 firmware documents remain separate, even with shared aliases.
        aliases.update(re.findall(r'\b(?:AX|DX|EX|MX|RX|XC|XD|XH|XL|XM|XW|YM|PH|PM|DYD|[HML]\d)[A-Z0-9+_.-]*',title))
        generation='protocol-2 firmware' if p.stem.endswith('-2') and relative.startswith('mx_series/') else 'model-specific; inspect firmware notes'
        if relative.startswith('pro_series/'):generation='R(A)' if p.stem.endswith('-ra') else 'R; inspect exact revision'
        closure=set();unresolved=set()
        def visit(source):
            for item in files[source]['imports']:
                target=item['path']
                if target in files and target not in closure:closure.add(target);visit(target)
                elif target not in files:unresolved.add(item['specifier'])
        visit(path)
        models.append({'id':relative[:-4],'title':title,'aliases':sorted(aliases),'sidebarLabel':sidebar_label,'aliasEvidence':{'modelSource':path,'sidebarSource':sidebar_path if sidebar_label else None,'sidebarBlobSha':blobs[sidebar_path] if sidebar_label else None},'family':relative.split('/')[0],'kind':'mechanical-reducer' if relative.startswith('dyd/') else 'actuator','generation':generation,'sourcePath':path,'sourceUrl':f'https://github.com/ROBOTIS-GIT/docs/blob/{REVISION}/{path}','canonicalCandidateUrl':'https://docs.robotis.com/docs/dxl/model_reference/'+relative[:-4]+'/','websiteRetrieval':'not asserted by source indexing','sourceTopics':meta['headings'],'componentPaths':sorted(closure),'unresolvedImports':sorted(unresolved),'coverage':{'catalogIndexed':True,'sourceGraphIndexed':True,'conditionsRendered':False,'allFeatureClaimsSemanticallyVerified':False,'hardwareExecution':'separate source-bound named-capability conditions'}})
    summary={'modelReferenceDocuments':len(models)+len(indexes),'indexDocuments':len(indexes),'productDocuments':len(models),'actuatorDocuments':sum(m['kind']=='actuator' for m in models),'mechanicalReducerDocuments':sum(m['kind']=='mechanical-reducer' for m in models),'sharedPartialDocuments':sum('/_partials/' in p for p in files),'actuatorDocumentsByFamily':dict(sorted(Counter(m['family'] for m in models if m['kind']=='actuator').items()))}
    assert summary['modelReferenceDocuments']==103 and summary['productDocuments']==92 and summary['actuatorDocuments']==89 and summary['mechanicalReducerDocuments']==3 and summary['sharedPartialDocuments']==463,summary
    guides=[{'id':p,'title':next((h['title'] for h in meta['headings'] if h['level']==1),Path(p).stem),'sourcePath':p,'sourceUrl':f'https://github.com/ROBOTIS-GIT/docs/blob/{REVISION}/{p}'} for p,meta in files.items() if not p.startswith(MODEL) and '/_partials/' not in p and p.endswith('.mdx')]
    return {'schemaVersion':1,'repository':'ROBOTIS-GIT/docs','revision':REVISION,'sourceProvenance':{'checkoutHead':state[0],'checkoutRootTree':state[1],'treeResponseSha':tree['sha'],'sidebarBlobSha':blobs[sidebar_path],'sidebarProductDocuments':sum(m['sidebarLabel'] is not None for m in models)},'inventoryBasis':'Full non-truncated English source tree; includes source-only/orphan product pages. Counts are documents, not every physical variant. Shared MDX is not rendered or blindly concatenated.','summary':summary,'models':models,'guides':guides,'files':files,'indexDocuments':indexes,'licenseBoundary':'Source location metadata only. Manual source is read on demand with citations; no full-document corpus is bundled and no redistribution license is invented.'}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('checkout');p.add_argument('tree');p.add_argument('output');a=p.parse_args()
    data=build(a.checkout,a.tree);Path(a.output).write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(data['summary'],indent=2))
