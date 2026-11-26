import {useEffect,useRef,useState} from 'react';
import type {CommunityApi} from './api';
import type {CommunityCopy} from './copy';
import type {PostSummary} from './model';
import {relativeTime} from './model';
import {refreshCopy} from './refreshCopy';
import {PostCardText} from './CommunityScreens';
import {BackButton,ScreenHeader} from '../ui/ScreenControls';
import type {Translator} from './translation';
type ActivityPost=PostSummary & {my_reply?:string;my_reply_language?:string;activity_at?:string};
export function MyActivity({api,owner,language,copy,translator,onBack,onOpen}:{api:CommunityApi;owner:string;language:string;copy:CommunityCopy;translator:Translator|null;onBack:()=>void;onOpen:(id:string)=>void}){
 const c=refreshCopy(language),[kind,setKind]=useState<'posts'|'replies'>('posts'),[rows,setRows]=useState<ActivityPost[]>([]),[next,setNext]=useState<string>(),[pending,setPending]=useState(true),[failed,setFailed]=useState(false),ticket=useRef(0),lock=useRef(false);
 async function load(before?:string){if(before&&lock.current)return;lock.current=true;const id=++ticket.current;setPending(true);setFailed(false);try{const page=await api.listActivity(owner,kind,before);if(id!==ticket.current)return;setRows(old=>before?[...old,...page.posts]:page.posts);setNext(page.next);}catch{if(id===ticket.current)setFailed(true);}finally{if(id===ticket.current){setPending(false);lock.current=false;}}}
 useEffect(()=>{setRows([]);setNext(undefined);void load();return()=>{ticket.current++;lock.current=false;};},[api,owner,kind]);
 return <section className="community community-home"><div className="community-fixed-head"><ScreenHeader className="community-topbar" title={c.activity} leading={<BackButton label={copy.back} onClick={onBack}/>}/><div className="activity-tabs" role="tablist" aria-label={c.activity}>{(['posts','replies'] as const).map(item=><button key={item} role="tab" aria-selected={kind===item} onClick={()=>setKind(item)}>{c[item]}</button>)}</div></div><div className="community-feed-scroll" tabIndex={0} aria-label={c.activity}>
 {pending&&!rows.length&&<p role="status">{copy.loading}</p>}{failed&&<div className="community-state"><p role="alert">{copy.loadFailed}</p><button onClick={()=>void load(next)}>{copy.retry}</button></div>}{!pending&&!failed&&!rows.length&&<p className="community-state">{c.empty}</p>}
 <ul className="post-list">{rows.map((post,i)=><li key={`${post.id}-${post.activity_at??i}`}><button className="post-card" type="button" onClick={()=>onOpen(post.id)}><PostCardText post={post} translator={translator} language={language} bodyOverride={post.my_reply} bodyLanguage={post.my_reply_language}/>{post.my_reply&&<span className="feed-board-label">{c.replies}</span>}<time>{relativeTime(post.activity_at??post.created_at,language)}</time></button></li>)}</ul>
 {next&&<button className="secondary load-more" disabled={pending} onClick={()=>void load(next)}>{pending?copy.loading:copy.loadMore}</button>}</div></section>;
}
