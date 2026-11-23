"""Compare serial and batched execution of identical privacy windows locally."""
import json
from pathlib import Path
import sys
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import hybrid_gateway as g
from expanded import cases
from compare import score_case

if __name__ == '__main__':
    detector=g.LocalDetectors()
    p=Path('/private/tmp/dari-gateway-real-request.json')
    payload=json.loads(p.read_text())
    value={'system':payload['system'],'prompt':json.loads(payload['prompt']),'responseSchema':payload['responseSchema']}
    texts=list(dict.fromkeys(g.strings(value)))
    started=time.perf_counter()
    serial={text:tuple(detector._predict(text)) for text in texts}
    serial_ms=round((time.perf_counter()-started)*1000)
    detector.cache.clear()
    started=time.perf_counter();detector.prepare(texts)
    batch_ms=round((time.perf_counter()-started)*1000)
    changed=sum(sorted(serial[text])!=sorted(detector.spans(text)) for text in texts)
    report={'real_request':{'serial_ms':serial_ms,'batch_ms':batch_ms,'texts':len(texts),'changed_predictions':changed},'rows':[]}
    print(json.dumps(report['real_request']),flush=True)
    for case in cases():
        detector.cache.clear();masker=g.Masker(detector)
        started=time.perf_counter();masked=masker.mask({'content':case['text']})
        spans=[]
        import re
        for raw in masker.aliases.values():
            spans.extend({'start':m.start(),'end':m.end(),'label':'masked'} for m in re.finditer(re.escape(raw),case['text']))
        report['rows'].append({'id':case['id'],'track':case['track'],'milliseconds':round((time.perf_counter()-started)*1000),
            'roundtrip_exact':json.loads(masker.restore(json.dumps(masked)))['content']==case['text'],**score_case(case,spans)})
    output=Path(__file__).parent/'results/2026-11-19/gateway-batch.json'
    output.write_text(json.dumps(report,indent=2)+'\n');print('Complete',flush=True)
