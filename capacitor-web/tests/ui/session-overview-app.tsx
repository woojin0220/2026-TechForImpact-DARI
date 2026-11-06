import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { createSession, applyFormAnswers, appendAssistantMessage, appendUserMessage } from '../../src/intake';
import { createDocument, addUserMessage, addAssistantMessage } from '../../src/revision/state.mjs';
import '../../src/styles.css';

// Fictional records only. This fixture opens in review and makes no model request.
let session = applyFormAnswers(createSession('ko', 'full'), {
  '1.2': { kind: 'text', text: '가상 검증 성씨' },
  '1.3': { kind: 'text', text: '전체보기 시험' },
  '1.5': { kind: 'text', text: '1990/01/01' },
  '9.1': { kind: 'choice', values: ['no'] },
  '9.2': { kind: 'text', text: '숨김 입력 가상 기관' },
  '12.9': { kind: 'choice', values: ['yes'] },
  '12.9-table': { kind: 'table', rows: [{}, { country: '가상 방문국', location: '가상 체류지' }] },
});
session = appendAssistantMessage(session, '처음부터 가상 이야기를 들려주세요.', { kind: 'narrative', topics: ['harm'] });
session = appendUserMessage(session, '가상 원문: 두 사람이 저를 위협했습니다. 정확한 날짜와 그들의 신원은 모릅니다.');
const source = session.messages.at(-1)!;
session = appendAssistantMessage(session, '가상 후속 질문: 돌아가면 무엇이 걱정되나요?', { kind: 'narrative', topics: ['fear'] });
session = appendUserMessage(session, '가상 후속 원문: 다시 위협받을까 두렵습니다.');
session.facts.push({ id: 'overview-confirmed', requirementId: 'harm.event', value: '가상 수집 답변: 두 사람의 위협', sourceIds: [source.id], sourceQuotes: [{ sourceId: source.id, quote: source.content }], status: 'answered', certainty: 'uncertain', knowledge: 'direct', confirmed: true, eventId: 'fictional-event' });
session.facts.push({ id: 'overview-unconfirmed', requirementId: 'fear.harm', value: '가상 미확인 답변: 재차 위협', sourceIds: [session.messages.at(-1)!.id], sourceQuotes: [], status: 'answered', certainty: 'uncertain', knowledge: 'direct', confirmed: false });
session.facts.push({ id: 'overview-direct', requirementId: 'grounds.category', value: ['political'], sourceIds: [source.id], sourceQuotes: [{ sourceId: source.id, quote: source.content }], status: 'answered', certainty: 'uncertain', knowledge: 'direct', confirmed: false });
session.topicDecisions = { protection: 'skipped' };
session.question14 = { '14.2-detail': { kind: 'text', text: '가상 한국어 초안: 두 사람이 저를 위협했습니다.' } };
session.draftRevision = 1;
session.draft = [{ questionId: '14.2', text: '가상 생성 초안: 두 사람이 저를 위협했습니다.', factIds: ['overview-confirmed'], sourceIds: [source.id], sentences: [] }];
let review = createDocument('가상 한국어 초안: 두 사람이 저를 위협했습니다.', '가상 검증', 'ko');
const sentence = review.pieces.find(piece => piece.kind === 'sentence')!;
review = addUserMessage(review, sentence.id, '가상 수정 대화 원문: 날짜를 추가하지 마세요.');
review = addAssistantMessage(review, sentence.id, { type: 'answer', message: '가상 안내: 날짜를 추가하지 않겠습니다.', replacement: '' }, 0);
session.draftReviews = { '14.2-detail': review };
createRoot(document.getElementById('root')!).render(<App initialSession={session} initialStage="facts" />);
