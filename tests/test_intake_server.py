import io
import json
import unittest
import threading
from urllib.request import Request, urlopen
from unittest.mock import patch

import local_verification_server as server


class IntakeServerTests(unittest.TestCase):
    def test_integration_origins_receive_cors_for_status_and_preflight(self):
        httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        worker = threading.Thread(target=httpd.serve_forever, daemon=True)
        worker.start()
        base = f'http://127.0.0.1:{httpd.server_address[1]}'
        try:
            for origin in ['http://127.0.0.1:5192', 'http://localhost:5192', 'http://127.0.0.1:5193', 'http://localhost:5193']:
                with self.subTest(origin=origin), patch.object(server, 'intake_status', return_value={'models': ['gemma4:e4b'], 'busy': False}):
                    with urlopen(Request(base + '/v1/intake/status', headers={'Origin': origin}), timeout=3) as response:
                        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), origin)
                    with urlopen(Request(base + '/v1/intake/generate', method='OPTIONS', headers={'Origin': origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'}), timeout=3) as response:
                        self.assertEqual(response.status, 204)
                        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), origin)
                        self.assertIn('POST', response.headers.get('Access-Control-Allow-Methods'))
            with urlopen(Request(base + '/health', headers={'Origin': 'https://untrusted.example'}), timeout=3) as response:
                self.assertIsNone(response.headers.get('Access-Control-Allow-Origin'))
        finally:
            httpd.shutdown()
            httpd.server_close()
            worker.join(timeout=3)

    def test_translation_requires_nonempty_translation_field(self):
        response = io.BytesIO(json.dumps({"response": '{"translation":"러시아"}'}).encode())
        with patch.object(server, "urlopen", return_value=response) as mocked:
            result = server.translate({"model":"qwen3:4b", "text":"Россия", "source_language":"ru", "target_language":"ko"})
        body = json.loads(mocked.call_args.args[0].data)
        self.assertEqual(body["format"]["required"], ["translation"])
        self.assertEqual(body["format"]["properties"]["translation"]["minLength"], 1)
        self.assertFalse(body["think"])
        self.assertEqual(result["translation"], "러시아")
        with patch.object(server, "call_ollama", return_value={"translation":""}), self.assertRaises(ValueError):
            server.translate({"text":"пример", "source_language":"ru", "target_language":"ko"})

    def payload(self):
        return {"task": "intake", "model": "gemma4:e4b", "system": "collect facts", "prompt": "fictional example"}

    def test_application_specialist_uses_plain_translation_prompt_and_rejects_incomplete_output(self):
        payload = {"question_id":"9.8", "text":"Не применимо: паспорт находится у меня.", "source_language":"ru", "target_language":"ko", "model":"dari-hymt2:1.8b"}
        response = io.BytesIO(json.dumps({"response":"해당 없음: 여권을 소지하고 있습니다.","done_reason":"stop"}).encode())
        with patch.object(server, "urlopen", return_value=response) as mocked:
            result = server.translate(payload)
        body = json.loads(mocked.call_args.args[0].data)
        self.assertNotIn("format", body)
        self.assertEqual(body["options"]["temperature"], 0)
        self.assertEqual(result["model"], "dari-hymt2:1.8b")
        for data in [{"response":payload["text"],"done_reason":"stop"}, {"response":"일부 번역","done_reason":"length"}]:
            with self.subTest(data=data), patch.object(server,"urlopen",return_value=io.BytesIO(json.dumps(data).encode())), self.assertRaises(ValueError):
                server.translate(payload)

    def test_application_guard_distinguishes_names_and_dates_from_copied_sentences(self):
        server.validate_application_translation("ПРИМЕРОВ", "ru", "ПРИМЕРОВ", "1.2")
        server.validate_application_translation("2024/01/10", "ru", "2024/01/10", "9.3")
        server.validate_application_translation("Мать: Елена Примерова.", "ru", "어머니는 Елена Примерова입니다.", "4")
        with self.assertRaisesRegex(ValueError, "UNTRANSLATED_ANSWER"):
            server.validate_application_translation("Не исповедую религию.","ru","Не исповедую религию.","1.11")
        with self.assertRaisesRegex(ValueError, "UNTRANSLATED_ANSWER"):
            server.validate_application_translation("Паспорт находится у меня.","ru","해당 없음. Паспорт находится у меня.","9.8")

    def test_intake_uses_local_chat_and_preserves_structured_response(self):
        response = io.BytesIO(json.dumps({"message": {"content": '{"question":"언제인가요?"}'}, "done_reason": "stop"}).encode())
        with patch.object(server, "urlopen", return_value=response) as mocked:
            result = server.generate_intake(self.payload())
        request = mocked.call_args.args[0]
        self.assertEqual(request.full_url, "http://127.0.0.1:11434/api/chat")
        body = json.loads(request.data)
        self.assertFalse(body["think"])
        self.assertEqual(body["messages"][0]["role"], "system")
        self.assertEqual(json.loads(result["text"])["question"], "언제인가요?")
        self.assertFalse(server.INTAKE_LOCK.locked())

    def test_rejects_nonallowlisted_model_before_network(self):
        payload = self.payload() | {"model": "gemma4:cloud"}
        with patch.object(server, "urlopen") as mocked, self.assertRaises(ValueError):
            server.generate_intake(payload)
        mocked.assert_not_called()

    def test_forwards_response_schema_without_changing_it(self):
        schema = {"type": "object", "properties": {"reply": {"type": "string"}}, "required": ["reply"]}
        response = io.BytesIO(json.dumps({"message": {"content": '{"reply":"hello"}'}}).encode())
        with patch.object(server, "urlopen", return_value=response) as mocked:
            server.generate_intake(self.payload() | {"responseSchema": schema})
        self.assertEqual(json.loads(mocked.call_args.args[0].data)["format"], schema)

    def test_benchmark_format_modes_and_stats(self):
        schema = {"type": "object", "properties": {"reply": {"type": "string"}}, "required": ["reply"]}
        sent = {}
        for mode in ["schema", "json", "none"]:
            response = io.BytesIO(json.dumps({"message": {"content": '{"reply":"hello"}'}, "prompt_eval_count": 120,
                                              "prompt_eval_duration": 2e9, "eval_count": 30, "eval_duration": 3e9,
                                              "total_duration": 6e9, "load_duration": 1e9}).encode())
            with patch.object(server, "urlopen", return_value=response) as mocked:
                result = server.generate_intake(self.payload() | {"responseSchema": schema, "format": mode})
            sent[mode] = json.loads(mocked.call_args.args[0].data).get("format")
        self.assertEqual(sent, {"schema": schema, "json": "json", "none": None})
        self.assertEqual(result["stats"], {"runtime": "ollama", "constrained": False, "totalMs": 6000, "initMs": 1000,
                                           "prefillTokens": 120, "decodeTokens": 30, "prefillTokPerSec": 60.0, "decodeTokPerSec": 10.0})
        with patch.object(server, "urlopen") as mocked, self.assertRaises(ValueError):
            server.generate_intake(self.payload() | {"format": "xml"})
        mocked.assert_not_called()

    def test_rejects_invalid_response_schema(self):
        with patch.object(server, "urlopen") as mocked, self.assertRaises(ValueError):
            server.generate_intake(self.payload() | {"responseSchema": "not a schema"})
        mocked.assert_not_called()

    def test_truncated_output_is_not_accepted_as_complete(self):
        response = io.BytesIO(json.dumps({"message": {"content": '{}'}, "done_reason": "length"}).encode())
        with patch.object(server, "urlopen", return_value=response), self.assertRaises(ValueError):
            server.generate_intake(self.payload())
        self.assertFalse(server.INTAKE_LOCK.locked())

    def test_model_stays_loaded_between_slow_answers(self):
        response = io.BytesIO(json.dumps({"message": {"content": '{"reply":"ok"}'}}).encode())
        with patch.object(server, "urlopen", return_value=response) as mocked:
            server.generate_intake(self.payload())
        body = json.loads(mocked.call_args[0][0].data)
        self.assertEqual(body["keep_alive"], server.KEEP_ALIVE)

    def test_busy_model_does_not_start_another_request(self):
        server.INTAKE_LOCK.acquire()
        try:
            with patch.object(server, "urlopen") as mocked, self.assertRaises(ValueError):
                server.generate_intake(self.payload())
            mocked.assert_not_called()
        finally:
            server.INTAKE_LOCK.release()


if __name__ == "__main__":
    unittest.main()
