"""Repeat fictional scenarios through the production local path, retaining every output.

Rule hits are a review queue, never a semantic accuracy percentage.
"""
import argparse
from collections import Counter,defaultdict
import hashlib
import json
from pathlib import Path
import random
import re
import statistics
import time
from urllib.error import HTTPError
from urllib.request import Request,urlopen

from pipeline import preserve

ROOT=Path(__file__).resolve().parent

def inspect(case, translation, passthrough=False):
    flags=[]
    if passthrough:
        return [] if translation==case['source'] else ['PASSTHROUGH_CHANGED']
    if not re.search('[가-힣]',translation): flags.append('NO_KOREAN')
    if translation.strip()==case['source'].strip():flags.append('COPIED_SOURCE')
    for check in case['checks']:
        if check.get('any') and not any(re.search(p,translation)for p in check['any']):flags.append(check['label'])
        if any(re.search(p,translation)for p in check.get('none',[])):flags.append(check['label'])
    return flags

def summarize(rows):
    groups=defaultdict(list)
    for row in rows:groups[row['case_id']].append(row)
    model=[x['seconds']for x in rows if x['kind']=='model' and not x.get('error')]
    variations=[]
    for key,items in groups.items():
        outputs={re.sub(r'\s+',' ',x['translation']).strip()for x in items if 'translation'in x}
        if len(outputs)>1:variations.append(key)
    rounds={str(r):{'seconds':round(sum(x['seconds']for x in rows if x['round']==r),3),
                   'errors':sum(bool(x.get('error'))for x in rows if x['round']==r),
                   'flagged':sum(bool(x['flags'])for x in rows if x['round']==r)} for r in sorted({x['round']for x in rows})}
    return {'observations':len(rows),'unique_cases':len(groups),'model_calls':sum(x['kind']=='model'for x in rows),
            'passthroughs':sum(x['kind']=='passthrough'for x in rows),'request_errors':sum(bool(x.get('error'))for x in rows),
            'flagged_observations':sum(bool(x['flags'])for x in rows),
            'flagged_cases':sorted({x['case_id']for x in rows if x['flags']}),
            'varying_cases':variations,'rounds':rounds,
            'model_latency_seconds':{'median':statistics.median(model)if model else None,
                'p95':sorted(model)[max(0,int(len(model)*.95+.999)-1)]if model else None},
            'meaning':'Rule flags require review. No flags does not certify factual accuracy.'}

def main():
    p=argparse.ArgumentParser();p.add_argument('--rounds',type=int,default=3);p.add_argument('--seed',type=int,default=20261122)
    p.add_argument('--dataset',type=Path,default=ROOT/'scenarios/russian-v1.json');p.add_argument('--output',type=Path,required=True);p.add_argument('--resume',action='store_true');args=p.parse_args()
    if not 1<=args.rounds<=20:raise ValueError('rounds must be 1..20')
    dataset=json.loads(args.dataset.read_text());cases=[]
    for scene in dataset['scenarios']:
        for case in scene['cases']:cases.append({**case,'scenario':scene['id'],'split':scene['split'],'language':scene['language']})
    args.output.mkdir(parents=True,exist_ok=True)
    with urlopen('http://127.0.0.1:11434/api/tags',timeout=10)as response:
        installed=json.load(response)['models']
    digest=next(x['digest']for x in installed if x['name']=='dari-hymt2:1.8b')
    fingerprint=hashlib.sha256(args.dataset.read_bytes()+Path(__file__).read_bytes()+(ROOT/'pipeline.py').read_bytes()+(ROOT.parents[1]/'application_translation.py').read_bytes()+(ROOT.parents[1]/'capacitor-web/src/application/translationProfiles.json').read_bytes()+digest.encode()).hexdigest()
    meta={'dataset':dataset['version'],'fingerprint':fingerprint,'seed':args.seed,'rounds':args.rounds,'model':'dari-hymt2:1.8b','runtime':'production localhost endpoint; Mac local inference; no external LLM',
          'model_digest':digest,'warmup_seconds':None,'warning':'Regex rules and assistant-authored expectations are review aids; independent bilingual review remains necessary.'}
    log=args.output/'observations.jsonl';previous=[]
    if log.exists():
        if not args.resume:raise ValueError('Output exists; use a new directory or --resume')
        saved=json.loads((args.output/'run.json').read_text())
        if saved['fingerprint']!=fingerprint or saved['seed']!=args.seed or saved['rounds']!=args.rounds:raise ValueError('Dataset/profile/model/run configuration changed; use a new output directory')
        previous=[json.loads(line)for line in log.read_text().splitlines()if line.strip()]
    t=time.perf_counter()
    warm={'question_id':'1.7','text':'Россия','source_language':'ru','target_language':'ko'}
    with urlopen(Request('http://127.0.0.1:8765/v1/translate',data=json.dumps(warm).encode(),headers={'Content-Type':'application/json'}),timeout=180)as r:json.load(r)
    meta['warmup_seconds']=time.perf_counter()-t
    (args.output/'run.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
    done={(x['round'],x['case_id'])for x in previous};rows=previous
    with log.open('a')as stream:
        for repeat in range(1,args.rounds+1):
            ordered=cases[:];random.Random(args.seed+repeat).shuffle(ordered)
            for case in ordered:
                if (repeat,case['id'])in done:continue
                passthrough=preserve(case['source'],case['question_id'])
                row={'round':repeat,'case_id':case['id'],'scenario':case['scenario'],'split':case['split'],'question_id':case['question_id'],'source':case['source'],'expected':case['expected'],'kind':'passthrough'if passthrough else'model','flags':[]}
                start=time.perf_counter()
                try:
                    if passthrough:row['translation']=case['source']
                    else:
                        payload={'question_id':case['question_id'],'text':case['source'],'source_language':case['language'],'target_language':'ko','model':'dari-hymt2:1.8b'}
                        with urlopen(Request('http://127.0.0.1:8765/v1/translate',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'}),timeout=180)as r:result=json.load(r)
                        if result.get('model')!='dari-hymt2:1.8b':raise ValueError('Unexpected translation model')
                        row.update(translation=result['translation'],model=result['model'],profile_version=result.get('profile_version'))
                    row['flags']=inspect(case,row['translation'],passthrough)
                except HTTPError as exc:row.update(error=f'HTTP {exc.code}: {exc.read().decode()}',flags=['REQUEST_ERROR'])
                except Exception as exc:row.update(error=str(exc),flags=['REQUEST_ERROR'])
                row['seconds']=round(time.perf_counter()-start,4);rows.append(row)
                stream.write(json.dumps(row,ensure_ascii=False)+'\n');stream.flush()
            summary=summarize(rows);(args.output/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
            print(json.dumps({'completed_round':repeat,**summary['rounds'][str(repeat)]}),flush=True)
    queue=[]
    for case in cases:
        items=[r for r in rows if r['case_id']==case['id']]
        unique={r.get('translation',r.get('error'))for r in items}
        queue.append({'case_id':case['id'],'scenario':case['scenario'],'split':case['split'],'question_id':case['question_id'],'source':case['source'],'expected':case['expected'],
            'outputs':list(unique),'flags':sorted({f for r in items for f in r['flags']}),'varying':len(unique)>1})
    (args.output/'review-queue.json').write_text(json.dumps(queue,ensure_ascii=False,indent=2))
    print(json.dumps(summarize(rows),ensure_ascii=False),flush=True)

if __name__=='__main__':main()
