import io
import json
import unittest
from unittest.mock import patch

import local_verification_server as server


class IntakeServerTests(unittest.TestCase):
    def payload(self):
        return {"task": "intake", "model": "gemma4:e4b", "system": "collect facts", "prompt": "fictional example"}

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
