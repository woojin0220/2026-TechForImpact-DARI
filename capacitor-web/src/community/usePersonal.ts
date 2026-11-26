import {useCallback,useState} from 'react';
import {loadDraft,saveDraft,loadSaved,saveSaved,clearMatchingDraft,type CommunityDraft} from './personal';
/** Called inside the account-keyed routes. Drafts are tab-local; bookmarks store IDs only. */
export function usePersonal(owner:string){
 const [initial]=useState(()=>{let draft:CommunityDraft|null=null,saved:string[]=[],draftBlocked=false,savedBlocked=false;
  if(typeof window!=='undefined'){try{draft=loadDraft(sessionStorage,owner);}catch{draftBlocked=true;}try{saved=loadSaved(localStorage,owner);}catch{savedBlocked=true;}}
  return {draft,saved,draftBlocked,savedBlocked};});
 const [draft,setDraft]=useState(initial.draft),[saved,setSaved]=useState(initial.saved);
 const [draftError,setDraftError]=useState(initial.draftBlocked),[savedError,setSavedError]=useState(initial.savedBlocked);
 const [draftBlocked,setDraftBlocked]=useState(initial.draftBlocked);
 const updateDraft=useCallback((next:CommunityDraft|null)=>{
  setDraft(next);if(draftBlocked){setDraftError(true);return;}
  try{saveDraft(sessionStorage,owner,next);setDraftError(false);}catch{setDraftError(true);}
 },[owner,draftBlocked]);
 const clearDraft=useCallback((expected?:CommunityDraft)=>{try{
  // A response from an abandoned editor must not delete a newer draft.
  if(!clearMatchingDraft(sessionStorage,owner,expected))return;
  setDraft(previous=>!expected||JSON.stringify(previous)===JSON.stringify(expected)?null:previous);setDraftError(false);setDraftBlocked(false);
 }catch{setDraftError(true);}},[owner]);
 const toggleSaved=useCallback((id:string)=>{
  if(initial.savedBlocked){setSavedError(true);return;}
  const next=saved.includes(id)?saved.filter(item=>item!==id):[id,...saved];
  try{saveSaved(localStorage,owner,next);setSaved(next);setSavedError(false);}catch{setSavedError(true);}
 },[owner,saved,initial.savedBlocked]);
 return {draft,updateDraft,clearDraft,draftError,saved,toggleSaved,savedError};
}
