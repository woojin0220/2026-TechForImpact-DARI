import { useEffect, useMemo, useRef, useState } from 'react';
import type { Answers } from './model';
import { draftWriter, type ApplicationDraftRepository } from './repository';

/** Mount with a new key when the service account changes; pending work stays with its owner. */
export function useDraft(repository: ApplicationDraftRepository) {
 const [language,setLanguage]=useState('');
 const [answers,setAnswers]=useState<Answers>({});
 const [loaded,setLoaded]=useState(false);
 const [storageError,setStorageError]=useState(false);
 const writable=useRef(false);
 const revision=useRef(0);
 const write=useMemo(()=>draftWriter(repository),[repository]);
 useEffect(()=>{
  let active=true;
  void repository.load().then(draft=>{
   if(!active)return;
   setLanguage(draft?.language??'');setAnswers(draft?.answers??{});
   writable.current=true;setLoaded(true);
  }).catch(()=>{if(active){setStorageError(true);setLoaded(true);}});
  return ()=>{active=false;writable.current=false;revision.current++;};
 },[repository]);
 useEffect(()=>{
  if(!loaded||!writable.current||!language)return;
  const current=++revision.current;
  void write({version:1,language,answers}).then(()=>{
   if(revision.current===current)setStorageError(false);
  }).catch(()=>{if(revision.current===current)setStorageError(true);});
 },[language,answers,loaded,write]);
 return {language,setLanguage,answers,setAnswers,loaded,storageError};
}
