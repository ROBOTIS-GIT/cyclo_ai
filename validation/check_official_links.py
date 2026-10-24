"""Explicit public-source link check. Not run by default/offline CI.

python3 validation/check_official_links.py --live
Records retrieval evidence only, never promotes content to reviewed status.
"""
import argparse,json,hashlib,concurrent.futures,urllib.request,urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ALLOWED={'docs.robotis.com','emanual.robotis.com','github.com','zenoh.io','control.ros.org'}
class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        p=urllib.parse.urlparse(newurl)
        if p.scheme!='https' or p.hostname not in ALLOWED or p.username:raise ValueError('Redirect leaves verified public source hosts')
        return super().redirect_request(req,fp,code,msg,headers,newurl)
def check(url):
    try:
        request=urllib.request.Request(url,headers={'User-Agent':'CycloPluginSourceCheck/0.4.0'})
        with urllib.request.build_opener(OfficialRedirect()).open(request,timeout=12) as r:
            data=r.read(2*1024*1024+1)
            return {'url':url,'status':r.status,'finalUrl':r.url,'sampleBytes':len(data),'sampleSha256':hashlib.sha256(data).hexdigest(),'truncated':len(data)>2*1024*1024}
    except Exception as e:return {'url':url,'error':str(e)}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true');args=parser.parse_args()
    if not args.live:parser.error('--live is required for public-network retrieval')
    index=json.loads((ROOT/'references/robotis-sources.json').read_text())
    urls=sorted({s['url'] for s in index['sources']})
    # Initial URLs are canonical metadata, never device endpoints or user URLs.
    for url in urls:
        p=urllib.parse.urlparse(url)
        assert p.scheme=='https' and p.hostname in {'docs.robotis.com','emanual.robotis.com','github.com','zenoh.io','control.ros.org'} and not p.username
        if p.hostname=='github.com':assert p.path.startswith('/ROBOTIS-GIT/')
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:results=list(executor.map(check,urls))
    result={'checkedOn':'2026-10-24','kind':'public page retrieval; not semantic or runtime verification','total':len(results),'retrieved':sum('error' not in r for r in results),'results':results}
    (ROOT/'validation/current/source-links.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='results'}))
