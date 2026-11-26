import type { BoardId } from './model.ts';
export type LocalStore=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type CommunityDraft={version:1;board:BoardId;title:string;body:string;language:string};
export const personalKey=(owner:string,kind:'draft'|'saved')=>`dari.community.${kind}.v1.account.${encodeURIComponent(owner)}`;
export function loadDraft(store:LocalStore,owner:string):CommunityDraft|null{
 const raw=store.getItem(personalKey(owner,'draft'));if(raw===null)return null;
 const v=JSON.parse(raw);if(!v||v.version!==1||!['qna','life','notice'].includes(v.board)||typeof v.title!=='string'||v.title.length>100||typeof v.body!=='string'||v.body.length>5000||!['ko','en','ar','fa','fr','ru'].includes(v.language))throw Error('INVALID_DRAFT');
 return {version:1,board:v.board,title:v.title,body:v.body,language:v.language};
}
export function saveDraft(store:LocalStore,owner:string,draft:CommunityDraft|null){
 const key=personalKey(owner,'draft');if(!draft||(!draft.title.trim()&&!draft.body.trim()))store.removeItem(key);else store.setItem(key,JSON.stringify(draft));
}
export function clearMatchingDraft(store:LocalStore,owner:string,expected?:CommunityDraft){
 const current=expected?loadDraft(store,owner):null;
 if(expected&&current&&JSON.stringify(current)!==JSON.stringify(expected))return false;
 saveDraft(store,owner,null);return true;
}
export function loadSaved(store:LocalStore,owner:string):string[]{
 const raw=store.getItem(personalKey(owner,'saved'));if(raw===null)return [];
 const v=JSON.parse(raw);if(!v||v.version!==1||!Array.isArray(v.ids)||v.ids.length>200||v.ids.some((id:unknown)=>typeof id!=='string'||!(/^[\w-]{1,128}$/).test(id)))throw Error('INVALID_SAVED');return [...new Set(v.ids)] as string[];
}
export function saveSaved(store:LocalStore,owner:string,ids:string[]){
 if(ids.length>200)throw Error('SAVED_LIMIT');store.setItem(personalKey(owner,'saved'),JSON.stringify({version:1,ids}));
}
