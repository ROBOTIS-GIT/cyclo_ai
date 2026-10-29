"""Convert a local manufacturer XML plus reviewed rules to a custom profile.

Offline only. XML RW attributes never automatically grant executable writes.
"""
import argparse, hashlib, json, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'modules/dynamixel'))
from custom_tables import load_custom

def convert(xml, *, catalog_id, name, model, firmwares, protocol, bauds, review):
    xml=Path(xml).resolve();data=xml.read_bytes()
    text=data.decode('utf-8-sig')
    if len(data)>4*1024*1024 or '\x00'in text or '<!DOCTYPE'in text.upper()or '<!ENTITY'in text.upper(): raise ValueError('XML DTD/entities and oversized tables are not accepted')
    root=ET.fromstring(text);items=[];seen=set()
    if 'ModelNumber'in root.attrib and int(root.attrib['ModelNumber'])!=model:raise ValueError('XML model number does not match the requested profile')
    scope=root.find('ControlItems')
    if scope is None:scope=root
    parents={child:parent for parent in scope.iter()for child in parent}
    expanded=[]
    for element in scope.iter('Item'):
        a=element.attrib
        if 'Continue'in a:
            match=re.fullmatch(r'(\d+)~(\d+)',a['Continue'])
            parent=parents[element]
            if not match or a.get('Name')!='{0}'or parent.tag!='Category'or not parent.attrib.get('Name'):raise ValueError('Unresolved XML sequence template')
            lo,hi=map(int,match.groups())
            if not 0<=lo<=hi<=4096 or hi-lo>=4096:raise ValueError('XML sequence exceeds bound')
            for index in range(lo,hi+1):
                expanded.append({**a,'Name':parent.attrib['Name']+' '+str(index),'Address':str(int(a['Address'])+(index-lo)*int(a['Length']))})
        else:expanded.append(dict(a))
    if len(expanded)>4096:raise ValueError('Expanded XML item count exceeds bound')
    for a in expanded:
        if not {'Address','Length','Name','RW','Memory'}<=set(a): raise ValueError('XML Item lacks address/length/name/access/memory')
        n=a['Name']
        if n in seen:raise ValueError('Duplicate XML item name; disambiguate the source contract before import')
        seen.add(n);r=review.get(n,{})
        if set(r)-{'canonicalName','encoding','write'}:raise ValueError('Unknown reviewed item fields')
        if a['RW']not in ['1','3']or a['Memory']not in ['1','2','3']:raise ValueError('Unresolved XML access/memory enum')
        # Signed/direction-bit encodings require an explicit reviewed choice.
        minimum=a.get('Min','0')
        encoding=r.get('encoding','unresolved'if 'Sign'in a or not re.fullmatch(r'[0-9]+',minimum)else'unsigned')
        item={'name':r.get('canonicalName',n),'address':int(a['Address']),'width':int(a['Length']),'access':'RW'if a['RW']=='3'else'R','memory':{'1':'EEPROM','2':'RAM','3':'Hybrid'}[a['Memory']],'encoding':encoding}
        if a.get('Unit'):item['unit']=a['Unit']
        if a.get('Scale'):item['scale']=float(a['Scale'])
        if 'write'in r:
            rule=r['write']
            if rule.get('status')=='resolved':
                bounds=rule.get('bounds')
                if not isinstance(bounds,list)or len(bounds)!=2:raise ValueError('Reviewed numeric bounds required')
                for attr,index in [('Min',0),('Max',1)]:
                    if re.fullmatch(r'-?[0-9]+',a.get(attr,'')):
                        if index==0 and bounds[0]<int(a[attr])or index==1 and bounds[1]>int(a[attr]):raise ValueError('Reviewed bounds exceed the XML source range')
            item['write']=rule
        items.append(item)
    if set(review)-seen:raise ValueError('Reviewed rules name an item absent from the XML')
    return {'schemaVersion':1,'models':[{'catalogId':catalog_id,'name':name,'modelNumber':model,'firmwares':firmwares,'protocol':protocol,'bauds':bauds,'source':{'path':str(xml),'sha256':hashlib.sha256(data).hexdigest()},'items':items}]}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('xml',type=Path);p.add_argument('--catalog-id',required=True);p.add_argument('--name',required=True);p.add_argument('--model',required=True,type=int);p.add_argument('--firmware',required=True,type=int,action='append');p.add_argument('--protocol',required=True,type=int,choices=[1,2]);p.add_argument('--bauds',required=True,help='JSON host-baud to register-enum map');p.add_argument('--review',type=Path,help='Reviewed per-name encoding/write rules; omitted RW rows remain unresolved');p.add_argument('--output',required=True,type=Path)
    a=p.parse_args()
    result=convert(a.xml,catalog_id=a.catalog_id,name=a.name,model=a.model,firmwares=a.firmware,protocol=a.protocol,bauds=json.loads(a.bauds),review=json.loads(a.review.read_text())if a.review else{})
    # Exclusive create: never overwrite an existing customer contract.
    with a.output.open('x')as f:json.dump(result,f,indent=2);f.write('\n')
    try:load_custom(a.output)
    except Exception:
        a.output.unlink();raise
    print(json.dumps({'output':str(a.output.resolve()),'models':len(result['models']),'items':len(result['models'][0]['items']),'hardwareAccess':False}))

if __name__=='__main__':main()
