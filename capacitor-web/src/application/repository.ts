import { ANSWERS_KEY, loadAnswers, saveAnswers, type Answers } from './model.ts';

/** Service-wide auth identity, independent of community profile or membership. */
export type DraftOwner = { userId: string | null };
export type ApplicationDraft = { version: 1; language: string; answers: Answers };
/** Bind an adapter to the authenticated owner before passing it to the screen.
 * A future DB adapter must enforce ownership server-side, not trust a supplied user ID.
 * No automatic guest upload or account-to-account copy is performed. */
export interface ApplicationDraftRepository {
 readonly scope: string;
 load(): Promise<ApplicationDraft | null>;
 save(draft: ApplicationDraft): Promise<void>;
}
export function draftStorageKey(owner: DraftOwner): string {
 return owner.userId === null ? ANSWERS_KEY : `${ANSWERS_KEY}.account.${encodeURIComponent(owner.userId)}`;
}
/** Current adapter stays tab-local; this does not enable cloud synchronization. */
export function sessionDraftRepository(owner: DraftOwner): ApplicationDraftRepository {
 const key=draftStorageKey(owner);
 return {
  scope:key,
  async load() {
   const saved=loadAnswers(key);
   if(saved.problem)throw new Error('DRAFT_LOAD_FAILED');
   return saved.language ? {version:1,language:saved.language,answers:saved.answers} : null;
  },
  async save(draft) {
   if(!saveAnswers(draft.language,draft.answers,key))throw new Error('DRAFT_SAVE_FAILED');
  },
 };
}
/** Serialize writes so a slow DB response cannot replace a later edit with an older one. */
export function draftWriter(repository: ApplicationDraftRepository) {
 let pending=Promise.resolve();
 return (draft: ApplicationDraft) => {
  const snapshot=structuredClone(draft);
  const next=pending.catch(()=>{}).then(()=>repository.save(snapshot));
  pending=next;
  return next;
 };
}
