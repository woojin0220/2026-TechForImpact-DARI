import { useEffect, useState } from 'react';

/** The application flow owns the language and writes it to <html lang>; the shell follows it. */
export function useDocumentLanguage() {
  const [language, setLanguage] = useState(() => document.documentElement.lang || 'ko');
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setLanguage(root.lang || 'ko'));
    observer.observe(root, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);
  return language;
}

function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) return true;
  return target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'color'].includes(target.type);
}

/** On touch devices the bottom bar steps aside while the on-screen keyboard is likely open. */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    const update = () => setOpen(isTextEntry(document.activeElement));
    const onFocusOut = () => requestAnimationFrame(update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', onFocusOut);
    return () => { document.removeEventListener('focusin', update); document.removeEventListener('focusout', onFocusOut); };
  }, []);
  return open;
}
