#!/usr/bin/env python3
"""Local-only bridge: Android emulator -> this Mac -> Ollama.

It listens only on 127.0.0.1. Android Emulator reaches the host loopback at
10.0.2.2, so no LAN or public server is exposed.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
ALLOWED_MODELS = {"qwen3:4b", "llama3.2:3b"}


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
    request_body = json.dumps({"model": model, "prompt": prompt, "stream": False, "format": "json", "options": {"temperature": 0}}).encode()
    request = Request(OLLAMA_URL, data=request_body, headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request, timeout=120) as response:
        model_response = json.load(response)
    # Qwen3 may emit its structured answer in `thinking`; other models use `response`.
    result = json.loads(model_response.get("response") or model_response.get("thinking") or "{}")
    distortions = result.get("distortions", [])
    if not isinstance(distortions, list):
        distortions = []
    return {
        "distortion_found": bool(result.get("distortion_found", bool(distortions))),
        "summary": str(result.get("summary", "자동 검증 결과를 확인해 주세요.")),
        "distortions": distortions,
    }


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/v1/translation/verify":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            result = ask_model(payload)
            body = json.dumps(result, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            self.send_error(400, str(error))
        except (URLError, HTTPError, TimeoutError) as error:
            self.send_error(502, f"Ollama 오류: {error}")

    def log_message(self, format, *args):
        print("DARI local server:", format % args)


if __name__ == "__main__":
    print("DARI local verification server: http://127.0.0.1:8765")
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
