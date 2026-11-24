import { useState } from 'react';
import { useAuth } from './AuthContext';
import { devSupervisorCopyFor } from './devSupervisorCopy';

/** Visible only when the development provider offers its isolated test account. */
export function DevSupervisorEntry({ language }: { language: string }) {
  const { enterSupervisor } = useAuth();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!enterSupervisor) return null;
  const copy = devSupervisorCopyFor(language);
  return <div className="dev-supervisor-entry">
    <button type="button" className="secondary" disabled={pending} onClick={async () => {
      setPending(true); setFailed(false);
      try { await enterSupervisor(language); } catch { setFailed(true); setPending(false); }
    }}>{copy.enter}</button>
    <p role={failed ? 'alert' : undefined}>{failed ? (language === 'ko' ? '테스트 계정을 열지 못했어요. 브라우저의 세션 저장소를 사용할 수 있는지 확인해 주세요.' : 'Could not open the test account. Check that session storage is available.') : copy.hint}</p>
  </div>;
}
