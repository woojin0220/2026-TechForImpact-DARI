"""Loopback-only privacy gateway. No raw-input fallback, disk map, or cloud SDK.

Models must be downloaded before serving; inference is always offline.
The request-local alias map is discarded when generate() returns.
"""
import json
import hashlib
from collections import OrderedDict
import os
import re
import secrets
import time
import tempfile
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler, ProxyHandler
from urllib.error import HTTPError, URLError

NYM = ('Wismut/nym-pii-multilingual', '0ed0242d67a30ca6a83e5f118506ff1e1daf83ca')
GLINER = ('urchade/gliner_multi_pii-v1', '1fcf13e85f4eef5394e1fcd406cf2ca9ea82351d')
BASE = ('microsoft/mdeberta-v3-base', 'a0484667b22365f84929a935b5e50a51f71f159d')
IDS = {'GIVEN_NAME', 'SURNAME', 'EMAIL', 'PHONE', 'STREET_ADDRESS', 'STREET_NAME',
       'BUILDING_NUMBER', 'SECONDARY_ADDRESS', 'CITY', 'STATE', 'COUNTRY', 'ZIP_CODE',
       'DATE_OF_BIRTH', 'PASSPORT'}  # General DATE is deliberately excluded.
SENSITIVE = ['religion', 'political party', 'medical condition']
EMAIL = re.compile(r'[\w.+-]+@[\w.-]+\.[^\W\d_]{2,}', re.UNICODE)
PHONE = re.compile(r'(?<!\w)\+?\d[\d ()-]{7,}\d(?!\w)')
DATE = re.compile(r'^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$')
# Prefer the nearest explicit cue before a date; uncertain dates remain masked.
BIRTH_CUE = re.compile(r'born|birth|생년|태어|출생|naiss|né[e]?\b|родил|рожд|وُلد|ولدت|مواليد|به دنیا|متولد', re.I)
EVENT_CUE = re.compile(r'detain|arrest|interview|interrogat|left|depart|arriv|enter|attack|구금|체포|심문|출국|입국|떠났|공격|interrog|arrêt|quitt|entré|départ|задерж|допраш|покин|въех|استجو|احتجاز|غادر|دخل|بازجویی|بازداشت|ترک|وارد', re.I)
RESERVED = '⟦DARI_'
_models = None


def enabled():
    value = os.getenv('DARI_LLM_PROVIDER', 'ollama')
    if value not in {'ollama', 'gemini'}:
        raise ValueError('DARI_LLM_PROVIDER는 ollama 또는 gemini여야 합니다.')
    return value == 'gemini'


def model_name():
    value = os.getenv('DARI_GEMINI_MODEL', 'gemini-3.8-flash')
    if not re.fullmatch(r'gemini-[a-z0-9.-]{1,80}', value):
        raise ValueError('Gemini 모델 설정을 확인해 주세요.')
    return value


def cached_paths():
    from huggingface_hub import snapshot_download
    return [snapshot_download(name, revision=rev, local_files_only=True,
                              allow_patterns=['*.json', '*.safetensors', '*.bin', '*.model'],
                              ignore_patterns=['*/**']) for name, rev in [NYM, GLINER, BASE]]


def status():
    reason = None
    try:
        cached_paths()
    except Exception:
        reason = '로컬 마스킹 모델 또는 Python 의존성을 먼저 준비해 주세요.'
    if not os.getenv('GEMINI_API_KEY'):
        reason = '서버의 GEMINI_API_KEY를 설정해 주세요.'
    return {'mode': 'hybrid', 'models': [model_name()], 'modelName': model_name(),
            'modelReady': reason is None, 'reason': reason, 'backend': 'nym + GLiNER → Gemini',
            'maskingLocation': 'local-gateway'}


class LocalDetectors:
    def __init__(self):
        # These flags must be set before importing Transformers / GLiNER.
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.environ['TRANSFORMERS_OFFLINE'] = '1'
        import torch
        from transformers import AutoTokenizer, AutoModelForTokenClassification
        from gliner import GLiNER
        torch.set_num_threads(4)
        nym, gliner, base = cached_paths()
        self.cache = OrderedDict()
        self.torch = torch
        self.device = os.getenv('DARI_PII_DEVICE', 'cpu')
        if self.device not in {'cpu', 'mps'} or (self.device == 'mps' and not torch.backends.mps.is_available()):
            raise ValueError('지원하지 않는 마스킹 실행 장치입니다.')
        self.tokenizer = AutoTokenizer.from_pretrained(nym, local_files_only=True)
        self.nym = AutoModelForTokenClassification.from_pretrained(nym, local_files_only=True).eval()
        # GLiNER's original config names an unpinned "main" tokenizer. Build a
        # temporary model-file view pointing at our exact offline base snapshot.
        # This view contains only public model files/config, never user data.
        self.bundle = tempfile.TemporaryDirectory(prefix='dari-gliner-')
        bundle = Path(self.bundle.name)
        for source in Path(gliner).iterdir():
            if source.is_file() and source.name != 'gliner_config.json':
                (bundle / source.name).symlink_to(source)
        config = json.loads((Path(gliner) / 'gliner_config.json').read_text())
        config['model_name'] = base
        (bundle / 'gliner_config.json').write_text(json.dumps(config))
        self.gliner = GLiNER.from_pretrained(str(bundle), local_files_only=True).eval()
        self.nym.to(self.device)
        self.gliner.to(self.device)

    def spans(self, text):
        # Repeated static instructions/schema and retained evidence recur every
        # turn. Cache offsets by digest, never the raw text or restoration map.
        digest = hashlib.sha256(text.encode()).digest()
        if digest not in self.cache:
            self.cache[digest] = tuple(self._predict(text))
            if len(self.cache) > 512:
                self.cache.popitem(last=False)
        self.cache.move_to_end(digest)
        return self.cache[digest]

    def prepare(self, texts):
        """Batch the same windows and labels used by the reference decoder.

        This changes execution only: no input, detector, or span is skipped.
        Cache keys are digests; plaintext is retained only during this call.
        """
        pending = [(hashlib.sha256(text.encode()).digest(), text) for text in texts
                   if hashlib.sha256(text.encode()).digest() not in self.cache]
        rows, collected = [], {digest: [] for digest, _ in pending}
        for digest, text in pending:
            for offset in range(0, len(text), 140):
                rows.append((digest, offset, text[offset:offset + 220]))
                if offset + 220 >= len(text):
                    break
        batch_size = 8
        for batch_start in range(0, len(rows), batch_size):
            batch = rows[batch_start:batch_start + batch_size]
            chunks = [row[2] for row in batch]
            encoded = self.tokenizer(chunks, return_offsets_mapping=True, return_tensors='pt',
                                     padding=True, truncation=False)
            offsets = encoded.pop('offset_mapping').tolist()
            encoded = encoded.to(self.device)
            if encoded['input_ids'].shape[1] > self.nym.config.max_position_embeddings:
                raise ValueError('마스킹 입력의 토큰 길이를 초과했습니다.')
            with self.torch.inference_mode():
                labels = self.nym(**encoded).logits.argmax(-1).tolist()
                sensitive = self.gliner.inference(chunks, SENSITIVE, threshold=.3, batch_size=batch_size)
            if not (len(labels) == len(offsets) == len(sensitive) == len(batch)):
                raise ValueError('마스킹 모델의 묶음 결과가 누락되었습니다.')
            for (digest, offset, _), ids, positions, spans in zip(batch, labels, offsets, sensitive):
                if len(ids) != len(positions):
                    raise ValueError('마스킹 모델의 토큰 위치가 누락되었습니다.')
                current = None
                for index, (start, end) in zip(ids, positions):
                    tag = self.nym.config.id2label[index]
                    if start == end or tag == 'O' or tag.split('-', 1)[-1] not in IDS:
                        if current:
                            collected[digest].append(current)
                        current = None
                        continue
                    prefix, label = tag.split('-', 1)
                    if prefix in {'B', 'S'} or current is None or current[2] != label:
                        if current:
                            collected[digest].append(current)
                        current = (offset + start, offset + end, label)
                    else:
                        current = (current[0], offset + end, label)
                if current:
                    collected[digest].append(current)
                collected[digest].extend((offset + span['start'], offset + span['end'], span['label']) for span in spans)
        for digest, _ in pending:
            self.cache[digest] = tuple(collected[digest])
            self.cache.move_to_end(digest)
        # Do not evict entries in this request before Masker has consumed them.
        # An overlarge cache is pruned at the next prepare call.
        for text in texts:
            self.cache.move_to_end(hashlib.sha256(text.encode()).digest())
        while len(self.cache) > max(512, len(texts)):
            self.cache.popitem(last=False)

    def _predict(self, text):
        # Shared overlapping character windows avoid silent tokenizer truncation,
        # including scripts with many tokens per character. Every char is visited.
        for offset in range(0, len(text), 140):
            chunk = text[offset:offset + 220]
            encoded = self.tokenizer(chunk, return_offsets_mapping=True, return_tensors='pt', truncation=False)
            offsets = encoded.pop('offset_mapping')[0].tolist()
            encoded = encoded.to(self.device)
            if encoded['input_ids'].shape[1] > self.nym.config.max_position_embeddings:
                raise ValueError('마스킹 입력의 토큰 길이를 초과했습니다.')
            with self.torch.inference_mode():
                labels = self.nym(**encoded).logits[0].argmax(-1).tolist()
            current = None
            for index, (start, end) in zip(labels, offsets):
                tag = self.nym.config.id2label[index]
                if start == end or tag == 'O':
                    if current:
                        yield current
                    current = None
                    continue
                prefix, label = tag.split('-', 1)
                if label not in IDS:
                    if current:
                        yield current
                    current = None
                    continue
                if prefix in {'B', 'S'} or current is None or current[2] != label:
                    if current:
                        yield current
                    current = (offset + start, offset + end, label)
                else:
                    current = (current[0], offset + end, label)
            if current:
                yield current
            with self.torch.inference_mode():
                spans = self.gliner.predict_entities(chunk, SENSITIVE, threshold=.3)
            for span in spans:
                yield offset + span['start'], offset + span['end'], span['label']
            if offset + 220 >= len(text):
                break


def detectors():
    global _models
    if _models is None:
        try:
            _models = LocalDetectors()
        except Exception:
            raise ValueError('로컬 마스킹 모델 로드 실패. 원문 전송을 차단했습니다.') from None
    return _models


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)


def transform(value, fn):
    if isinstance(value, str):
        return fn(value)
    if isinstance(value, list):
        return [transform(item, fn) for item in value]
    if isinstance(value, dict):
        return {key: transform(item, fn) for key, item in value.items()}
    return value


class Masker:
    def __init__(self, detector):
        self.detector = detector
        self.aliases = {}
        self.prefix = RESERVED + secrets.token_hex(8) + '_'

    def mask(self, value, known=()):
        texts = list(dict.fromkeys(strings(value)))
        if any(RESERVED in text for text in texts) or any(RESERVED in text for text in known):
            raise ValueError('입력에 예약된 마스킹 토큰이 있습니다.')
        entities = {text.strip() for text in known if text.strip()}
        if hasattr(self.detector, 'prepare'):
            self.detector.prepare(texts)
        for text in texts:
            spans = []
            for start, end, label in self.detector.spans(text):
                if label == 'DATE_OF_BIRTH':
                    before = text[max(0, start - 140):start]
                    births = [m.start() for m in BIRTH_CUE.finditer(before)]
                    events = [m.start() for m in EVENT_CUE.finditer(before)]
                    if events and max(events) > max(births, default=-1):
                        continue
                spans.append((start, end, label))
            spans += [(m.start(), m.end(), 'EMAIL') for m in EMAIL.finditer(text)]
            spans += [(m.start(), m.end(), 'PHONE') for m in PHONE.finditer(text)
                      if not DATE.fullmatch(m.group()) and 9 <= sum(c.isdigit() for c in m.group()) <= 15]
            # Merge overlapping predictions before making aliases. Never discard
            # a prediction merely because its boundary differs between models.
            merged = []
            for start, end, _ in sorted(spans):
                if not 0 <= start < end <= len(text):
                    raise ValueError('마스킹 모델의 문자 위치가 올바르지 않습니다.')
                if merged and start < merged[-1][1]:
                    merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
                else:
                    merged.append((start, end))
            entities.update(text[start:end].strip() for start, end in merged)
        entities.discard('')
        ordered = sorted(entities, key=lambda item: (-len(item), item))
        if not ordered:
            return value
        # A single pass avoids masking already-created tokens. Repeated source
        # quotes, schema enums, and instructions use the same request-local alias.
        pattern = re.compile('|'.join(re.escape(item) for item in ordered))
        forward = {raw: f'{self.prefix}{i}⟧' for i, raw in enumerate(ordered)}
        self.aliases = {token: raw for raw, token in forward.items()}
        return transform(value, lambda text: pattern.sub(lambda m: forward[m.group()], text))

    def restore(self, text):
        try:
            parsed = json.loads(text)
        except (ValueError, TypeError):
            raise ValueError('Gemini가 유효한 JSON을 반환하지 않았습니다.') from None
        # Walk values, never substitute into serialized JSON (quotes/backslashes).
        pattern = re.compile(re.escape(RESERVED) + r'[^⟧]*⟧')
        def restore_value(value):
            def replace(match):
                if match.group() not in self.aliases:
                    raise ValueError('알 수 없는 마스킹 토큰을 반환해 복원을 중단했습니다.')
                return self.aliases[match.group()]
            restored = pattern.sub(replace, value)
            if RESERVED in restored:
                raise ValueError('손상된 마스킹 토큰을 반환해 복원을 중단했습니다.')
            return restored
        for key in self._keys(parsed):
            if RESERVED in key:
                raise ValueError('응답 키에 마스킹 토큰이 있습니다.')
        return json.dumps(transform(parsed, restore_value), ensure_ascii=False)

    @staticmethod
    def _keys(value):
        if isinstance(value, dict):
            for key, item in value.items():
                yield key
                yield from Masker._keys(item)
        elif isinstance(value, list):
            for item in value:
                yield from Masker._keys(item)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('Gemini 리디렉션을 차단했습니다.')


def _drop_array_bounds(value):
    if isinstance(value, dict):
        return {key: _drop_array_bounds(item) for key, item in value.items() if key not in {'minItems', 'maxItems'}}
    if isinstance(value, list):
        return [_drop_array_bounds(item) for item in value]
    return value


def gemini_response_schema(schema):
    """Flatten LiteRT's per-field compact variants for Gemini's grammar budget.

    Values, per-field choice rules, incident IDs and source provenance still go
    through the existing app validator after local restoration. No user enum is
    moved outside masking, and the caller's schema is never mutated.
    """
    if not schema:
        return schema
    copied = json.loads(json.dumps(schema))
    facts = copied.get('properties', {}).get('facts', {})
    variants = facts.get('items', {}).get('anyOf', [])
    if not variants or not all(v.get('type') == 'object' and {'r', 'v', 's', 'a'} <= v.get('properties', {}).keys() for v in variants):
        return _drop_array_bounds(copied)
    properties = dict(variants[0]['properties'])
    identifiers = list(dict.fromkeys(identifier for v in variants for identifier in v['properties']['r'].get('enum', [])))
    statuses = list(dict.fromkeys(code for v in variants for code in v['properties']['s'].get('enum', [])))
    properties['r'] = {'type': 'string', 'enum': identifiers}
    properties['s'] = {'type': 'string', 'enum': statuses}
    properties['v'] = {'anyOf': [{'type': 'string', 'minLength': 1},
                                {'type': 'array', 'minItems': 1, 'items': {'type': 'string', 'minLength': 1}}]}
    minimum = min(v['properties']['a'].get('minItems', 0) for v in variants)
    if minimum:
        properties['a']['minItems'] = minimum
    else:
        properties['a'].pop('minItems', None)
    # Removing counted-array expansion leaves enough grammar budget for the
    # original compact defaults; do not force empty/default fields in every fact.
    required = [key for key in variants[0].get('required', []) if all(key in v.get('required', []) for v in variants)]
    facts['items'] = {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}
    return _drop_array_bounds(copied)


class GeminiError(ValueError):
    """Safe diagnostic codes: never includes provider text, input, or key."""
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def call_gemini(masked, key, model):
    config = {'temperature': .1, 'maxOutputTokens': 16384 if masked.get('task') == 'draft' else 8192, 'responseMimeType': 'application/json'}
    low_intake = masked.get('task') == 'intake' and os.getenv('DARI_GEMINI_INTAKE_THINKING', 'low') == 'low'
    if (masked.get('purpose') in {'example', 'draft-batch'} or low_intake) and model.startswith(('gemini-3.', 'gemini-4-')):
        config['thinkingConfig'] = {'thinkingLevel': 'LOW'}
    if masked.get('responseSchema'):
        config['responseJsonSchema'] = gemini_response_schema(masked['responseSchema'])
    body = {'systemInstruction': {'parts': [{'text': masked['system'] +
            '\nPrivacy aliases beginning with ⟦DARI_ are opaque exact source text. Copy them verbatim; never translate, split, expand or invent them. Return JSON only.'}]},
            'contents': [{'role': 'user', 'parts': [{'text': masked['prompt']}]}], 'generationConfig': config}
    request = Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                      data=json.dumps(body).encode(), method='POST',
                      headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    try:
        # Do not forward credentials through redirects or ambient HTTP proxies.
        with build_opener(ProxyHandler({}), NoRedirect()).open(request, timeout=120) as response:
            result = json.load(response)
        candidates = result.get('candidates', [])
        if not candidates:
            raise GeminiError('BLOCKED', 'Gemini가 요청에 응답하지 않았습니다. 안전성 차단 여부를 확인해 주세요.')
        candidate = candidates[0]
        reason = candidate.get('finishReason')
        if reason == 'MAX_TOKENS':
            raise GeminiError('OUTPUT_LIMIT', 'Gemini 응답이 길이 제한에 도달했습니다. 요청 범위를 줄여 다시 시도해 주세요.')
        if reason != 'STOP':
            raise GeminiError('INCOMPLETE', 'Gemini가 응답을 완료하지 못했습니다. 입력은 보존되어 있으니 다시 시도해 주세요.')
        text = ''.join(p.get('text', '') for p in candidate.get('content', {}).get('parts', []) if not p.get('thought'))
        if not text.strip():
            raise GeminiError('EMPTY', 'Gemini가 빈 응답을 반환했습니다. 다시 시도해 주세요.')
        return text
    except HTTPError as error:
        if error.code == 400:
            # Read only to classify known schema errors. Never log the body.
            body = error.read(65536).decode(errors='replace').lower()
            error.close()
            if 'schema' in body and any(word in body for word in ('complex', 'nest', 'constraint', 'too many')):
                raise GeminiError('SCHEMA', 'Gemini가 응답 형식의 복잡도 제한으로 요청을 거절했습니다. 서버의 응답 스키마를 확인해 주세요.') from None
            raise GeminiError('INVALID_REQUEST', 'Gemini가 요청 형식을 거절했습니다 (HTTP 400). 서버 설정을 확인해 주세요.') from None
        error.close()
        messages = {401: ('AUTH', 'Gemini API 키 인증에 실패했습니다.'),
                    403: ('PERMISSION', 'Gemini API 권한 또는 프로젝트 설정을 확인해 주세요.'),
                    404: ('MODEL', '설정한 Gemini 모델을 사용할 수 없습니다.'),
                    429: ('QUOTA', 'Gemini 호출 한도에 도달했습니다. 잠시 후 다시 시도하거나 할당량을 확인해 주세요.')}
        code, message = messages.get(error.code, ('PROVIDER', 'Gemini 서버 오류입니다. 잠시 후 다시 시도해 주세요.'))
        raise GeminiError(code, message) from None
    except GeminiError:
        raise
    except (URLError, TimeoutError):
        raise GeminiError('NETWORK', 'Gemini 연결이 끊겼거나 응답 시간을 초과했습니다. 잠시 후 다시 시도해 주세요.') from None
    except Exception:
        raise GeminiError('INVALID_RESPONSE', 'Gemini 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.') from None



def generate(payload):
    key = os.getenv('GEMINI_API_KEY')
    if not key:
        raise ValueError('서버의 GEMINI_API_KEY를 설정해 주세요. 원문 전송은 차단되었습니다.')
    if payload.get('purpose') not in {None, 'example', 'draft-batch'}:
        raise ValueError('지원하지 않는 생성 용도입니다.')
    known = payload.get('maskValues', [])
    if not isinstance(known, list) or len(known) > 1000 or any(not isinstance(v, str) or len(v) > 12000 for v in known):
        raise ValueError('구조화 개인정보 입력을 확인해 주세요.')
    started = time.perf_counter()
    masker = Masker(detectors())
    loaded_ms = round((time.perf_counter() - started) * 1000)
    # Decode prompt JSON first so escaped Unicode/quotes cannot evade detection.
    try:
        prompt = json.loads(payload['prompt'])
    except ValueError:
        prompt = payload['prompt']
    outbound = {'system': payload['system'], 'prompt': prompt, 'responseSchema': payload.get('responseSchema')}
    try:
        masked = masker.mask(outbound, known)
    except Exception:
        raise ValueError('마스킹 처리 실패. 원문 전송을 차단했습니다.') from None
    if not isinstance(masked['prompt'], str):
        masked['prompt'] = json.dumps(masked['prompt'], ensure_ascii=False)
    masked_ms = round((time.perf_counter() - started) * 1000)
    masked['task'] = payload.get('task')
    if payload.get('purpose') in {'example', 'draft-batch'}:
        masked['purpose'] = payload['purpose']
    model = model_name()
    provider_started = time.perf_counter()
    text = masker.restore(call_gemini(masked, key, model))
    provider_ms = round((time.perf_counter() - provider_started) * 1000)
    print(json.dumps({'event': 'hybrid_timing', 'modelLoadMs': loaded_ms, 'maskingMs': masked_ms - loaded_ms, 'providerMs': provider_ms}), flush=True)
    return {'text': text, 'model': model, 'mode': 'hybrid', 'stats': {
        'runtime': 'gemini', 'constrained': bool(payload.get('responseSchema')),
        'totalMs': round((time.perf_counter() - started) * 1000), 'maskingMs': masked_ms - loaded_ms, 'modelLoadMs': loaded_ms, 'providerMs': provider_ms}}
