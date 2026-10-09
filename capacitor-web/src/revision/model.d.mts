import type { TxtDocument, Reply } from './state.mjs';
import type { ModelRequest } from '../intake/types';
export const replySchema:Record<string,unknown>;
export function buildSentenceRequest(doc:TxtDocument,id:string,uiLanguage?:string):ModelRequest;
export function parseReply(raw:string,uiLanguage?:string):Reply;
export function generateSentenceReply(doc:TxtDocument,id:string,uiLanguage:string,adapter:(request:ModelRequest)=>Promise<string>,signal?:AbortSignal):Promise<Reply>;
