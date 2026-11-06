import type { IntakeFact } from './intake/types';
import { requirementsById } from './intake/catalog';
import { journeyCopyFor } from './journeyCopy';
import './statementDetails.css';

export function StatementDetails({ fact, language, disabled, onClarify }: {
  fact: IntakeFact; language: string; disabled: boolean; onClarify: () => void;
}) {
  const copy = journeyCopyFor(language);
  const tags = new Set<string>();
  if (fact.certainty === 'uncertain') tags.add(copy.uncertainTag);
  if (fact.certainty === 'approximate') tags.add(copy.approximateTag);
  if (fact.knowledge === 'heard') tags.add(copy.heardTag);
  if (fact.knowledge === 'inferred') tags.add(copy.inferredTag);
  if (fact.statements?.some(item => item.polarity === 'negative')) tags.add(copy.includesNegative);
  return <div className="statement-review">
    {tags.size > 0 && <div className="statement-tags">{[...tags].map(tag => <span key={tag}>{tag}</span>)}</div>}
    {!!fact.statements?.length && <details><summary>{copy.checkRoles} · <bdi>{fact.statements.length}</bdi></summary><div className="statement-items">{fact.statements.map((statement, index) => <div className="statement-item" key={index}>
      <p dir="auto">{statement.sourceQuotes[0]?.quote}</p>
      <div className="statement-tags">
        {statement.polarity === 'negative' && <span>{copy.negativeStatement}</span>}
        {statement.polarity === 'unspecified' && <span>{copy.meaningClarify}</span>}
        {statement.certainty === 'uncertain' && <span>{copy.uncertainTag}</span>}
        {statement.knowledge === 'heard' && <span>{copy.heardTag}</span>}
        {statement.knowledge === 'inferred' && <span>{copy.inferred}</span>}
      </div>
      <dl><dt>{copy.who}</dt><dd dir="auto">{statement.subject ?? copy.toClarify}</dd><dt>{copy.didWhat}</dt><dd dir="auto">{statement.action}</dd>{statement.object && <><dt>{copy.toWhom}</dt><dd dir="auto">{statement.object}</dd></>}</dl>
    </div>)}</div></details>}
    {!!fact.relatedRequirementIds?.length && <details className="statement-uses"><summary>{copy.whereUsed}</summary><ul>{[...new Set([fact.requirementId, ...fact.relatedRequirementIds].map(id => requirementsById.get(id)?.questionId))].filter(Boolean).map(id => <li key={id}><bdi>{id}</bdi></li>)}</ul></details>}
    {!!fact.clarification?.length && <p className="statement-gap">{copy.pleaseClarify}</p>}
    <button type="button" className="quiet" disabled={disabled} onClick={onClarify}>{copy.clarifyCorrect}</button>
  </div>;
}
