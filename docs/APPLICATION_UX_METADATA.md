# Application UX and conversation collection (#38, #39)

The application uses thematic disclosures for sections 7, 9, 10, 12 and 14,
plus the existing form-step groups for sections 1 and 11. A subsection containing
one question renders directly. Short fields remain inline; Korean translation
previews expand on demand. Printed question IDs, wording and export mappings
are unchanged. Section 14 now has five topic groups instead of eighteen full
question cards shown at once.

Narrative questions in section 14 and the section 15 personal statement link to
one shared conversation per owner and answer language. This screen reuses the
existing `ConversationStage`, full-scope intake extraction, validation and model
adapter. It is a separate collection workspace: no draft generator, answer writer,
translation export or Word download is available. Review shows topic groups,
individual incidents, fact status and verbatim source quotes. Users return to the
question to write their own answer. Collected information is not automatically
inserted into answers or documents.

`conversationStorage.ts` uses the validated working-copy envelope and scopes its
sessionStorage key to the application repository owner plus language. It does
not read or modify the legacy conversation key or the application answers.
DB synchronization is not implemented. Corrupt records are retained without being
overwritten. Unsent text and completed extraction results are saved; a pending
user message can be retried explicitly after failure or reload. Leaving the
workspace aborts its in-flight request.

Runtime configuration is the existing intake configuration (mobile local model,
Mac/Ollama preview, or explicitly configured hybrid gateway). The Hy-MT translation
model is not used as a metadata extraction model. Live model quality and phone
performance require the respective runtime; the regression test uses a controlled
adapter to verify sourced extraction beyond the priority topics without drafting.
