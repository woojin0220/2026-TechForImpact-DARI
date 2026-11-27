import {useCallback,useState} from 'react';
import {loadEditDraft,saveEditDraft,clearMatchingEditDraft,type CommunityDraft} from './personal';

/** Edit buffers are separate from new posts, scoped to owner/post and tab-local. */
export function useEditDraft(owner:string,postId:string,fallback:CommunityDraft){
 const [initial]=useState(()=>{try{return {draft:loadEditDraft(sessionStorage,owner,postId)??fallback,blocked:false};}catch{return {draft:fallback,blocked:true};}});
 const [draft,setDraft]=useState(initial.draft),[error,setError]=useState(initial.blocked);
 const update=useCallback((next:CommunityDraft)=>{setDraft(next);if(initial.blocked){setError(true);return;}try{saveEditDraft(sessionStorage,owner,postId,next);setError(false);}catch{setError(true);}},[owner,postId,initial.blocked]);
 const clear=useCallback((expected?:CommunityDraft)=>{try{clearMatchingEditDraft(sessionStorage,owner,postId,expected);setError(false);}catch{setError(true);}},[owner,postId]);
 return {draft,error,update,clear};
}
