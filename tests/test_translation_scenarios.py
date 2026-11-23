import json
from pathlib import Path
import re
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/translation-bench'))
import repeat_scenarios as runner
import application_translation

class ScenarioTests(unittest.TestCase):
    def test_all_scenarios_are_fictional_unique_and_fit_the_application(self):
        data=json.loads((ROOT/'tools/translation-bench/scenarios/russian-v4.json').read_text(encoding='utf-8'))
        self.assertEqual(len(data['scenarios']),10)
        ids=set()
        for scene in data['scenarios']:
            self.assertTrue(scene['fictional'])
            questions=set()
            for case in scene['cases']:
                self.assertNotIn(case['id'],ids);ids.add(case['id'])
                self.assertNotIn(case['question_id'],questions);questions.add(case['question_id'])
                self.assertIn(case['question_id'],application_translation.PROFILES)
                self.assertTrue(case['expected'].strip())
                for check in case['checks']:
                    for pattern in check.get('any',[])+check.get('none',[]):re.compile(pattern)
        self.assertEqual(len(ids),80)

    def test_original_names_and_dates_are_checked_exactly(self):
        case={'source':'ТЕСТОВ','checks':[]}
        self.assertEqual(runner.inspect(case,'ТЕСТОВ',True),[])
        self.assertEqual(runner.inspect(case,'테스토프',True),['PASSTHROUGH_CHANGED'])

    def test_regex_hits_are_review_flags_not_accuracy_labels(self):
        case={'source':'Пример','checks':[{'label':'연령 추가','none':['19']}]}
        self.assertIn('연령 추가',runner.inspect(case,'동행하는 19세 자녀입니다.'))
        self.assertIn('COPIED_SOURCE',runner.inspect(case,'Пример'))
        row={'round':1,'case_id':'x','kind':'model','seconds':.5,'flags':[],'translation':'번역'}
        result=runner.summarize([row])
        self.assertNotIn('accuracy',result)
        self.assertIn('does not certify',result['meaning'])

    def test_repeat_changes_and_request_errors_are_not_hidden(self):
        rows=[{'round':1,'case_id':'x','kind':'model','seconds':1,'flags':[],'translation':'있습니다'},
              {'round':2,'case_id':'x','kind':'model','seconds':2,'flags':[],'translation':'없습니다'},
              {'round':3,'case_id':'x','kind':'model','seconds':3,'flags':['REQUEST_ERROR'],'error':'timeout'}]
        result=runner.summarize(rows)
        self.assertEqual(result['varying_cases'],['x'])
        self.assertEqual(result['request_errors'],1)
        self.assertEqual(result['flagged_observations'],1)

if __name__=='__main__':unittest.main()
