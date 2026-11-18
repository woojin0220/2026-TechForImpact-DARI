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
    let timer = 0;
    const update = () => { window.clearTimeout(timer); setOpen(isTextEntry(document.activeElement)); };
    // Bringing the bar back moves content near the bottom. Wait until a tap that blurred
    // the field (e.g. on a submit button) has finished, so the tap still lands.
    const later = () => { window.clearTimeout(timer); timer = window.setTimeout(update, 300); };
    const onFocusIn = (event: FocusEvent) => isTextEntry(event.target) ? update() : later();
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', later);
    return () => { window.clearTimeout(timer); document.removeEventListener('focusin', onFocusIn); document.removeEventListener('focusout', later); };
  }, []);
  return open;
}
