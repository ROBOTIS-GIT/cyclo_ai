"""Compile factual, typed configuration metadata from pinned official MDX tables.

No MDX execution and no runtime prose-to-write conversion. Unsupported semantics
remain explicit capability failures. Regenerate offline from the pinned checkout.
"""
import argparse,hashlib,html,json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def plain(s):
    s=re.sub(r'<sup>.*?</sup>','',s)
    s=re.sub(r'\[([^\]]+)\]\([^)]*\)',r'\1',s)
    return html.unescape(re.sub(r'<[^>]+>',' ',s)).replace('\\','').replace('*','').replace('_','').strip()
def number(s):
    s=plain(s).replace(',','')
    return int(s) if re.fullmatch(r'\d+',s) else None
def rate(s):
    s=plain(s).replace(',','').replace('[bps]','').replace('bps','').strip()
    m=re.fullmatch(r'(\d+(?:\.\d+)?)\s*([MK]?)',s,re.I)
    return round(float(m[1])*{'':1,'k':1000,'m':1000000}[m[2].lower()]) if m else None
def tables(text):
    headers=None;memory=None
    for line,l in enumerate(text.splitlines(),1):
        if l.startswith('#'):
            headers=None
            if 'EEPROM' in l:memory='EEPROM'
            elif 'RAM' in l:memory='RAM'
        if not l.startswith('|'):headers=None;continue
        cells=[s.strip() for s in l.strip().strip('|').split('|')]
        if any('Address'==plain(c) for c in cells) and any('Size' in plain(c) for c in cells):headers=[plain(c).lower().replace(' ','') for c in cells];continue
        if not headers or len(headers)!=len(cells) or number(cells[0]) is None:continue
        row=dict(zip(headers,cells));name=next((row[k] for k in row if k in ['dataname','name']),None)
        if name is None:continue
        size=next((number(v) for k,v in row.items() if k.startswith('size')),None)
        if size not in [1,2,4]:continue
        access=plain(row.get('access',''))
        if access not in ['R','RW']:continue
        initial=next((v for k,v in row.items() if k.startswith('initial')),None)
        rawrange=row.get('range')
        if rawrange is None and 'min' in row and 'max' in row:rawrange=row['min']+' ~ '+row['max']
        name=plain(name);name='Baud Rate' if name=='Baud Rate (Bus)' else name;bounds=re.fullmatch(r'(-?[\d,]+)\s*~\s*(-?[\d,]+)',plain(rawrange or ''))
        bounds=[int(x.replace(',','')) for x in bounds.groups()] if bounds else None
        yield {'name':name,'address':number(cells[0]),'width':size,'access':access,'memory':plain(row.get('area',memory or 'unresolved')),'initial':plain(initial or ''),'rawRange':plain(rawrange or ''),'rawUnit':plain(row.get('unit','')),'range':bounds,'encoding':'twos-complement' if bounds and bounds[0]<0 else 'unsigned' if bounds else 'unresolved','unit':plain(row.get('unit','')) or None,'scale':None,'enums':None,'conditions':'Unresolved outside the named capability semantic template; never a raw-write grant','sourceLine':line}

def build(checkout):
    idx=json.loads((ROOT/'references/dynamixel-docs.json').read_text());files=idx['files'];models=[]
    def source(path):
        b=(checkout/path).read_bytes();assert hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()==files[path]['blobSha'],path
        return b.decode()
    def evidence(path,line=1):return {'path':path,'line':line,'blobSha':files[path]['blobSha']}
    for model in idx['models']:
        if model['kind']!='actuator':
            models.append({'catalogId':model['id'],'name':model['title'],'kind':model['kind'],'modelNumbers':[],'capabilities':{},'reason':'Mechanical reducer; no serial actuator identity'});continue
        path=model['sourcePath'];text=source(path);rows=list(tables(text));regs={}
        for r in rows:
            r['source']=evidence(path,r.pop('sourceLine'));regs[r['name']]=r
        required=['Model Number','Firmware Version','ID','Baud Rate','Torque Enable']
        assert all(k in regs for k in required),(path,[k for k in required if k not in regs])
        ids=[int(x.replace(',','')) for x in re.findall(r'\b\d[\d,]*',regs['Model Number']['initial'])]
        # Y explicitly publishes separate identities for Modbus firmware.
        modbus=[]
        if 'Modbus' in regs['Model Number']['rawRange']:
            raw=regs['Model Number']['rawRange'];dxl=re.search(r'([\d,]+)\s*\(Dynamixel Protocol 2.0\)',raw,re.I);mb=re.search(r'([\d,]+)\s*\(Modbus\)',raw,re.I)
            assert dxl and mb,path
            ids=[int(dxl[1].replace(',',''))];modbus=[int(mb[1].replace(',',''))]
        assert ids and all(0<n<65536 for n in ids),path
        # Numeric, explicitly documented rows; protocol mode never chooses table generation.
        protocol=regs.get('Protocol Type');prange=protocol['rawRange'] if protocol else ''
        if protocol:
            protocols=[1,2] if prange in ['1 ~ 2','1, 2'] else [2];protocol_evidence=[protocol['source']]
            if not prange:
                ps=[p for p in model['componentPaths'] if 'protocolversion' in p]
                pt='\n'.join(source(p) for p in ps)
                assert re.search(r'^\|\s*1\s*\|\s*DYNAMIXEL Protocol 1.0',pt,re.M),path
                protocols=[1,2];protocol_evidence.extend(evidence(p) for p in ps)
        else:
            bases=[p for p in model['componentPaths'] if p.endswith(('/control_table.mdx','/control_table_proa.mdx'))]
            base_text=' '.join(line for p in bases for line in source(p).splitlines() if not line.startswith('['))
            if 'DYNAMIXEL Protocol 1.0' in base_text and 'DYNAMIXEL Protocol 2.0' not in base_text:protocols=[1]
            elif 'DYNAMIXEL Protocol 2.0' in base_text and 'DYNAMIXEL Protocol 1.0' not in base_text:protocols=[2]
            else:
                compat='docusaurus/docs/dxl/protocol/faq_protocol_compatibility_table.mdx';ct=source(compat)
                label=model['id'].split('/')[-1].replace('xl320','xl-320').upper()
                cr=next((l for l in ct.splitlines() if l.startswith('|') and plain(l.split('|')[1]).upper()==label),None)
                assert cr,(path,'Protocol evidence unresolved')
                cc=cr.split('|');protocols=[p for p in [1,2] if plain(cc[p+1]).startswith('O')]
                assert protocols,path
                bases=[compat]
            protocol_evidence=[evidence(p) for p in bases]
        baud={};baud_sources=[]
        sources=[path]+[p for p in model['componentPaths'] if 'baud' in p.lower()]
        for bp in sources:
            bt=source(bp);section=bt
            if bp==path:
                match=re.search(r'^####\s+Baud Rate[^\n]*\n(.*?)(?=^####|\Z)',bt,re.M|re.S);section=match[1] if match else ''
            for lineno,line in enumerate(section.splitlines(),1):
                if not line.startswith('|'):continue
                cs=[c.strip() for c in line.strip().strip('|').split('|')]
                if len(cs)<2:continue
                code=re.match(r'^\s*(\d+)\b',plain(cs[0]));bps=rate(cs[1])
                if code and bps and 0<=int(code[1])<=254:
                    k=str(bps);v=int(code[1]);assert k not in baud or baud[k]==v,(path,k)
                    baud[k]=v
            if baud:baud_sources.append(evidence(bp))
        # Only operation-specific semantic templates with exact source binding.
        dual=any('both' in plain(source(p)).lower() and 'torque' in plain(source(p)).lower() for p in model['componentPaths'] if 'control_table' in p and any(x in p for x in ['2xc','2xl'])) or model['id'].split('/')[-1].startswith(('2xl','2xc'))
        caps={};common={'requiresTorqueOff':True,'firmwarePolicy':'Observed byte required; feature-specific minimums apply. No firmware-number allowlist.','reset':'No reboot/reset is issued; communication changes are immediately reconciled.','persistence':'from register memory; no implicit save command'}
        for op,key in [('id','ID'),('baud','Baud Rate'),('led','LED')]:
            reg=regs.get(key)
            if op=='led' and not reg and all(k in regs for k in ['LED Red','LED Green','LED Blue']):
                caps[op]={**common,'status':'resolved','channels':['LED Red','LED Green','LED Blue'],'values':[0,1],'requiresExplicitColor':True,'onRaw':255,'reason':'Boolean on sets red; off clears all RGB channels. Explicit RGB values are separate.'};continue
            valid=reg and reg['access']=='RW' and reg['memory'] in ['EEPROM','RAM','Hybrid']
            caps[op]={**common,'status':'resolved' if valid and (op!='baud' or baud) else 'unsupported' if not reg else 'unresolved','register':key,'reason':'Exact table row and bounded named-operation semantics' if valid else 'Required writable register semantics missing','source':reg['source'] if reg else None}
            if op=='led' and valid:caps[op]['values']=[0,1];caps[op]['onRaw']=1;caps[op]['colorMask']=reg['range']==[0,7]
        profile={'status':'unsupported' if not all(k in regs for k in ['Profile Acceleration','Profile Velocity']) else 'unresolved','reason':'Profile registers absent' if not all(k in regs for k in ['Profile Acceleration','Profile Velocity']) else 'Exact profile units, addresses or conditional description conflict remain unresolved; related speed/goal fields are never substituted'}
        calls=files[path]['calls'];pcall=next((c for c in calls if c['path'].endswith(('/control_table_profile_acceleration.mdx','/profile_acceleration.mdx'))),None)
        if pcall and '/_partials/' in pcall['path'] and any('/'+x+'/' in pcall['path'] for x in ['x','mx2']):
            drivecall=next((c for c in calls if any(c['path'].endswith('/'+n) for n in ['control_table_drivemode.mdx','control_table_drivemode_x540.mdx','control_table_drivemode_mx106_2.mdx','drive_mode.mdx'])),None)
            if drivecall:
                dtext=source(drivecall['path']);atext=source(pcall['path']);assert '214.577' in atext and '32737' in atext and '0x04' in dtext
                props=drivecall['propsSource'];since=re.search(r'since=\{(\d+)\}',props);time_fw=0 if 'timeBasedNote={false}' in props else 42
                modepaths=[c['path'] for c in calls if 'opmode' in c['path'] or 'operating_mode' in c['path']]
                mode_text='\n'.join(source(p) for p in modepaths)
                vcall=next((c for c in calls if c['path'].endswith(('/control_table_profile_velocity.mdx','/profile_velocity.mdx'))),None)
                assert vcall,path
                vt=source(vcall['path']);vp=vcall['propsSource']
                if 'props.currentBased === false' in vt:current_based='currentBased={false}' not in vp
                elif 'props.currentBased ?' in vt:current_based=bool(re.search(r'\bcurrentBased(?:\s|/|>)',vp) or 'currentBased={true}' in vp)
                else:current_based=False
                modes=[3,4]+([5] if current_based and re.search(r'^\|\s*5\s*\|[^\n]*Current',mode_text,re.M) else [])
                time_fw=max(time_fw,0 if 'fwNote={false}' in pcall['propsSource'] else 42,0 if 'fwNote={false}' in vp else 42)
                profile={**common,'status':'resolved','kind':'shared-x-position-profile','registers':['Profile Acceleration','Profile Velocity'],'velocityScale':0.229,'accelerationScale':214.577,'velocityUnit':'rpm','accelerationUnit':'rpm/min','velocityRange':[1,32767],'accelerationRange':[1,32767],'timeRange':[2,32737],'timeAccelerationRange':[1,32737],'timeScaleMs':1,'operatingModes':modes,'driveRegister':'Drive Mode','profileBit':4,'forbiddenDriveBits':8,'allowedDriveMask':7 if 'mx106_2' in drivecall['path'] else 13,'driveMinimumFirmware':int(since[1]) if since else 0,'timeMinimumFirmware':time_fw,'sources':[evidence(pcall['path']),evidence(drivecall['path']),evidence(vcall['path'])]+[evidence(p) for p in modepaths]}
        for op,c in caps.items():
            c['semantics']={'encoding':'unsigned','scale':1,'unit':'ID' if op=='id' else 'baud enum' if op=='baud' else 'LED mask or intensity','range':[0,252] if op=='id' else [0,255] if c.get('channels') else [0,7] if c.get('colorMask') else [0,1] if op=='led' else None,'enums':baud if op=='baud' else None,'access':'RW','torque':'Must already be off on every explicitly bound axis','modeChange':'Prohibited'}
        caps['profile']=profile
        models.append({'catalogId':model['id'],'name':model['title'],'family':model['family'],'kind':'actuator','modelNumbers':ids,'modbusModelNumbers':modbus,'protocols':protocols,'protocolSources':protocol_evidence,'dualAxis':dual,'registers':regs,'bauds':baud,'baudSources':baud_sources,'capabilities':caps,'source':evidence(path),'sourceUrl':model['sourceUrl'],'limits':'Typed source extraction is not physical-device certification. Unresolved capability conditions block that capability, not model identity.'})
    return {'schemaVersion':1,'version':'0.8.0','revision':idx['revision'],'sourceProvenance':idx['sourceProvenance'],'compiler':'scripts/compile_control_tables.py','policy':'Build-time typed metadata only. Runtime retrieved prose never grants writes. Same resolver for every catalog entry.','models':models,'summary':{'actuatorDocuments':sum(m['kind']=='actuator' for m in models),'mechanicalDocuments':sum(m['kind']!='actuator' for m in models)}}
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('checkout',type=Path);p.add_argument('--output',type=Path,default=ROOT/'references/control-tables.json');a=p.parse_args();out=build(a.checkout);a.output.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n');print(json.dumps(out['summary']))
