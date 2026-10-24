"""Create a source plugin ZIP, then validate its extracted manifests/references/hashes."""
from pathlib import Path
import hashlib,json,tempfile,zipfile
from validate_package import ROOT,check
version=json.loads((ROOT/'plugin.json').read_text())['version']
out=ROOT/'artifacts'/f'cyclo-plugin-{version}.zip';out.parent.mkdir(exist_ok=True)
def include(p):
 parts=p.relative_to(ROOT).parts
 return not any(x in {'.git','node_modules','artifacts','__pycache__','dist'} or x.startswith('.mock-tests-') for x in parts) and not (p.suffix=='.pyc') and not (p.name.startswith('.env'))
files=[]
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(ROOT.rglob('*')):
  if p.is_file() and include(p):
   assert not p.is_symlink(),str(p)
   z.write(p,Path('ai-sapiens-dev')/p.relative_to(ROOT));files.append(p.relative_to(ROOT))
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 with tempfile.TemporaryDirectory(prefix='cyclo-release-check-') as tmp:
  z.extractall(tmp);extracted=Path(tmp)/'ai-sapiens-dev';check(extracted)
  for p in files:assert (ROOT/p).read_bytes()==(extracted/p).read_bytes()
result={'artifact':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'files':len(files),'zip_crc':'passed','extracted_schema_reference_and_source_hash_checks':'passed','byte_comparison':'passed'}
(ROOT/'artifacts/package-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
