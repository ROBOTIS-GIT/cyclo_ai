"""Resolve raw item contracts from verified, model-context official descriptions.

Rules describe storage validity separately from effectiveness/unit conversion.
Source omissions and contradictions remain explicit, with per-value safe subsets.
"""
import copy,json,re
from pathlib import Path
from control_source import Sources,plain,numeric_range,dynamic_range,normalized,render
ROOT=Path(__file__).resolve().parents[1]

def numbers(s):return [int(v.replace(',',''),0) if v.lower().startswith('0x') else int(v.replace(',','')) for v in re.findall(r'-?0x[0-9a-fA-F]+|-?\d[\d,]*',s)]
def description_bounds(text):
    found=[]
    for line in text.splitlines():
        if not line.startswith('|'):continue
        for cell in line.strip().strip('|').split('|'):
            cleaned=re.sub(r'(?<=\d)\s*\([^)]*\)','',plain(cell));cleaned=re.sub(r'(?<=\d)\s*\[[^\]]*\]','',cleaned);r=numeric_range(cleaned)
            if not r:
                match=re.search(r'(?<![\d.])(-?[\d,]+)\s*~\s*(-?[\d,]+)(?![\d.])',plain(cell))
                if match:r=[int(x.replace(',','')) for x in match.groups()]
            if r:found.append(r)
    if not found:
        for match in re.finditer(r'(-?0x[0-9a-fA-F]+|-?[\d,]+)\s*(?:~|to)\s*(-?0x[0-9a-fA-F]+|-?[\d,]+)',plain(text)):
            a,b=(int(v.replace(',',''),0)if 'x'in v.lower()else int(v.replace(',',''))for v in match.groups());found.append([a,b])
    return found

def enum_values(text):
    values=[];header=False
    for line in text.splitlines():
        if not line.startswith('|'):header=False;continue
        cells=[plain(x) for x in line.strip().strip('|').split('|')]
        if cells and cells[0].lower() in ['value','values','data value']:header=True;continue
        if not header or len(cells)<2:continue
        m=re.fullmatch(r'(\d+)(?:\s*\([^)]*\))?',cells[0])
        if m:values.append(int(m[1]))
    return sorted(set(values))

def bit_mask(text):
    mask=0;found=False
    for line in text.splitlines():
        if not line.startswith('|'):continue
        cells=[plain(x)for x in line.strip().strip('|').split('|')]
        if len(cells)<2:continue
        m=re.search(r'Bit\s*(\d+)\b',cells[0],re.I)
        if not m:continue
        if cells[1] in ['','-'] or re.search('unused|reserved|not used',line,re.I):continue
        bit=int(m[1]);mask|=1<<bit;found=True
    return mask if found else None

def intersect(a,b):return [max(a[0],b[0]),min(a[1],b[1])]

def expand_slots(model):
    items=model['items'];new=[]
    for prefix in ['Indirect Address ','Indirect Data ']:
        anchors=sorted([(int(i['name'][len(prefix):]),i)for i in items if i['name'].startswith(prefix) and i['name'][len(prefix):].isdigit()])
        for (a,left),(b,right)in zip(anchors,anchors[1:]):
            if b-a<=1 or left['width']!=right['width'] or right['address']-left['address']!=(b-a)*left['width'] or left['access']!=right['access']:continue
            for n in range(a+1,b):
                item=copy.deepcopy(left);item['name']=prefix+str(n);item['address']=left['address']+(n-a)*left['width'];item['key']=f'{item["name"]}@{item["address"]}';item['expandedFrom']=[left['source'],right['source']];item['rawCells']={**item['rawCells'],'name':item['name'],'address':str(item['address'])};new.append(item)
    model['items']=sorted(items+new,key=lambda i:i['address']);return len(new)

def enrich(inventory,catalog,index,cache):
    src=Sources(cache,index);legacy=json.loads((ROOT/'references/control-item-facts.json').read_text());facts=legacy['shared'];inline=legacy['inline'];stats={};expanded=0
    supplements=json.loads((ROOT/'references/control-source-supplements.json').read_text())
    for proof in supplements['sources']:
        import hashlib
        f=Path(cache)/'_official'/proof['repository']/proof['revision']/proof['path'];b=f.read_bytes()
        if hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()!=proof['blobSha']:raise ValueError('Supplemental official source hash mismatch')
    for entry in inventory['models']:
        m=next(x for x in catalog['models']if x['catalogId']==entry['catalogId']);doc=next(x for x in index['models']if x['id']==m['catalogId']);path=doc['sourcePath'];components={c['path'] for c in index['files'][path]['calls'] if c['path'] in index['files']};allitems=entry['items'];base=[p for p in components if p.endswith(('/control_table.mdx','/control_table_proa.mdx','/y_control_table.mdx','/y_y_control_table.mdx'))]
        legacy_contract='docusaurus/docs/dxl/_partials/ax/control_table.mdx'in components
        expanded+=expand_slots(entry);allitems=entry['items']
        def canonical(expr):
            if 'address'in expr:
                matches=[i for i in allitems if i['address']==expr['address'] and not i['name'].startswith('Indirect ')]
                if len(matches)==1:return {**expr,'item':matches[0]['name']}
            return expr
        for item in allitems:
            if item['access']=='R':continue
            name=item['name'];old=item['write'];description,evidence,unknown=src.section(path,item)
            if not evidence:evidence=[item['source']]
            # Existing item policies provide reviewed facts, but old convenience
            # policy restrictions must not become raw storage restrictions.
            rule={'status':'unresolved','reason':'Raw range or specific item condition requires further source resolution'}
            raw=item['rawCells'].get('range','');bounds=item.get('range') or numeric_range(raw);encoding=item.get('encoding','unresolved');vals=enum_values(description);mask=bit_mask(description);dyn=dynamic_range(raw)
            applicable=[];warnings=[];conflicts=[]
            explicit=description_bounds(description)
            if bounds and explicit and name not in ['Goal Position','Profile Acceleration','Profile Velocity']:
                # Only unambiguous same-domain description ranges are intersected.
                relevant=[b for b in explicit if b[0]>=bounds[0] and b[1]<=bounds[1]]
                if len({tuple(b)for b in relevant})==1:
                    proven=relevant[0]
                    if proven!=bounds:conflicts.append({'table':bounds,'description':proven,'policy':'documented common subset'});bounds=intersect(bounds,proven)
            if not bounds and len({tuple(b)for b in explicit})==1:bounds=explicit[0]
            if not dyn:
                exprs=[]
                for line in description.splitlines():
                    if line.startswith('|'):
                        for cell in line.strip().strip('|').split('|'):
                            value=dynamic_range(cell)
                            if value:exprs.append(value)
                unique={json.dumps(x,sort_keys=True):x for x in exprs}
                if len(unique)==1:dyn=next(iter(unique.values()))
            if dyn:
                dyn={k:canonical(v)for k,v in dyn.items()};
                if all('constant'in v for v in dyn.values()):bounds=[dyn['lower']['constant'],dyn['upper']['constant']] if not bounds else intersect(bounds,[dyn['lower']['constant'],dyn['upper']['constant']])
                encoding='twos-complement' if dyn['lower'].get('sign')==-1 else 'unsigned'
            # Apply shared factual statements only at actual source callers.
            for fact in facts:
                if name not in fact.get('names',[]):continue
                fs=[s for s in fact['sources']if s['path'] in components]
                if not fs:continue
                if 'bounds'in fact and 'modeRules'not in fact:
                    b=fact['bounds'];bounds=intersect(bounds,b) if bounds else b;encoding=fact.get('encoding','unsigned')
                if 'values'in fact:vals=fact['values'];encoding='unsigned'
                if 'allowedMask'in fact:mask=fact['allowedMask'];bounds=[0,mask]
                if 'safeNonnegativeRawBounds'in fact and encoding.startswith('signed-16-documentation'):bounds=fact['safeNonnegativeRawBounds'];encoding='unsigned'
                evidence.extend(fs);warnings+=fact.get('effects',[])
            for fact in inline:
                if fact.get('catalogId')!=m['catalogId'] or fact.get('item')!=name:continue
                if fact.get('bounds') is not None:bounds=intersect(bounds,fact['bounds']) if bounds else fact['bounds']
                if fact.get('values') is not None:vals=fact['values']
                if fact.get('encoding')in ['unsigned','twos-complement']:encoding=fact['encoding']
                if fact.get('manufacturerDirective'):warnings.append(fact['manufacturerDirective'])
                if fact.get('source'):evidence.append(fact['source'])
            if vals and name not in ['Profile Acceleration','Profile Velocity']:
                bounds=[min(vals),max(vals)];encoding='unsigned'
            if mask is not None:bounds=[0,mask];encoding='unsigned'
            if bounds and encoding=='unresolved':encoding='twos-complement'if bounds[0]<0 else 'unsigned'
            if bounds and bounds[0]>bounds[1]:bounds=None;conflicts.append({'policy':'No nonempty numeric common subset'})
            # Universal scalar path: source-known bounds/access and documented
            # memory prerequisites. Units are optional for exact raw writes.
            if (bounds or dyn or vals or mask is not None) and item['memory']in ['EEPROM','RAM','Hybrid']:
                rule={'status':'resolved','kind':'direct','encoding':encoding if encoding in ['unsigned','twos-complement']else 'unsigned','bounds':bounds,'requiresTorqueOff':item['memory']=='EEPROM'and not legacy_contract,'requiresLockZero':item['memory']=='EEPROM'and'Lock'in m['registers'],'sources':evidence,'warnings':warnings}
                if dyn:rule['rangeExpressions']=dyn
                if vals:rule['values']=vals
                if mask is not None:rule['allowedMask']=mask
                if conflicts:rule['sourceConflicts']=conflicts
                # Source conditions on register availability, not display-only
                # firmware LED notes. Shared-bit gates are separately represented.
                if name not in ['Drive Mode','Shutdown','Profile Acceleration','Profile Velocity']:
                    fw=re.findall(r'(?:available|supported)\s+(?:from|since)\s+(?:the\s+)?(?:\*\*|<strong>)*firmware\s+(?:version\s*)?V?(\d+)',plain(description),re.I)
                    if fw:rule['minimumFirmware']=max(map(int,fw))
            if name in ['ID','Baud Rate']:
                rule={**old,'requiresTorqueOff':item['memory']=='EEPROM'and not legacy_contract,'requiresLockZero':item['memory']=='EEPROM'and'Lock'in m['registers']}
            if name=='Status Return Level':rule.update(status='resolved',kind='return-level',encoding='unsigned',bounds=[0,2],values=[0,1,2],warnings=warnings+['0 suppresses READ/WRITE replies; 1 suppresses WRITE replies. Tx-only is used when appropriate; no automatic restore/retry.'])
            if name=='Protocol Type':
                rawvalues=m['protocols'];rule.update(status='resolved',kind='protocol-transition',encoding='unsigned',bounds=[min(rawvalues),max(rawvalues)],values=rawvalues,warnings=warnings+['Changing protocol changes communication; only the selected endpoint is reidentified on the requested protocol.'])
            if name in ['Secondary ID','Secondary(Shadow) ID']:
                rule.update(status='resolved',kind='direct',encoding='unsigned',bounds=[0,255],values=None,warnings=warnings+['253..255 disable the secondary address. Group listeners suppress replies; verify unique primary/destination addressing. No group write is inferred.'])
                rule.pop('rangeExpressions',None)
            if name=='Lock':rule.update(status='resolved',kind='direct',encoding='unsigned',bounds=[0,1],values=[0,1],requiresTorqueOff=False,requiresLockZero=False,latch={'item':'Lock','lockedValue':1,'cannotWrite':0},warnings=warnings+['1 latches EEPROM lock until power cycle; no automatic unlock or power cycle.'])
            if name=='Hybrid Save':rule.update(status='resolved',kind='direct',encoding='unsigned',bounds=[1,1],values=[1],requiresTorqueOff=True,warnings=warnings+['Only 1 is a save request; 0/2 are status values. Explicit save may persist Hybrid fields; no implicit save is issued.'])
            if name.startswith('External Port Data '):
                port=name.rsplit(' ',1)[1];rule.update(status='resolved',kind='direct',encoding='unsigned',bounds=[0,1],values=[0,1],requiresTorqueOff=False,requiresItems={f'External Port Mode {port}':[1]},warnings=['Writable only when the corresponding port is configured as digital output. No port mode is changed automatically.'])
            if name.startswith('Indirect Address '):
                rule.update(status='resolved',kind='indirect-map',encoding='unsigned',bounds=bounds,sources=evidence,warnings=['Only the mapping item is written; destination access/width/range is inherited when writing Indirect Data.'])
                if not bounds:rule={'status':'unresolved','reason':'Indirect mapping domain not established','sources':evidence}
            if name.startswith('Indirect Data '):rule={'status':'resolved','kind':'indirect-data','encoding':'unsigned','bounds':[0,255],'requiresTorqueOff':False,'sources':evidence,'warnings':['Alias writes resolve the current mapping and inherit the complete destination item contract.']}
            if name.startswith('Goal ') or name in ['Moving Speed']:
                if 'Bus Watchdog'in m['registers']:rule['forbiddenRawStates']={'Bus Watchdog':[255]}
                if any('/_partials/y/'in p for p in components):rule['forbiddenStates']={'Controller State':[4,6]}
                rule.setdefault('warnings',[]).append('A raw stored value is not evidence of movement. The item may be inactive/ignored in the current mode; no torque/mode change is implicit.')
            # Keep compiler gaps visible until the special condition evaluator is
            # populated; no whole-register default based only on byte width.
            item['encoding']=rule.get('encoding',encoding);item['range']=rule.get('bounds',bounds);item['write']=rule
            if 'expandedFrom'in item:item['readStatus']='resolved-raw'
        from specialize_control_items import specialize
        specialize(entry,m,doc,index,src,legacy,supplements)
        base_evidence=[{'path':p,'line':1,'blobSha':index['files'][p]['blobSha']}for p in base]
        for item in entry['items']:
            if item['write']['status']=='resolved':
                proofs=item['write'].get('sources',[])+base_evidence
                item['write']['sources']=list({json.dumps(p,sort_keys=True):p for p in proofs}.values())
    inventory['summary']['sourceTableRows']=inventory['summary']['tableRows'];inventory['summary']['expandedIndirectRows']=expanded
    inventory['summary']['tableRows']=sum(len(m['items'])for m in inventory['models']);inventory['summary']['readableRawRows']=sum(i['readStatus']=='resolved-raw'for m in inventory['models']for i in m['items']);inventory['summary']['resolvedWritableRows']=sum(i['write']['status']=='resolved'for m in inventory['models']for i in m['items']);inventory['summary']['unresolvedWritableRows']=sum(i['access']in ['RW','R/RW']and i['write']['status']!='resolved'for m in inventory['models']for i in m['items'])
    return inventory
