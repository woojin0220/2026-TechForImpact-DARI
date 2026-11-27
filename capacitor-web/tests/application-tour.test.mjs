import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationTourKey,needsApplicationTour,finishApplicationTour,applicationTourSteps} from '../src/application/tour.ts';
test('application walkthrough completion is independent of welcome, owner and screen',()=>{
 const records=new Map([['dari.application.welcome.v1.owner','1']]);
 globalThis.localStorage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
 try{
  assert.ok(needsApplicationTour('owner','home'));
  finishApplicationTour('owner','home');assert.equal(needsApplicationTour('owner','home'),false);
  assert.ok(needsApplicationTour('another','home'));assert.ok(needsApplicationTour('owner','write'));
  assert.notEqual(applicationTourKey('a/b','home'),applicationTourKey('a%2Fb','home'));
 }finally{delete globalThis.localStorage;}
});
test('guide copy covers every supported language and does not require an answer to exist',()=>{
 for(const language of ['ko','en','fr','ru','ar','fa'])for(const mode of ['home','write','quick','review']){
  const steps=applicationTourSteps(language,mode);assert.ok(steps.length);
  for(const step of steps)assert.ok(step.selector&&step.title&&step.body);
 }
 globalThis.localStorage={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}};
 try{assert.ok(needsApplicationTour('owner','home'));assert.doesNotThrow(()=>finishApplicationTour('owner','home'));}finally{delete globalThis.localStorage;}
});
