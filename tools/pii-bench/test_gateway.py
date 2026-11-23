"""Exercise the actual gateway policy on the existing synthetic corpus; no API call.

No gold values are passed as known identity fields. This measures detection-only
masking, separately from the deterministic form-value integration unit test.
"""
import json
from pathlib import Path
import re
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from hybrid_gateway import Masker, LocalDetectors
from expanded import cases
from compare import score_case

if __name__ == '__main__':
    output = Path(sys.argv[1])
    started = time.perf_counter()
    detector = LocalDetectors()
    report = {'policy': 'actual gateway; nym identifiers + GLiNER sensitive + regex; 220-char windows/80 overlap; no known form values',
              'load_seconds': round(time.perf_counter() - started, 3), 'rows': []}
    for case in cases():
        started = time.perf_counter()
        masker = Masker(detector)
        masked = masker.mask({'content': case['text']})
        spans = []
        for raw in masker.aliases.values():
            spans.extend({'start': m.start(), 'end': m.end(), 'label': 'masked'} for m in re.finditer(re.escape(raw), case['text']))
        restored = json.loads(masker.restore(json.dumps(masked)))['content']
        report['rows'].append({'id': case['id'], 'language': case['language'], 'track': case['track'],
                               'milliseconds': round((time.perf_counter() - started) * 1000),
                               'roundtrip_exact': restored == case['text'], **score_case(case, spans)})
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(case['id'], flush=True)
    report['status'] = 'complete'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
