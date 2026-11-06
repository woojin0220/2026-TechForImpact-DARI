import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorModal } from '../../src/revision/EditorModal';
import { SentenceReview } from '../../src/revision/SentenceReview';
import { addAssistantMessage, addUserMessage, createDocument, documentText } from '../../src/revision/state.mjs';
import { FinalCheck } from '../../src/JourneyPanels';
import { createSession, type IntakeFact } from '../../src/intake';
import '../../src/styles.css';
import '../../src/revision/revision.css';

const draft = '이 문장은 화면 배치 확인을 위한 가상 문장입니다.';
function initialDocument() {
  const doc = createDocument(draft);
  const row = doc.pieces.find(piece => piece.kind === 'sentence')!;
  const requested = addUserMessage(doc, row.id, 'يرجى تحسين الصياغة مع الحفاظ على المعنى نفسه.');
  return addAssistantMessage(requested, row.id, {
    type: 'proposal', message: 'هذا اقتراح تجريبي لفحص الواجهة فقط.',
    replacement: '이 문장은 화면 배치만 확인하기 위한 가상 문장입니다.',
  }, row.revision);
}
const fact: IntakeFact = {
  id: 'qa-fact', requirementId: 'grounds.summary', value: 'بيانات تجريبية لا تتعلق بأي حالة حقيقية.',
  status: 'answered', certainty: 'exact', knowledge: 'direct', confirmed: true,
  sourceIds: ['qa-source'], sourceQuotes: [{ sourceId: 'qa-source', quote: 'بيانات تجريبية لا تتعلق بأي حالة حقيقية.' }],
};
const session = { ...createSession('ar', 'test'), facts: [fact], narrativeDone: true, guidedDone: true };

function ArabicReviewFixture() {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState(initialDocument);
  return <main lang="ar" dir="rtl" style={{ maxWidth: 900, margin: '32px auto', padding: '0 20px' }}>
    <h1>عرض تجريبي لمراجعة المسودة بالعربية</h1>
    <p>هذه صفحة اختبار ببيانات وهمية لفحص اتجاه الواجهة والأزرار فقط، وليست طلبًا حقيقيًا. لا يُرسل أي طلب إلى النموذج بمجرد فتح الصفحة أو النافذة.</p>
    <button className="primary" onClick={() => setOpen(true)}>فتح محرر الجملة التجريبية</button>
    <FinalCheck session={session} language="ar" checked={false} ready={false} onCheck={() => {}} onReturn={() => {}} />
    {open && <EditorModal title="مراجعة جملة تجريبية" closeLabel="إغلاق النافذة" uiLanguage="ar" onClose={() => setOpen(false)}>
      <SentenceReview text={documentText(doc)} saved={doc} uiLanguage="ar" onChange={next => setDoc(next)} />
    </EditorModal>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<ArabicReviewFixture />);
