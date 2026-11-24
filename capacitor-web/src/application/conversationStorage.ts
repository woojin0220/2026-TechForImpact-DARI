import { readWorkingCopy, writeWorkingCopy, type WorkingCopy } from '../workingCopy.ts';
export const conversationKey=(scope:string,language:string)=>`${scope}.conversation.${language}.v1`;
function storageFor(key:string) {
 return ()=>({getItem:()=>sessionStorage.getItem(key),setItem:(_key:string,value:string)=>sessionStorage.setItem(key,value),removeItem:()=>sessionStorage.removeItem(key)});
}
export function loadConversation(scope:string,language:string) {
 const result=readWorkingCopy(storageFor(conversationKey(scope,language)));
 if(result.work && (result.work.language!==language || result.work.session.language!==language))return {work:null,problem:'invalid' as const};
 return result;
}
export const saveConversation=(scope:string,language:string,work:WorkingCopy)=>writeWorkingCopy(work,storageFor(conversationKey(scope,language)));
