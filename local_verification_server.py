#!/usr/bin/env python3
"""Development-only loopback bridge for DARI clients and Ollama.

It listens only on 127.0.0.1. The Android emulator can reach the host at
10.0.2.2; a browser on the same computer uses localhost. Do not expose this
server to a LAN or the public internet with real refugee statements.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import threading
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
ALLOWED_MODELS = {"qwen3:4b", "llama3.2:3b"}
INTAKE_MODELS = {"gemma4:e4b", "gemma4:e2b", "gemma3n:e4b", "qwen3:4b", "llama3.2:3b"}
INTAKE_LOCK = threading.Lock()
TRANSLATION_TARGETS = {"en", "ko", "ru", "ar", "fr", "fa"}
LANGUAGE_NAMES = {"en": "English", "ko": "Korean", "ru": "Russian", "ar": "Arabic", "fr": "French", "fa": "Persian"}
ALLOWED_ORIGINS = {
    "http://localhost:5173", "http://localhost:4173", "http://localhost",
    "http://127.0.0.1:5188", "https://localhost", "capacitor://localhost",
    "http://localhost:5188", "http://127.0.0.1:5173",
}


def intake_status():
    with urlopen("http://127.0.0.1:11434/api/tags", timeout=5) as response:
        models = json.load(response).get("models", [])
    return {"mode": "local-preview", "models": [item["name"] for item in models
            if item.get("name") in INTAKE_MODELS], "busy": INTAKE_LOCK.locked()}


def generate_intake(payload):
    """Development browser adapter. Mobile clients use their native plugin instead."""
    model = payload.get("model", "gemma4:e4b")
    task = payload.get("task")
    system = payload.get("system")
    prompt = payload.get("prompt")
    if model not in INTAKE_MODELS or task not in {"intake", "draft"}:
        raise ValueError("지원하지 않는 모델 또는 작성 작업입니다.")
    if not isinstance(system, str) or not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("작성 요청의 지침과 입력을 확인해 주세요.")
    if len(system) + len(prompt) > 80000:
        raise ValueError("대화 입력이 너무 깁니다. 문항 범위를 나누어 주세요.")
    schema = payload.get("responseSchema")
    if schema is not None and (not isinstance(schema, dict) or len(json.dumps(schema)) > 40000):
        raise ValueError("응답 형식 정의를 확인해 주세요.")
    # Benchmarks compare constrained decoding with the unconstrained phone default:
    # "schema" (default) enforces the schema, "json" any JSON, "none" free text.
    output_format = payload.get("format", "schema")
    if output_format not in {"schema", "json", "none"}:
        raise ValueError("지원하지 않는 출력 형식입니다.")
    if not INTAKE_LOCK.acquire(blocking=False):
        raise ValueError("이전 모델 요청을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.")
    try:
        body = {"model": model, "stream": False,
                "messages": [{"role": "system", "content": system},
                             {"role": "user", "content": prompt}],
                "options": {"temperature": 0.1, "num_ctx": 16384,
                            "num_predict": 4096 if task == "draft" else 3072}}
        if output_format != "none":
            body["format"] = (schema or "json") if output_format == "schema" else "json"
        if model.startswith(("qwen3", "gemma4")):
            body["think"] = False
        request = Request("http://127.0.0.1:11434/api/chat", data=json.dumps(body).encode(),
                          headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=300) as response:
            result = json.load(response)
        if result.get("done_reason") == "length":
            raise ValueError("모델 응답이 길이 제한에 도달했습니다. 범위를 좁혀 다시 시도해 주세요.")
        text = result.get("message", {}).get("content", "").strip()
        if not text:
            raise ValueError("모델이 작성 결과를 반환하지 않았습니다.")
        ms = lambda key: round(result.get(key, 0) / 1e6)
        per_second = lambda count, duration: round(result[count] / (result[duration] / 1e9), 1) if result.get(count) and result.get(duration) else None
        stats = {"runtime": "ollama", "constrained": output_format == "schema",
                 "totalMs": ms("total_duration"), "initMs": ms("load_duration"),
                 "prefillTokens": result.get("prompt_eval_count"), "decodeTokens": result.get("eval_count"),
                 "prefillTokPerSec": per_second("prompt_eval_count", "prompt_eval_duration"),
                 "decodeTokPerSec": per_second("eval_count", "eval_duration")}
        return {"text": text, "model": model, "mode": "local-preview",
                "stats": {key: value for key, value in stats.items() if value is not None}}
    finally:
        INTAKE_LOCK.release()


def parse_model_json(model_response):
    raw = model_response.get("response") or model_response.get("thinking") or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Small local models occasionally emit a literal or incomplete `\u`
        # escape inside an otherwise valid JSON string. Keep it as text rather
        # than rejecting the complete verification response.
        repaired = re.sub(r"\\u(?![0-9a-fA-F]{4})", r"\\\\u", raw)
        repaired = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", repaired)
        return json.loads(repaired)


def call_ollama(model, prompt, timeout=120, num_predict=None, think=None):
    if model not in ALLOWED_MODELS:
        raise ValueError("허용되지 않은 모델입니다.")
    options = {"temperature": 0}
    if num_predict is not None:
        options["num_predict"] = num_predict
    body = {
        "model": model, "prompt": prompt, "stream": False,
        "format": "json", "options": options,
    }
    if think is not None:
        body["think"] = think
    request_body = json.dumps(body).encode()
    request = Request(OLLAMA_URL, data=request_body, headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request, timeout=timeout) as response:
        return parse_model_json(json.load(response))


def translate(payload):
    model = payload.get("model", "qwen3:4b")
    source_language = str(payload.get("source_language", "unknown"))
    target_language = str(payload.get("target_language", ""))
    text = str(payload.get("text", "")).strip()
    if not text or len(text) > 12000:
        raise ValueError("번역할 텍스트 길이를 확인해 주세요.")
    if target_language not in TRANSLATION_TARGETS:
        raise ValueError("지원하지 않는 번역 대상 언어입니다.")
    prompt = (f'Translate {text} from {LANGUAGE_NAMES.get(source_language, source_language)} '
              f'to {LANGUAGE_NAMES[target_language]}. Preserve names, dates, uncertainty, '
              'and negation; do not add or omit facts. '
              'Return JSON only: {"translation":"..."}.')
    result = call_ollama(model, prompt, think=False)
    translation = str(result.get("translation", "")).strip()
    if not translation:
        raise ValueError("모델이 번역 결과를 반환하지 않았습니다.")
    return {"translation": translation}


def translate_batch(payload):
    model = payload.get("model", "qwen3:4b")
    source_language = str(payload.get("source_language", "unknown"))
    target_language = str(payload.get("target_language", ""))
    items = payload.get("items", [])
    if target_language not in TRANSLATION_TARGETS:
        raise ValueError("지원하지 않는 번역 대상 언어입니다.")
    if not isinstance(items, list) or not 1 <= len(items) <= 4:
        raise ValueError("묶음 번역은 1~4개 항목만 지원합니다.")
    normalized = []
    for item in items:
        identifier = str(item.get("id", "")).strip()
        text = str(item.get("text", "")).strip()
        if not identifier or not text or len(text) > 3500:
            raise ValueError("묶음 번역 항목을 확인해 주세요.")
        normalized.append({"id": identifier, "text": text})
    prompt = f'''You are a translation engine. Translate every item from {source_language} to {target_language}.
Preserve every fact, name, number, date, uncertainty, negation, and paragraph break. Do not add, omit, explain, summarize, or give legal advice.
Return JSON only in this exact shape: {{"items":[{{"id":"original id","translation":"translated text"}}]}}.
Keep every id exactly unchanged and return one item for each input item.

Input:
{json.dumps(normalized, ensure_ascii=False)}'''
    result = call_ollama(model, prompt, think=False)
    translated = result.get("items", [])
    if not isinstance(translated, list):
        raise ValueError("모델이 묶음 번역 결과를 반환하지 않았습니다.")
    output = []
    expected = {item["id"] for item in normalized}
    for item in translated:
        identifier = str(item.get("id", "")).strip()
        text = str(item.get("translation", "")).strip()
        if identifier in expected and text:
            output.append({"id": identifier, "translation": text})
    if {item["id"] for item in output} != expected:
        raise ValueError("모델이 묶음 번역의 일부 항목을 반환하지 않았습니다.")
    return {"items": output}


def ask_model(payload):
    model = payload.get("model")
    if model not in ALLOWED_MODELS:
        raise ValueError("허용되지 않은 검증 모델입니다.")
    prompt = f'''You are a neutral translation-integrity auditor for a refugee application draft.
Compare the complete source-language answers with the complete English translation. Detect only distortions introduced by translation. Never judge whether the claim is true, credible, legally sufficient, or likely to receive asylum. Never suggest wording that would improve the application.

Pay special attention to changes that could make the applicant's account appear stronger or weaker to a reviewer. "Favorable" and "unfavorable" describe the apparent direction of the translation change, not an asylum decision prediction.

Check these distortion types:
1. omission; 2. unsupported addition; 3. negation or polarity reversal; 4. certainty or intensity shift; 5. actor, victim, or agency shift; 6. chronology, date, duration, or frequency shift; 7. location, identity, number, or relationship change; 8. causality or motive shift; 9. harm, threat, or coercion severity shift; 10. legal or persuasive framing absent from the source; 11. contradiction across answers.

For each real discrepancy, create a separate item and classify direction as "유리하게 강화", "불리하게 약화", or "방향 불명확".
- "유리하게 강화": the translation makes harm, threat, frequency, certainty, persecution motive, or causal connection stronger than the source; invents a weapon, injury, protected-ground motive, or repeated event; or removes the source's uncertainty or limiting qualification.
- "불리하게 약화": the translation reduces or omits harm, threat, frequency, certainty, motive, agency, or causal connection; adds uncertainty absent from the source; or turns the applicant into the aggressor.
- "방향 불명확": the factual meaning changes, but its likely directional effect cannot be inferred without deciding the claim.
Evaluate the direction of the translation change as a whole. For example, changing "threatened once; I saw no weapon" to "repeatedly threatened to kill me with a gun" is "유리하게 강화", because the translation invents repetition, intent to kill, and a gun. Do not label it unfavorable merely because the limiting phrase was omitted.

Audit every numbered answer and return every material discrepancy, not only the first. Quote only the minimum necessary excerpts. If no material distortion exists, return an empty distortions array. Write summary and explanations in Korean.

Return JSON only in this exact shape:
{{"distortion_found":true,"summary":"전체 검증 요약","distortions":[{{"type":"누락","direction":"불리하게 약화","severity":"높음|중간|낮음","question_number":"14.1","source_excerpt":"...","translation_excerpt":"...","explanation":"왜 의미가 달라졌는지"}}]}}

Source language: {payload.get("source_language", "unknown")}
Source statement:
{payload.get("source_text", "")}

English translation:
{payload.get("translation_text", "")}
'''
    # Verification has a larger prompt than translation. Limit the report size
    # and allow the local model additional time to finish the structured result.
    result = call_ollama(model, prompt, timeout=300, num_predict=900)
    distortions = result.get("distortions", [])
    if not isinstance(distortions, list):
        distortions = []
    return {
        "distortion_found": bool(result.get("distortion_found", bool(distortions))),
        "summary": str(result.get("summary", "자동 검증 결과를 확인해 주세요.")),
        "distortions": distortions,
    }


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, result):
        body = json.dumps(result, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self):
        if self.path == "/v1/intake/status":
            try:
                self.send_json(200, intake_status())
            except (URLError, HTTPError, TimeoutError) as error:
                self.send_json(502, {"error": f"Ollama 연결 실패: {error}"})
            return
        if self.path not in {"/", "/health"}:
            self.send_json(404, {"error": "존재하지 않는 API 경로입니다."})
            return
        self.send_json(200, {
            "status": "ok",
            "service": "DARI local translation and verification server",
            "endpoints": ["POST /v1/translate", "POST /v1/translate/batch", "POST /v1/translation/verify"],
            "note": "개발 컴퓨터에서만 사용하는 로컬 서버입니다.",
        })

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 1000000:
                raise ValueError("요청 크기를 확인해 주세요.")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("JSON 객체를 보내 주세요.")
            if self.path == "/v1/intake/generate":
                result = generate_intake(payload)
            elif self.path == "/v1/translation/verify":
                # Accept both the original Android contract and the web-client contract.
                payload["source_text"] = payload.get("source_text", payload.get("source", ""))
                payload["translation_text"] = payload.get("translation_text", payload.get("translation", ""))
                result = ask_model(payload)
            elif self.path == "/v1/translate":
                result = translate(payload)
            elif self.path == "/v1/translate/batch":
                result = translate_batch(payload)
            else:
                self.send_json(404, {"error": "존재하지 않는 API 경로입니다."})
                return
            self.send_json(200, result)
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except (URLError, HTTPError, TimeoutError) as error:
            self.send_json(502, {"error": f"Ollama 오류: {error}"})

    def log_message(self, format, *args):
        print("DARI local server:", format % args)


if __name__ == "__main__":
    print("DARI development server: http://127.0.0.1:8765")
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
