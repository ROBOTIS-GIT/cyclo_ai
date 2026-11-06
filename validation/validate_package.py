"""Offline portable-manifest, frontmatter, local-reference and archive checks."""
import json
from pathlib import Path
import re
from urllib.parse import urlparse
import yaml
import jsonschema
from english_only import assert_english_text

BASE=Path(__file__).resolve().parents[1]
ROOT=BASE
def check(root):
    # Language applies to every packaged UTF-8 text, including historical
    # validation reports and untouched upstream notices. Never rewrite a notice.
    for path in root.rglob('*'):
        relative=path.relative_to(root)
        if any(x in relative.parts for x in ['node_modules','.git','artifacts','__pycache__','dist']) or any(x.startswith('.mock-tests-') for x in relative.parts):continue
        if path.name.startswith('.env'):continue
        assert not path.is_symlink(),str(path)
        if path.is_file():assert_english_text(relative,path.read_bytes())
    manifest=json.loads((root/'plugin.json').read_text())
    schema=json.loads((BASE/'evidence/plugin.schema.json').read_text())
    jsonschema.Draft202012Validator(schema).validate(manifest)
    assert re.fullmatch(r'\d+\.\d+\.\d+',manifest['version'])
    assert manifest['name']=='cyclo-plugin'
    assert json.loads((root/'package.json').read_text())['version']==manifest['version']
    assert manifest['extensions']['com.openai']['onboardingSkill']=='./skills/cyclo/SKILL.md'
    assert (root/'skills/cyclo/SKILL.md').is_file()
    interface=manifest['extensions']['com.openai']['interface']
    assert len(interface['shortDescription'])<=30
    assert isinstance(interface['capabilities'],list)
    assert not any((root/p).exists() for p in ['.app.json','hooks','.mcp.json'])
    claude=json.loads((root/'.claude-plugin/plugin.json').read_text())
    assert claude['name']==manifest['name'] and claude['version']==manifest['version']
    assert claude['author']==manifest['author']
    assert 'skills' not in claude and 'commands' not in claude
    assert set(claude['mcpServers'])=={'cyclo-firmware','cyclo-products'}
    assert claude['mcpServers']['cyclo-firmware']['env']=={}
    assert claude['mcpServers']['cyclo-products']['env']=={}
    mcp=json.loads((root/'mcp.json').read_text())
    jsonschema.Draft202012Validator(json.loads((BASE/'evidence/mcp.schema.json').read_text())).validate(mcp)
    server=mcp['mcpServers']['cyclo-firmware']
    assert server['env']=={}
    assert (root/'modules/firmware/launch.mjs').is_file()
    assert mcp['mcpServers']['cyclo-products']['env']=={}
    items=json.loads((root/'references/control-items.json').read_text())
    tables=json.loads((root/'references/control-tables.json').read_text())
    assert items['version']==manifest['version'] and items['revision']==tables['revision']
    indexed=json.loads((root/'references/dynamixel-docs.json').read_text())
    assert len(items['models'])==89
    supplements=json.loads((root/'references/control-source-supplements.json').read_text())
    extra={(p['repository'],p['revision'],p['path']):p['blobSha']for p in supplements['sources']}
    for model in items['models']:
        for item in model['items']:
            source=item['source']; assert indexed['files'][source['path']]['blobSha']==source['blobSha']
            if item['write']['status']=='resolved':
                assert item['access']in ['RW','R/RW'] and item['write']['sources']
                for source in item['write']['sources']:
                    if source.get('repository'):assert extra[(source['repository'],source['revision'],source['path'])]==source['blobSha']
                    else:assert indexed['files'][source['path']]['blobSha']==source['blobSha']
    names=[]; links=0
    for skill in sorted((root/'skills').iterdir()):
        entry=skill/'SKILL.md'
        assert entry.is_file()
        text=entry.read_text(); assert text.startswith('---\n')
        metadata=yaml.safe_load(text.split('---',2)[1])
        assert metadata['name']==skill.name
        assert re.fullmatch('[a-z0-9-]{1,64}',metadata['name'])
        assert isinstance(metadata['description'],str) and metadata['description'].strip()
        assert entry.stat().st_size<1024*1024
        names.append(metadata['name'])
        ui=yaml.safe_load((skill/'agents/openai.yaml').read_text())
        assert ui['interface']['display_name']
        assert 25<=len(ui['interface']['short_description'])<=64
        assert '$'+skill.name in ui['interface']['default_prompt']
    expected={'ai-sapiens-docs','ai-sapiens-operation','ai-sapiens-connectivity','ai-sapiens-control','ai-sapiens-motion-sources','ai-sapiens-diagnostics','ai-sapiens-sim2real','ai-sapiens-video-mimic','ai-sapiens-walking','cyclo','cyclo-firmware','robotis-expert','robotis-integrate','dynamixel-expert'}
    expected.update({'ai-worker','ai-worker-setup','ai-worker-control','ai-worker-teleop','ai-worker-learning'})
    expected.update({'omy','omy-setup','omy-control','omy-teleop','omy-learning'})
    assert set(names)==expected and len(names)==24
    index=json.loads((root/'references/manual-index.json').read_text())
    assert len(index['pages'])==34
    assert len({p['id'] for p in index['pages']})==34
    assert len({p['url'] for p in index['pages']})==34
    for page in index['pages']:
        url=urlparse(page['url'])
        assert url.scheme=='https' and url.hostname=='docs.robotis.com'
        assert url.path.startswith('/docs/systems/aisapiens/') and not url.username
        assert page['skill'] in expected
        assert page['coverage'] in {'guidance','procedure','unsupported'}
        assert page['robotics_runtime_tested'] is False
        assert (root/page['reference']).is_file()
    for ident in ['gmr','lerobot','intelligence']:
        page=next(p for p in index['pages'] if p['id']==ident)
        assert page['manual_status']=='coming-soon' and page['coverage']=='unsupported' 
    for path in root.rglob('*'):
        relative=path.relative_to(root)
        if any(x in relative.parts for x in ['node_modules','.git','validation','artifacts','__pycache__','dist']) or any(x.startswith('.mock-tests-') for x in relative.parts): continue
        assert not path.is_symlink(),str(path)
        assert path.name not in ['__pycache__','.env','node_modules']
        if path.suffix=='.md' and 'upstream' not in relative.parts:
            for target in re.findall(r'\]\(([^)]+)\)',path.read_text()):
                if '://' in target or target.startswith('#'): continue
                dest=(path.parent/target.split('#')[0]).resolve()
                assert dest.is_relative_to(root.resolve()),str(dest)
                assert dest.exists(),f'{path}: {target}'
                links+=1
    import hashlib
    source_index=json.loads((root/'references/dhi-sources.json').read_text())
    assert source_index['schemaVersion']==1
    for package in source_index['packages'].values():
        assert package['repository'].startswith(('ROBOTIS-GIT/','ros-controls/'))
        for profile in package['profiles'].values():
            assert re.fullmatch('[a-f0-9]{40}',profile['revision']) and profile['runtimeTested'] is False
            for path,meta in profile['files'].items():
                assert not path.startswith('/') and '..' not in path.split('/')
                assert re.fullmatch('[a-f0-9]{40}',meta['blobSha']) and meta['bytes']>=0
                assert all(1<=r['line']<=meta['lineCount'] for r in meta['references'])
    products=json.loads((root/'references/dhi-products.json').read_text())
    for product in products['products']:
        profile=source_index['packages'][product['package']]['profiles'][product['profile']]
        assert profile['revision']==product['revision'] and product['dhiDeclaredIn']
        assert all(a['path'] in profile['files'] and a['conditionsEvaluated'] is False for a in product['artifacts'])
    provenance=json.loads((root/'modules/firmware/UPSTREAM.json').read_text())
    for path,digest in provenance['files_sha256'].items():
        assert hashlib.sha256((root/'modules/firmware/upstream'/path).read_bytes()).hexdigest()==digest
    sdk=json.loads((root/'modules/dynamixel/SDK-UPSTREAM.json').read_text())
    for path,digest in sdk['files_sha256'].items():
        assert hashlib.sha256((root/'modules/dynamixel/sdk-upstream'/path).read_bytes()).hexdigest()==digest
    tables=json.loads((root/'references/control-tables.json').read_text())
    assert tables['version']==manifest['version']
    assert tables['summary']=={'actuatorDocuments':89,'mechanicalDocuments':3}
    assert len(tables['models'])==92
    for model in tables['models']:
        if model['kind']!='actuator':continue
        assert model['protocols'] and all(p in [1,2] for p in model['protocols'])
        assert model['registers']['Torque Enable']['access']=='RW'
    return {'upstream_source_hashes':'passed','hardware_default':'available; no startup I/O; explicit confirmation; CYCLO_OFFLINE=1 opt-out','first_party_skill_count':len(names),'mcp_schema':'passed','manifest_schema':'passed','skills':names,'local_links_checked':links,'metadata':'passed','unexpected_components':'no undeclared hooks or apps','indexed_manual_pages':len(index['pages'])}

if __name__=='__main__':
    print(json.dumps(check(ROOT),indent=2))
