"""Synthetic benchmark worker, never for serving applicant requests."""
import io,json,os,sys,time
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from tools.smoke_hybrid import load_environment
load_environment()
import hybrid_gateway as g
opener=g.build_opener
for line in sys.stdin:
 try:
  message=json.loads(line);mode=message['mode'];request=message['request'];usage={}
  if message.get('action') == 'prepare':
   started=time.perf_counter();g.detectors()
   print(json.dumps({'id':message['id'],'ready':True,'modelLoadMs':round((time.perf_counter()-started)*1000)}),flush=True)
   continue
  if message.get('action') == 'warm':
   prompt=json.loads(request['prompt'])
   g.Masker(g.detectors()).mask({'system':request['system'],'prompt':prompt,'responseSchema':request.get('responseSchema')})
   print(json.dumps({'id':message['id'],'ready':True}),flush=True)
   continue
  class Measured:
   def __init__(self,*handlers):self.opener=opener(*handlers)
   def open(self,req,**kwargs):
    body=json.loads(req.data)
    if mode=='before':
     body['generationConfig'].pop('thinkingConfig',None)
     schema=body['generationConfig'].get('responseJsonSchema',{})
     item=schema.get('properties',{}).get('facts',{}).get('items',{})
     if item.get('type')=='object' and 'r' in item.get('properties',{}):item['required']=list(item['properties'])
    req.data=json.dumps(body).encode()
    with self.opener.open(req,**kwargs) as response:raw=response.read()
    result=json.loads(raw);usage.update(result.get('usageMetadata',{}));return io.BytesIO(raw)
  with patch.object(g,'build_opener',Measured):result=g.generate(request)
  print(json.dumps({'id':message['id'],'text':result['text'],'stats':result['stats'],'usage':usage}),flush=True)
 except Exception as error:
  print(json.dumps({'id':message.get('id'),'error':str(error)}),flush=True)
