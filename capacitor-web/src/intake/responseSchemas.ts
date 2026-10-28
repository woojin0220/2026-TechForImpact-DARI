const nonempty = { type: 'string', minLength: 1 };
const strings = { type: 'array', minItems: 1, items: nonempty };
const strictObject = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object', additionalProperties: false, properties, required,
});
const statementSchema = { type: 'array', maxItems: 16, items: strictObject({
  subject: { anyOf: [nonempty, { type: 'null' }] }, action: nonempty,
  object: { anyOf: [nonempty, { type: 'null' }] },
  polarity: { type: 'string', enum: ['positive', 'negative', 'unspecified'] },
  certainty: { type: 'string', enum: ['exact', 'approximate', 'uncertain'] },
  knowledge: { type: 'string', enum: ['direct', 'heard', 'inferred', 'unspecified'] }, quote: nonempty,
}) };

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
        statements: statementSchema,
        relatedRequirementIds: { type: 'array', maxItems: 8, items: { type: 'string', enum: requirementIds } },
        supersedes: activeFactIds.length
          ? { type: 'array', items: { type: 'string', enum: activeFactIds } }
          : { type: 'array', maxItems: 0, items: nonempty },
      }, ['requirementId', 'value', 'status', 'certainty', 'knowledge', 'sourceIds', 'sourceQuotes', 'eventId', 'supersedes', 'statements']),
    },
  });
}

/** Compact extraction format: short keys, defaults omitted, sentences cited by ref ("N.i").
 * A choice field's answer is limited to its option codes (ASCII, which LiteRT-LM's constrained
 * decoding handles); stating it is unknown, skipped or not applicable keeps the applicant's words. */
export function intakeCompactSchema(requirements: { id: string; type: string; options?: { value: string }[]; repeatable?: boolean; parentId?: string }[], refs: string[], activeFactIds: string[]): Record<string, unknown> {
  const common = {
    a: statementSchema,
    u: { type: 'array', maxItems: 8, items: { type: 'string', enum: requirements.map(item => item.id) } },
    c: { type: 'string', enum: ['e', 'a', 'u'] },
    k: { type: 'string', enum: ['d', 'h', 'i', 'u'] },
    q: { type: 'array', minItems: 1, items: { type: 'string', enum: refs } },
    e: nonempty,
    x: activeFactIds.length ? { type: 'array', items: { type: 'string', enum: activeFactIds } } : { type: 'array', maxItems: 0, items: nonempty },
  };
  // v is required: under constrained decoding an optional value was simply left out. So is e for
  // per-incident details: without it every incident fell back to one "general" entry and merged.
  const variant = (ids: string[], v: unknown, statuses: string[], required = ['r', 'v', 'q'], structured = false) => ({
    type: 'object', additionalProperties: false, required,
    properties: { r: { type: 'string', enum: ids }, v, s: { type: 'string', enum: statuses }, ...common,
      ...(structured ? { a: { ...statementSchema, minItems: 1 } } : {}) },
  });
  const perIncident = (item: { repeatable?: boolean; parentId?: string }) => !!(item.repeatable && item.parentId);
  const variants: unknown[] = [];
  for (const incident of [false, true]) {
    const own = requirements.filter(item => perIncident(item) === incident);
    // k is required too: left to a default, "heard from my mother" was recorded as unspecified.
    const keys = incident ? ['r', 'v', 'k', 'q', 'e', 'a'] : ['r', 'v', 'k', 'q', 'a'];
    const text = own.filter(item => !item.options);
    const choice = own.filter(item => item.options);
    const groups = new Map<string, { ids: string[]; codes: string[]; multi: boolean }>();
    for (const item of choice) {
      const codes = item.options!.map(option => option.value);
      const multi = item.type === 'multi';
      const key = `${multi}|${codes.join(',')}`;
      if (groups.has(key)) groups.get(key)!.ids.push(item.id); else groups.set(key, { ids: [item.id], codes, multi });
    }
    for (const structured of [false, true]) {
      const fields = text.filter(item => (item.type === 'long') === structured);
      if (fields.length) variants.push(variant(fields.map(item => item.id), { anyOf: [nonempty, strings] }, ['a', 'u', 'k', 'n', 'c'], keys, structured));
    }
    for (const group of groups.values()) variants.push(variant(group.ids,
      // A multi-choice answer may be one code: as an array-only field, a single "political" only fit the
      // unknown branch and was recorded as unknown.
      group.multi ? { anyOf: [{ type: 'string', enum: group.codes }, { type: 'array', minItems: 1, items: { type: 'string', enum: group.codes } }] } : { type: 'string', enum: group.codes }, ['a', 'c'], keys));
    if (choice.length) variants.push(variant(choice.map(item => item.id), nonempty, ['u', 'k', 'n'], [...keys, 's']));
  }
  return strictObject({ reply: nonempty, facts: { type: 'array', maxItems: 60, items: variants.length === 1 ? variants[0] : { anyOf: variants } } });
}

export function routingResponseSchema(requirementIds: string[]): Record<string, unknown> {
  return strictObject({ requirementIds: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', enum: requirementIds } } });
}

export function draftResponseSchema(questionId: string, factIds: string[]): Record<string, unknown> {
  return strictObject({ sections: {
    type: 'array', minItems: 1, maxItems: 1,
    items: strictObject({
      questionId: { type: 'string', enum: [questionId] },
      // Bounded so a small model cannot loop on sentences until the output limit.
      sentences: { type: 'array', minItems: 1, maxItems: 20, items: strictObject({
        text: { type: 'string', minLength: 1, maxLength: 400 },
        factIds: { type: 'array', minItems: 1, items: { type: 'string', enum: factIds } },
      }) },
    }),
  } });
}
