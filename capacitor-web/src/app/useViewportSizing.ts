import { useEffect, useLayoutEffect, type DependencyList, type RefObject } from 'react';

function viewportHeight() { return window.visualViewport?.height ?? window.innerHeight; }

/** Grows the composer with its text, up to a quarter of the visible viewport. */
export function useComposerAutosize(textareaRef: RefObject<HTMLTextAreaElement | null>, deps: DependencyList) {
  useLayoutEffect(() => {
    const resize = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const limit = Math.min(180, Math.max(88, viewportHeight() * 0.25));
      textarea.style.height = '0px';
      textarea.style.height = `${Math.max(44, Math.min(textarea.scrollHeight, limit))}px`;
      textarea.style.overflowY = textarea.scrollHeight > limit ? 'auto' : 'hidden';
    };
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); };
  }, deps);
}

/** Exposes the visible viewport height (keyboard excluded) as --dari-chat-height. */
export function useChatViewportHeight() {
  useEffect(() => {
    const resize = () => document.documentElement.style.setProperty('--dari-chat-height', `${viewportHeight()}px`);
    resize();
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
      document.documentElement.style.removeProperty('--dari-chat-height');
    };
  }, []);
}
