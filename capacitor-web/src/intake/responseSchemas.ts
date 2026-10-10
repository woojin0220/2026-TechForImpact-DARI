const nonempty = { type: 'string', minLength: 1 };
const strings = { type: 'array', minItems: 1, items: nonempty };
const strictObject = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object', additionalProperties: false, properties, required,
});

/** Sentences of a user message, as offered for quoting (and numbered "N.i" in the compact format). */
export function sentencesOf(content: string): string[] {
  return content.match(/[^.!?。！？؟\n]+[.!?。！？؟]?/g)?.map(sentence => sentence.trim()).filter(Boolean) ?? [];
}

export function intakeResponseSchema(requirementIds: string[], sources: { id: string; content: string }[], activeFactIds: string[]): Record<string, unknown> {
  const quoteSchemas = sources.map(source => {
    const sentences = sentencesOf(source.content);
    return strictObject({
      sourceId: { type: 'string', enum: [source.id] },
      quote: { type: 'string', enum: [...new Set([...sentences, source.content])] },
    });
  });
  return strictObject({
    reply: nonempty,
    facts: {
      type: 'array', maxItems: 60,
      items: strictObject({
        requirementId: { type: 'string', enum: requirementIds },
        value: { anyOf: [nonempty, strings] },
        status: { type: 'string', enum: ['answered', 'unknown', 'skipped', 'not_applicable', 'conflict'] },
        certainty: { type: 'string', enum: ['exact', 'approximate', 'uncertain'] },
        knowledge: { type: 'string', enum: ['direct', 'heard', 'inferred', 'unspecified'] },
        sourceIds: { type: 'array', minItems: 1, items: { type: 'string', enum: sources.map(source => source.id) } },
        sourceQuotes: { type: 'array', minItems: 1, items: { anyOf: quoteSchemas } },
        eventId: nonempty,
        supersedes: activeFactIds.length
          ? { type: 'array', items: { type: 'string', enum: activeFactIds } }
          : { type: 'array', maxItems: 0, items: nonempty },
      }, ['requirementId', 'value', 'status', 'certainty', 'knowledge', 'sourceIds', 'sourceQuotes', 'eventId', 'supersedes']),
    },
  });
}

/** Compact extraction format: short keys, defaults omitted, sentences cited by ref ("N.i"). */
export function intakeCompactSchema(requirementIds: string[], refs: string[], activeFactIds: string[]): Record<string, unknown> {
  const fact = {
    // v is required: under constrained decoding an optional value was simply left out.
    type: 'object', additionalProperties: false, required: ['r', 'v', 'q'],
    properties: {
      r: { type: 'string', enum: requirementIds },
      v: { anyOf: [nonempty, strings] },
      s: { type: 'string', enum: ['a', 'u', 'k', 'n', 'c'] },
      c: { type: 'string', enum: ['e', 'a', 'u'] },
      k: { type: 'string', enum: ['d', 'h', 'i', 'u'] },
      q: { type: 'array', minItems: 1, items: { type: 'string', enum: refs } },
      e: nonempty,
      x: activeFactIds.length ? { type: 'array', items: { type: 'string', enum: activeFactIds } } : { type: 'array', maxItems: 0, items: nonempty },
    },
  };
  return strictObject({ reply: nonempty, facts: { type: 'array', maxItems: 60, items: fact } });
}

export function routingResponseSchema(requirementIds: string[]): Record<string, unknown> {
  return strictObject({ requirementIds: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', enum: requirementIds } } });
}

export function draftResponseSchema(questionId: string, factIds: string[], sourceIds: string[]): Record<string, unknown> {
  return strictObject({ sections: {
    type: 'array', minItems: 1, maxItems: 1,
    items: strictObject({
      questionId: { type: 'string', enum: [questionId] },
      // Bounded so a small model cannot loop on sentences until the output limit.
      sentences: { type: 'array', minItems: 1, maxItems: 20, items: strictObject({
        text: { type: 'string', minLength: 1, maxLength: 400 },
        factIds: { type: 'array', minItems: 1, items: { type: 'string', enum: factIds } },
        sourceIds: { type: 'array', minItems: 1, items: { type: 'string', enum: sourceIds } },
      }) },
    }),
  } });
}
