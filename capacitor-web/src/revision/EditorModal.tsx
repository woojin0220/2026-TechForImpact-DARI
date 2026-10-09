import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function EditorModal({ title, closeLabel, onClose, children }: {
  title: string; closeLabel: string; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="sentence-editor-modal" aria-labelledby="sentence-editor-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="sentence-editor-header"><h2 id="sentence-editor-title">{title}</h2><button autoFocus className="secondary" onClick={onClose}>{closeLabel}</button></header>
    <div className="sentence-editor-body">{children}</div>
  </dialog>, document.body);
}
