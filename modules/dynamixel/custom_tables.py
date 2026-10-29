"""Offline validation/normalization of operator-owned custom device contracts.

Only JSON data is accepted. No XML entities, imports, executable expressions,
ports, or network requests are evaluated. Both runtime layers use this loader.
"""
import hashlib, json, math, re, sys
from pathlib import Path
from transports import HOST_BAUDS

def integer(v, lo, hi):
    if type(v) is not int or not lo <= v <= hi: raise ValueError('Invalid bounded integer')
    return v

def load_custom(path, reserved=()):
    if not path: return {'models': [], 'itemModels': []}
    path = Path(path).resolve()
    if path.stat().st_size > 4*1024*1024: raise ValueError('Custom table file exceeds 4 MiB')
    data = json.loads(path.read_text())
    if set(data) != {'schemaVersion', 'models'} or type(data['schemaVersion'])is not int or data['schemaVersion'] != 1: raise ValueError('Invalid custom table schema')
    if not isinstance(data['models'], list) or not 1 <= len(data['models']) <= 32: raise ValueError('Provide 1..32 custom models')
    result = {'models': [], 'itemModels': []}; seen = set(reserved)
    for entry in data['models']:
        if set(entry) != {'catalogId','name','modelNumber','firmwares','protocol','bauds','source','items'}: raise ValueError('Unexpected/missing custom model fields')
        key = entry['catalogId']
        if not isinstance(key,str) or not re.fullmatch(r'custom/[a-z0-9][a-z0-9_-]{0,63}',key) or key in seen: raise ValueError('Custom identity must be unique and start with custom/')
        seen.add(key); number=integer(entry['modelNumber'],0,65535); protocol=integer(entry['protocol'],1,2)
        firmwares=entry['firmwares']
        if not isinstance(firmwares,list) or not firmwares or len(firmwares)>256: raise ValueError('Explicit firmware applicability is required')
        for f in firmwares: integer(f,0,255)
        if not isinstance(entry['name'],str) or not entry['name'].strip(): raise ValueError('Model name required')
        source=entry['source']
        if set(source)!={'path','sha256'} or not re.fullmatch('[a-f0-9]{64}',source['sha256']): raise ValueError('Source path/hash required')
        origin=(path.parent/source['path']).resolve()
        if origin.stat().st_size>4*1024*1024 or hashlib.sha256(origin.read_bytes()).hexdigest()!=source['sha256']: raise ValueError('External source hash mismatch')
        source={**source,'path':str(origin),'line':1,'kind':'operator-reviewed custom contract'}
        rates=entry['bauds']
        if not isinstance(rates,dict) or not rates or len(rates)>32: raise ValueError('Explicit baud/enum map required')
        for rate,value in rates.items():
            if not re.fullmatch(r'[0-9]+',rate): raise ValueError('Invalid custom baud')
            integer(int(rate),9600,12000000);integer(value,0,255)
            if int(rate)not in HOST_BAUDS:raise ValueError('Unsupported native host baud')
        if len(set(rates.values()))!=len(rates): raise ValueError('Ambiguous baud enum')
        rows=entry['items']
        if not isinstance(rows,list) or not 1<=len(rows)<=4096: raise ValueError('Custom item count exceeds bound')
        names=set();occupied=set();items=[];registers={}
        allowed={'name','address','width','access','memory','encoding','unit','scale','write'}
        for row in rows:
            if set(row)-allowed or not {'name','address','width','access','memory','encoding'}<=set(row): raise ValueError('Invalid custom item fields')
            name=row['name'];width=integer(row['width'],1,1024);address=integer(row['address'],0,(256 if protocol==1 else 65536)-width)
            if not isinstance(name,str) or not name or len(name)>120 or name in names: raise ValueError('Custom item names must be unique')
            names.add(name);span=set(range(address,address+width))
            if occupied & span: raise ValueError('Overlapping custom registers require an unambiguous contract')
            occupied |= span
            if row['access']not in ['R','RW']or row['memory']not in ['RAM','EEPROM','Hybrid']or row['encoding']not in ['unsigned','twos-complement','unresolved']: raise ValueError('Invalid access/memory/encoding')
            if 'unit'in row and not isinstance(row['unit'],str):raise ValueError('Invalid unit label')
            if 'scale'in row and (type(row['scale'])not in [int,float]or not math.isfinite(row['scale'])or row['scale']<=0): raise ValueError('Invalid physical scale')
            rule=row.get('write',{'status':'manufacturer-unresolved','reason':'No reviewed write contract'})
            if rule.get('status')=='resolved':
                permitted={'status','kind','encoding','bounds','values','requiresTorqueOff','requiresLockZero','requiresItems','forbiddenStates','requiresMode','modes','dynamicLimit','warnings'}
                if set(rule)-permitted: raise ValueError('Unknown custom write condition; never silently ignore rules')
                if name.startswith(('Indirect Data ','Indirect Address ')):raise ValueError('Custom indirect write semantics require alias support')
                if row['access']!='RW'or width not in [1,2,4]or row['encoding']=='unresolved'or rule.get('encoding')!=row['encoding']: raise ValueError('Resolved write requires scalar RW encoding')
                expected={'ID':'id-transition','Baud Rate':'baud-transition','Protocol Type':'protocol-transition','Status Return Level':'return-level'}.get(name,'scalar')
                if rule.get('kind')!=expected: raise ValueError('Custom transition kind does not match item semantics')
                if expected=='protocol-transition': raise ValueError('Custom protocol changes need a separate source contract; not supported by this schema')
                bounds=rule.get('bounds')
                if not isinstance(bounds,list)or len(bounds)!=2: raise ValueError('Reviewed raw bounds required')
                bits=width*8;lo=-(1<<(bits-1))if row['encoding']=='twos-complement'else 0;hi=(1<<(bits-1))-1 if lo<0 else(1<<bits)-1
                integer(bounds[0],lo,hi);integer(bounds[1],bounds[0],hi)
                if 'requiresTorqueOff'not in rule or type(rule['requiresTorqueOff'])is not bool: raise ValueError('Explicit torque precondition required')
                if row['memory']=='EEPROM'and not rule['requiresTorqueOff']: raise ValueError('Custom EEPROM writes require torque already off')
                if 'requiresLockZero'in rule and type(rule['requiresLockZero'])is not bool: raise ValueError('Invalid lock condition')
                if 'values'in rule and (not isinstance(rule['values'],list)or not rule['values']):raise ValueError('Explicit enum values required')
                for n in rule.get('values',[]): integer(n,*bounds)
                for field in ['requiresItems','forbiddenStates']:
                    if field in rule and (not isinstance(rule[field],dict)or any(not isinstance(v,list)or not v or any(type(x)is not int for x in v)for v in rule[field].values())): raise ValueError('Invalid live condition')
                if 'requiresMode'in rule and type(rule['requiresMode'])is not bool:raise ValueError('Invalid mode condition')
                if rule.get('requiresMode') and (not isinstance(rule.get('modes'),list)or not rule['modes']or any(type(v)is not int for v in rule['modes'])): raise ValueError('Explicit modes required')
                if 'warnings'in rule and (not isinstance(rule['warnings'],list)or any(not isinstance(v,str)for v in rule['warnings'])): raise ValueError('Invalid warnings')
                rule={**rule,'sources':[source]}
            elif rule.get('status')!='manufacturer-unresolved': raise ValueError('Invalid custom write resolution')
            item={**row,'key':f'{name}@{address}','readStatus':'resolved-raw','source':source,'write':rule}
            items.append(item)
            registers[name]={'address':address,'width':width,'access':row['access'],'memory':row['memory'],'range':rule.get('bounds'),'source':source}
        required={'Model Number':(0,2),'Firmware Version':None,'ID':None,'Baud Rate':None,'Torque Enable':None}
        for name,position in required.items():
            row=next((i for i in items if i['name']==name),None)
            if not row or row['encoding']!='unsigned'or row['width']not in [1,2]or position and (row['address'],row['width'])!=position: raise ValueError('Explicit identity/torque/baud registers required')
        if len({next(i for i in items if i['name']==n)['width']for n in ['Firmware Version','ID','Baud Rate','Torque Enable']})!=1:raise ValueError('Identity/torque width mismatch')
        if registers['Firmware Version']['width']!=1 or registers['ID']['width']!=1 or registers['Baud Rate']['width']!=1 or registers['Torque Enable']['width']!=1: raise ValueError('Identity/torque scalar width mismatch')
        for item in items:
            rule=item['write'];refs=list(rule.get('requiresItems',{}))+list(rule.get('forbiddenStates',{}))
            if rule.get('requiresMode'): refs.append('Operating Mode')
            if rule.get('dynamicLimit'): refs.append(rule['dynamicLimit'])
            if rule.get('requiresLockZero'): refs.append('Lock')
            if any(n not in names for n in refs): raise ValueError('Missing live condition register')
            if any(i['name']in refs and (i['encoding']=='unresolved'or i['width']not in [1,2,4])for i in items):raise ValueError('Live condition register encoding/width is unresolved')
            if rule.get('kind')=='id-transition'and rule.get('status')=='resolved'and (rule['bounds'][0]!=0 or rule['bounds'][1]>(253 if protocol==1 else 252)): raise ValueError('Invalid custom ID range')
        capabilities={op:{'status':'unsupported','reason':'Use reviewed named table items'}for op in ['id','baud','led','profile']}
        for op,name in [('id','ID'),('baud','Baud Rate'),('led','LED')]:
            row=next((i for i in items if i['name']==name),None)
            if row and row['write']['status']=='resolved': capabilities[op]={'status':'resolved','register':name,'requiresTorqueOff':row['write']['requiresTorqueOff'],**({'onRaw':1}if op=='led'else{})}
        digest=hashlib.sha256(json.dumps(entry,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        result['models'].append({'catalogId':key,'kind':'actuator','name':entry['name'],'modelNumbers':[number],'protocols':[protocol],'dualAxis':False,'customFirmwares':firmwares,'customHash':digest,'registers':registers,'capabilities':capabilities,'bauds':rates,'source':source,'protocolSources':[]})
        result['itemModels'].append({'catalogId':key,'items':items})
    return result

if __name__=='__main__':
    try: print(json.dumps(load_custom(sys.argv[1])))
    except Exception as e: print(str(e),file=sys.stderr);sys.exit(1)
