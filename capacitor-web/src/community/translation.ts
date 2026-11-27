/**
 * On-device translation for community posts. Text never leaves the phone:
 * Android and iPhone use Google ML Kit's offline translator; browser
 * previews can use the local model when one is available. With neither, posts show as written.
 */
export type TranslationEngine = {
  /** Fast engines (ML Kit) can translate whole lists; slow ones are serialized, including visible feed previews. */
  fast: boolean;
  translate(text: string, source: string, target: string): Promise<string>;
};

export type Translator = {
  fast: boolean;
  translate(text: string, source: string, target: string): Promise<string>;
};

/** Whether a text written in `source` needs translating for a reader of `target`. */
export function needsTranslation(source: string | null | undefined, target: string) {
  if (!source) return false;
  return source.split('-')[0].toLowerCase() !== target.split('-')[0].toLowerCase();
}

/** Wraps an engine with a cache and de-duplication of identical in-flight requests. */
export function createTranslator(engine: TranslationEngine, limit = 300): Translator {
  const cache = new Map<string, Promise<string>>();
  let active=0;const waiting:(()=>void)[]=[];
  async function run(text:string,source:string,target:string){if(active >= (engine.fast?2:1))await new Promise<void>(resolve=>waiting.push(resolve));else active++;try{return await engine.translate(text,source,target);}finally{const next=waiting.shift();if(next)next();else active--;}}
  return {
    fast: engine.fast,
    translate(text, source, target) {
      const trimmed = text.trim();
      if (!trimmed || !needsTranslation(source, target)) return Promise.resolve(text);
      const key = `${source}\u0000${target}\u0000${trimmed}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const job = run(trimmed, source, target).then(result => {
        const clean = cleanModelOutput(result);
        if (!clean) throw new Error('empty translation');
        return clean;
      });
      job.catch(() => cache.delete(key));
      cache.set(key, job);
      if (cache.size > limit) cache.delete(cache.keys().next().value as string);
      return job;
    },
  };
}

/** Strips wrappers a language model sometimes adds around a translation. */
export function cleanModelOutput(text: string) {
  let out = text.trim();
  out = out.replace(/^```[a-z]*\n?|\n?```$/g, '').trim();
  out = out.replace(/^(translation|번역)\s*[:：]\s*/i, '').trim();
  const quoted = /^(["“«])([\s\S]*)(["”»])$/.exec(out);
  if (quoted && !quoted[2].includes(quoted[1])) out = quoted[2].trim();
  return out;
}

export function languageName(code: string, displayLanguage: string) {
  try { return new Intl.DisplayNames([displayLanguage], { type: 'language' }).of(code) ?? code; }
  catch { return code; }
}

export function translationPrompt(text: string, source: string, target: string) {
  const name = (code: string) => languageName(code, 'en');
  return {
    system: `You translate posts in a support community for refugees in Korea. Translate the user's text from ${name(source)} to ${name(target)}. Keep the meaning, tone, names, numbers and line breaks. Do not add explanations, notes or quotes. Output only the translation.`,
    prompt: text,
  };
}
