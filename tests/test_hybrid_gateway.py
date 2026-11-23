import io
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
import unittest
from unittest.mock import patch

import hybrid_gateway as gateway
import local_verification_server as server


class FakeDetector:
    def spans(self, text):
        for entity in ['Amina Diallo', 'Sunni', 'asthma']:
            start = text.find(entity)
            if start >= 0:
                yield start, start + len(entity), 'test'


class HybridTests(unittest.TestCase):
    def payload(self):
        quote = 'Amina Diallo: Sunni, asthma. aminatest@example.org. Not detained on 2024-05-12.'
        return {'task': 'intake', 'system': 'Extract source quotes.',
                'prompt': json.dumps({'content': quote}),
                'responseSchema': {'type': 'object', 'properties': {'quote': {'type': 'string', 'enum': [quote]}}, 'required': ['quote']},
                'maskValues': ['Amina Diallo']}

    @patch.dict(os.environ, {'DARI_LLM_PROVIDER': 'gemini', 'GEMINI_API_KEY': 'test-key'})
    def test_end_to_end_masks_schema_and_restores_exact_quotes(self):
        payload = self.payload()
        sent = []
        def transport(masked, key, model):
            wire = json.dumps(masked)
            for raw in ['Amina', 'Diallo', 'Sunni', 'asthma', 'aminatest@example.org']:
                self.assertNotIn(raw, wire)
            quote = json.loads(masked['prompt'])['content']
            self.assertIn('Not detained on 2024-05-12', quote)
            self.assertEqual(masked['responseSchema']['properties']['quote']['enum'], [quote])
            sent.append(masked)
            return json.dumps({'quote': quote})
        with patch.object(gateway, 'detectors', return_value=FakeDetector()), patch.object(gateway, 'call_gemini', side_effect=transport):
            result = server.generate_intake(payload)
        self.assertEqual(json.loads(result['text'])['quote'], json.loads(payload['prompt'])['content'])
        self.assertEqual(result['mode'], 'hybrid')
        self.assertEqual(len(sent), 1)
        self.assertFalse(server.INTAKE_LOCK.locked())

    def test_date_policy_uses_nearest_birth_or_event_cue(self):
        class Dates:
            def spans(self, text):
                for match in __import__('re').finditer(r'2000-01-01|2024-05-12', text):
                    yield match.start(), match.end(), 'DATE_OF_BIRTH'
        masker = gateway.Masker(Dates())
        masked = masker.mask('I was born on 2000-01-01. I was not detained on 2024-05-12.')
        self.assertNotIn('2000-01-01', masked)
        self.assertIn('not detained on 2024-05-12', masked)

    def test_restore_handles_quotes_backslashes_and_unicode(self):
        raw = '김 "가상" \\ 이름'
        masker = gateway.Masker(FakeDetector())
        masked = masker.mask({'value': raw}, [raw])
        self.assertEqual(json.loads(masker.restore(json.dumps(masked))), {'value': raw})

    def test_overlap_and_stable_repeated_alias(self):
        class Overlap:
            def spans(self, text):
                return [(0, 5, 'name'), (3, 9, 'name')]
        masker = gateway.Masker(Overlap())
        masked = masker.mask(['abcdefghi', 'abcdefghi'])
        self.assertEqual(masked[0], masked[1])
        self.assertEqual(json.loads(masker.restore(json.dumps(masked))), ['abcdefghi'] * 2)

    def test_reserved_and_unknown_tokens_fail_closed(self):
        masker = gateway.Masker(FakeDetector())
        for value in ['⟦DARI_fake_0⟧', '⟦DARI_broken']:
            with self.assertRaises(ValueError):
                masker.mask(value)
            with self.assertRaises(ValueError):
                masker.restore(json.dumps({'quote': value}))
        with self.assertRaises(ValueError):
            masker.restore('not JSON')

    @patch.dict(os.environ, {'DARI_LLM_PROVIDER': 'gemini', 'GEMINI_API_KEY': 'test-key'})
    def test_detector_failure_never_calls_cloud_or_ollama(self):
        with patch.object(gateway, 'detectors', side_effect=ValueError('failed')), patch.object(gateway, 'call_gemini') as cloud, patch.object(server, 'urlopen') as ollama:
            with self.assertRaises(ValueError):
                server.generate_intake(self.payload())
        cloud.assert_not_called()
        ollama.assert_not_called()
        self.assertFalse(server.INTAKE_LOCK.locked())

    @patch.dict(os.environ, {'DARI_LLM_PROVIDER': 'gemini', 'GEMINI_API_KEY': ''})
    def test_missing_key_blocks_before_loading_models(self):
        with patch.object(gateway, 'detectors') as detector, patch.object(gateway, 'call_gemini') as cloud:
            with self.assertRaises(ValueError):
                server.generate_intake(self.payload())
        detector.assert_not_called()
        cloud.assert_not_called()

    @patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'})
    def test_provider_request_uses_header_and_masked_structured_output(self):
        response = io.BytesIO(json.dumps({'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': '{"ok":true}'}]}}]}).encode())
        with patch.object(gateway, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            text = gateway.call_gemini({'system': 'extract', 'prompt': 'masked', 'responseSchema': {'type': 'object'}}, 'test-key', 'gemini-3.8-flash')
        request = opener.return_value.open.call_args.args[0]
        self.assertNotIn('test-key', request.full_url)
        self.assertEqual(request.get_header('X-goog-api-key'), 'test-key')
        self.assertEqual(json.loads(request.data)['generationConfig']['responseJsonSchema'], {'type': 'object'})
        self.assertEqual(json.loads(text), {'ok': True})

    def test_examples_and_intake_use_low_thinking_while_drafts_keep_default(self):
        for purpose, task, expected in [(None, None, False), ('example', 'intake', True), (None, 'intake', True), (None, 'draft', False), ('draft-batch', 'draft', True)]:
            response = io.BytesIO(json.dumps({'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': '{"answer":"fictional"}'}]}}]}).encode())
            with patch.object(gateway, 'build_opener') as opener:
                opener.return_value.open.return_value = response
                gateway.call_gemini({'system': 'test', 'prompt': 'synthetic', 'purpose': purpose, 'task': task}, 'test-key', 'gemini-3.8-flash')
            config = json.loads(opener.return_value.open.call_args.args[0].data)['generationConfig']
            self.assertEqual(config.get('thinkingConfig'), {'thinkingLevel': 'LOW'} if expected else None)
            self.assertEqual(config['maxOutputTokens'], 16384 if task == 'draft' else 8192)

    def test_real_compact_schema_fits_flat_shape_without_mutating_source(self):
        schema = json.loads((Path(__file__).parent / 'fixtures/gemini-compact-schema.json').read_text(encoding='utf-8'))
        original = json.dumps(schema)
        variants = schema['properties']['facts']['items']['anyOf']
        flat = gateway.gemini_response_schema(schema)
        item = flat['properties']['facts']['items']
        self.assertNotIn('anyOf', item)
        self.assertEqual(set(item['properties']['r']['enum']), {id for variant in variants for id in variant['properties']['r']['enum']})
        self.assertEqual(item['properties']['q']['items'], variants[0]['properties']['q']['items'])
        self.assertEqual(set(item['required']), set.intersection(*(set(v['required']) for v in variants)))
        self.assertEqual(item['properties']['a']['items'], variants[0]['properties']['a']['items'])
        self.assertNotIn('maxItems', json.dumps(flat))
        self.assertLess(len(json.dumps(flat)), len(original) / 2)
        self.assertEqual(json.dumps(schema), original)

    def test_safe_error_codes_distinguish_schema_quota_timeout_and_truncation(self):
        errors = [(HTTPError('https://test', 400, 'bad', {}, io.BytesIO(b'secret-key: response schema too complex')), 'SCHEMA'),
                  (HTTPError('https://test', 429, 'bad', {}, io.BytesIO(b'secret-key')), 'QUOTA'),
                  (URLError('secret-key'), 'NETWORK')]
        for error, code in errors:
            with patch.object(gateway, 'build_opener') as opener:
                opener.return_value.open.side_effect = error
                with self.assertRaises(gateway.GeminiError) as caught:
                    gateway.call_gemini({'system': '', 'prompt': ''}, 'secret-key', 'gemini-3.8-flash')
            self.assertEqual(caught.exception.code, code)
            self.assertNotIn('secret-key', str(caught.exception))
        response = io.BytesIO(json.dumps({'candidates': [{'finishReason': 'MAX_TOKENS'}]}).encode())
        with patch.object(gateway, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            with self.assertRaises(gateway.GeminiError) as caught:
                gateway.call_gemini({'system': '', 'prompt': ''}, 'secret-key', 'gemini-3.8-flash')
        self.assertEqual(caught.exception.code, 'OUTPUT_LIMIT')

    def test_provider_errors_never_echo_sensitive_response(self):
        with patch.object(gateway, 'build_opener', side_effect=RuntimeError('secret: private input and key')):
            with self.assertRaises(ValueError) as error:
                gateway.call_gemini({'system': '', 'prompt': ''}, 'key', 'gemini-3.8-flash')
        self.assertNotIn('secret', str(error.exception))

    def test_model_name_cannot_change_host_or_endpoint(self):
        with patch.dict(os.environ, {'DARI_GEMINI_MODEL': '../bad?key=secret'}), self.assertRaises(ValueError):
            gateway.model_name()

    @patch.dict(os.environ, {'DARI_LLM_PROVIDER': 'gemini', 'GEMINI_API_KEY': 'test-key'})
    def test_hybrid_status_does_not_need_ollama(self):
        with patch.object(gateway, 'cached_paths', return_value=['nym', 'gliner']), patch.object(server, 'urlopen') as local:
            status = server.intake_status()
        self.assertEqual(status['mode'], 'hybrid')
        self.assertTrue(status['modelReady'])
        local.assert_not_called()


if __name__ == '__main__':
    unittest.main()
