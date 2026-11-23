"""Measure the production local endpoint for the complete fictional application.
Names, dates, email and visa codes follow the client passthrough rule; choices use schema labels.
No private answers are read and no external LLM is called.
"""
import json
import argparse
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parent

def preserve(text,qid):
    return qid in {'1.2','1.3','10.12','10.13'} or bool(re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',text) or re.fullmatch(r'[\d\s/+().:\-–]+',text) or re.fullmatch(r'[A-Za-z]{1,3}-\d{1,3}',text))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='production-hymt2-profile-v1.json');args=parser.parse_args()
    data=json.loads((ROOT/'russian-application.json').read_text())
    out=ROOT/'results/2026-11-22'/args.output
    report={'scope':'97 fictional Russian application answers, production local endpoint with question context and terminology; no masking or external LLM', 'cases':[]}
    start=time.perf_counter()
    for g in data:
        for q in g['questions']:
            item={'id':q['id'],'source':q['text']};t=time.perf_counter()
            if q.get('choice'):
                # Same deterministic localized source/target pair as the form's select element.
                option=next(o for o in q['fields'][0]['options'] if o['value']==q['choice'])
                item.update(translation=option['ko'],kind='choice')
            elif preserve(q['text'],q['id']):item.update(translation=q['text'],kind='passthrough')
            else:
                payload={'text':q['text'],'source_language':'ru','target_language':'ko','question_id':q['id'],'question_context':q['fields'][0]['en']}
                try:
                    with urlopen(Request('http://127.0.0.1:8765/v1/translate',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'}),timeout=180)as r: result=json.load(r)
                    item.update(translation=result['translation'],model=result['model'],profile_version=result.get('profile_version'),kind='model')
                except Exception as exc:item['error']=str(exc)
            item['seconds']=round(time.perf_counter()-t,4)
            report['cases'].append(item);out.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(item['id'],item.get('translation',item.get('error')),flush=True)
    report['seconds']=time.perf_counter()-start
    report['model_calls']=sum(x.get('kind')=='model' for x in report['cases'])
    report['failures']=sum('error'in x for x in report['cases'])
    report['untranslated_sentences']=sum(x.get('kind')=='model' and not re.search('[가-힣]',x.get('translation','')) for x in report['cases'])
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2));print({k:v for k,v in report.items()if k!='cases'},flush=True)

if __name__=='__main__':main()
