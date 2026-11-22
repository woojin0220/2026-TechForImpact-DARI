"""Live synthetic-only gateway smoke test. Never prints credentials or raw responses."""
import json
import os
from pathlib import Path
import shlex
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def load_environment():
    path = Path(__file__).resolve().parents[1] / '.env'
    if path.exists():
        for line in path.read_text().splitlines():
            key, sep, value = line.strip().partition('=')
            if sep and key in {'GEMINI_API_KEY', 'DARI_GEMINI_MODEL', 'DARI_LLM_PROVIDER', 'HF_HOME', 'DARI_PII_DEVICE', 'DARI_GEMINI_INTAKE_THINKING'}:
                parts = shlex.split(value, comments=True)
                if len(parts) > 1:
                    raise ValueError('환경변수 형식을 확인해 주세요.')
                os.environ[key] = parts[0] if parts else ''


def main():
    load_environment()
    if not os.environ.get('GEMINI_API_KEY'):
        raise ValueError('저장된 API 키를 찾지 못했습니다.')
    import hybrid_gateway as g
    from unittest.mock import patch
    from urllib.error import HTTPError
    original = g.build_opener
    statuses = []
    class CheckedOpener:
        def __init__(self, *handlers):
            self.opener = original(*handlers)
        def open(self, *args, **kwargs):
            try:
                return self.opener.open(*args, **kwargs)
            except HTTPError as error:
                statuses.append(error.code)
                raise
    raw = 'My name is Amina Diallo. My email is aminatest@example.org. I was not detained on 2024-05-12.'
    schema = {'type': 'object', 'properties': {'quote': {'type': 'string', 'enum': [raw]}}, 'required': ['quote'], 'additionalProperties': False}
    original_call = g.call_gemini
    calls = []
    def checked_call(masked, key, model):
        wire = json.dumps(masked, ensure_ascii=False)
        for entity in ['Amina', 'Diallo', 'aminatest@example.org']:
            if entity in wire:
                raise ValueError('마스킹 검증 실패: 외부 호출을 중단했습니다.')
        if 'not detained on 2024-05-12' not in wire:
            raise ValueError('사건 날짜/부정문 보존 검증 실패: 외부 호출을 중단했습니다.')
        calls.append(True)
        return original_call(masked, key, model)
    started = time.perf_counter()
    try:
        with patch.object(g, 'build_opener', CheckedOpener), patch.object(g, 'call_gemini', checked_call):
            result = g.generate({'task': 'intake', 'system': 'Copy the supplied content exactly into quote. Return only JSON.',
                                 'prompt': json.dumps({'content': raw}), 'responseSchema': schema, 'maskValues': ['Amina Diallo']})
        exact = json.loads(result['text']).get('quote') == raw
        if not exact:
            raise ValueError('실제 모델 응답의 원문 복원 검증을 통과하지 못했습니다.')
        print(json.dumps({'ok': True, 'model': result['model'], 'external_calls': len(calls), 'masked_before_send': True,
                          'exact_roundtrip': exact, 'seconds': round(time.perf_counter() - started, 2), 'stats': result['stats']}))
    except Exception:
        print(json.dumps({'ok': False, 'external_calls_attempted': len(calls), 'http_status': statuses[-1] if statuses else None,
                          'message': '실제 호출 검증 실패. 키·모델·네트워크 또는 마스킹/복원 상태를 확인해야 합니다.'}))
        return 1
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print(json.dumps({'ok': False, 'message': '환경 설정을 확인해 주세요. 키 값은 출력하지 않았습니다.'}))
        sys.exit(1)
