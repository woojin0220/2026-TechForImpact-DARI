"""New counterexamples for fixed profiles; preserve raw before/after model output."""
import json
import argparse
from pathlib import Path
import sys
import time
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parents[1]))
import application_translation
from local_verification_server import specialist_translation_prompt

CASES=[
 ('ethnicity','1.12','Татарин.','Tatar ethnicity, not the Russian language'),
 ('language','1.13','Русский.','Russian language, not ethnicity'),
 ('child_elsewhere','14.13','У меня есть дочь. Она осталась в России. Со мной детей нет.','Has a daughter elsewhere; no accompanying children; add no age'),
 ('child_age','14.13','Со мной мой сын, ему 17 лет.','Accompanying son aged 17; no invented age threshold'),
 ('age_unknown','14.13','Со мной ребёнок. Его точный возраст я не знаю.','Accompanying child; exact age unknown'),
 ('known_police','14.2','Двое полицейских остановили меня. Я видел их удостоверения.','Police identity known, witnessed IDs'),
 ('unknown_police','14.2','Двое мужчин остановили меня. Я не знаю, были ли они полицейскими.','Two men; police identity unknown'),
 ('direct_observation','14.4','Я лично видел, как задержали моего брата. Мать при этом не присутствовала.','Directly witnessed brother detained; mother absent'),
 ('hearsay','14.4','Мать сказала, что брата задержали. Сам я этого не видел.','Mother reports detention; not directly witnessed'),
 ('contacted_police','14.5','Я обратился в полицию 3 апреля 2025 года. Мне отказали в помощи.','Did contact police; date and refused help retained'),
 ('not_contacted','14.5','Я не обращался в полицию. Не знаю, помогли бы мне.','Did not contact police; hypothetical assistance unknown'),
 ('timing_fact','14.18','Заявление подано через три месяца после въезда.','Submitted after three months; no new obligation'),
 ('reported_deadline','14.18','Мне сказали подать заявление до 1 июня 2026 года. Я не знаю, верен ли этот срок.','Reported deadline with uncertainty; preserve date and obligation as reported'),
 ('real_appendix','15','К заявлению прилагаю приложение с фотографиями. Это не программа для компьютера.','Appendix with photos; explicitly not software'),
 ('software_test','15','Это тест мобильного приложения. Это не настоящее заявление.','Mobile software test; not a real application'),
 ('real_statement','15','Это моё настоящее заявление. Описанные события произошли со мной.','Real statement and events, not a fictional test'),
 ('travel_document','9.10','Проездной документ. Паспорт получить не могу.','Travel document; cannot obtain passport'),
]

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--case',action='append');args=parser.parse_args()
 fixture=json.loads((ROOT/'russian-application.json').read_text())
 contexts={q['id']:q['fields'][0]['en'] for g in fixture for q in g['questions']}
 out=ROOT/'results/2026-11-22/profile-v1-holdouts.json'
 rows=json.loads(out.read_text()) if args.case and out.exists() else []
 for name,qid,source,meaning in CASES:
  if args.case and name not in args.case:continue
  row={'name':name,'question_id':qid,'source':source,'meaning_to_check':meaning}
  for key,prompt in [('before',specialist_translation_prompt(source,'ko',contexts[qid])),('after',application_translation.prompt(source,'Korean',qid))]:
   body={'model':'dari-hymt2:1.8b','prompt':prompt,'stream':False,'keep_alive':'30m','options':{'temperature':0,'num_ctx':16384,'num_predict':1024}}
   t=time.perf_counter()
   with urlopen(Request('http://127.0.0.1:11434/api/generate',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'}),timeout=180)as r:result=json.load(r)
   row[key]={'translation':result['response'],'seconds':time.perf_counter()-t,'done_reason':result.get('done_reason')}
  rows=[r for r in rows if r['name']!=name];rows.append(row);out.write_text(json.dumps(rows,ensure_ascii=False,indent=2));print(name,row['after']['translation'],flush=True)

if __name__=='__main__':main()
