"""Local synthetic masking timing/coverage on explicitly selected GPU device."""
import json,sys,time,re,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import hybrid_gateway as g
from expanded import cases
from compare import score_case
if __name__=='__main__':
 start=time.perf_counter();d=g.LocalDetectors();print('Loaded',round(time.perf_counter()-start,2),flush=True)
 p=json.loads(Path('/private/tmp/dari-gateway-real-request.json').read_text())
 v={'system':p['system'],'prompt':json.loads(p['prompt']),'responseSchema':p['responseSchema']}
 start=time.perf_counter();m=g.Masker(d);out=m.mask(v,['Amina Diallo']);first=round((time.perf_counter()-start)*1000)
 assert json.loads(m.restore(json.dumps(out)))==v
 start=time.perf_counter();m=g.Masker(d);out=m.mask(v,['Amina Diallo']);repeat=round((time.perf_counter()-start)*1000)
 # A genuinely new answer, not an identical-request cache benchmark.
 v['prompt']['recentMessages'][-1]['content']='I received a new email from Nadia Petrova at nadia.petrova@example.org. I was not arrested on 2025-03-14.'
 start=time.perf_counter();m=g.Masker(d);out=m.mask(v,['Amina Diallo']);new=round((time.perf_counter()-start)*1000)
 report={'device':os.environ.get('DARI_PII_DEVICE'),'first_request_ms':first,'identical_request_ms':repeat,'new_turn_ms':new,'rows':[]}
 print(json.dumps({k:v for k,v in report.items() if k!='rows'}),flush=True)
 for c in ([] if '--request-only' in sys.argv else cases()):
  d.cache.clear();start=time.perf_counter();m=g.Masker(d);out=m.mask({'content':c['text']});spans=[]
  for raw in m.aliases.values():
   spans.extend({'start':x.start(),'end':x.end(),'label':'masked'} for x in re.finditer(re.escape(raw),c['text']))
  report['rows'].append({'id':c['id'],'track':c['track'],'milliseconds':round((time.perf_counter()-start)*1000),'roundtrip_exact':json.loads(m.restore(json.dumps(out)))['content']==c['text'],**score_case(c,spans)})
 output=Path(__file__).parent/('results/2026-11-19/gateway-'+os.environ.get('DARI_PII_DEVICE','cpu')+'-device.json');output.write_text(json.dumps(report,indent=2)+'\n');print('Complete',flush=True)
