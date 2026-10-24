import type { IntakeFact } from './intake/types';
import { requirementsById } from './intake/catalog';
import './statementDetails.css';

export function StatementDetails({ fact, language, disabled, onClarify }: {
  fact: IntakeFact; language: string; disabled: boolean; onClarify: () => void;
}) {
  const t = (ko: string, en: string) => language === 'ko' ? ko : en;
  const tags = new Set<string>();
  if (fact.certainty === 'uncertain') tags.add(t('확실하지 않음', 'Uncertain'));
  if (fact.certainty === 'approximate') tags.add(t('대략적인 정보', 'Approximate'));
  if (fact.knowledge === 'heard') tags.add(t('전해 들은 내용', 'Heard from someone else'));
  if (fact.knowledge === 'inferred') tags.add(t('신청자의 추측·해석', 'Your interpretation'));
  if (fact.statements?.some(item => item.polarity === 'negative')) tags.add(t('부정 표현 포함', 'Includes a negative statement'));
  return <div className="statement-review">
    {tags.size > 0 && <div className="statement-tags">{[...tags].map(tag => <span key={tag}>{tag}</span>)}</div>}
    {!!fact.statements?.length && <details><summary>{t('누가 무엇을 했는지 확인', 'Check who did what')} · {fact.statements.length}</summary><div className="statement-items">{fact.statements.map((statement, index) => <div className="statement-item" key={index}>
      <p dir="auto">{statement.sourceQuotes[0]?.quote}</p>
      <div className="statement-tags">
        {statement.polarity === 'negative' && <span>{t('하지 않았거나 일어나지 않았다고 말함', 'Did not / was not')}</span>}
        {statement.polarity === 'unspecified' && <span>{t('의미 확인 필요', 'Meaning to clarify')}</span>}
        {statement.certainty === 'uncertain' && <span>{t('확실하지 않음', 'Uncertain')}</span>}
        {statement.knowledge === 'heard' && <span>{t('전해 들은 내용', 'Heard from someone else')}</span>}
        {statement.knowledge === 'inferred' && <span>{t('추측·해석', 'Interpretation')}</span>}
      </div>
      <dl>
        <dt>{t('누가', 'Who')}</dt><dd dir="auto">{statement.subject ?? t('확인 필요', 'To clarify')}</dd>
        <dt>{t('무엇을', 'Did what')}</dt><dd dir="auto">{statement.action}</dd>
        {statement.object && <><dt>{t('대상·내용', 'To whom / what')}</dt><dd dir="auto">{statement.object}</dd></>}
      </dl>
    </div>)}</div></details>}
    {!!fact.relatedRequirementIds?.length && <details className="statement-uses"><summary>{t('신청서에서 활용할 부분', 'Where this information is used')}</summary>
      <ul>{[...new Set([fact.requirementId, ...fact.relatedRequirementIds].map(id => requirementsById.get(id)?.questionId))].filter(Boolean).map(id => <li key={id}>{id}</li>)}</ul>
    </details>}
    {!!fact.clarification?.length && <p className="statement-gap">{t('이 부분의 의미를 한 번 더 확인해 주세요.', 'Please clarify the meaning of this part.')}</p>}
    <button type="button" className="quiet" disabled={disabled} onClick={onClarify}>{t('이 내용 확인·정정하기', 'Clarify or correct this')}</button>
  </div>;
}
