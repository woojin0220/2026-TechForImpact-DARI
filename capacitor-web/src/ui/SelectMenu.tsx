import { useRef } from 'react';

/** Bounded in-app picker; never opens an OS-sized select window. */
export function SelectMenu({label,value,options,onChange,disabled=false}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void;disabled?:boolean}) {
 const ref=useRef<HTMLDetailsElement>(null);
 const selected=options.find(o=>o.value===value);
 return <details ref={ref} className={`select-menu${disabled?' is-disabled':''}`} onKeyDown={e=>{if(e.key==='Escape'){ref.current?.removeAttribute('open');ref.current?.querySelector('summary')?.focus();}}}>
  <summary aria-label={`${label}: ${selected?.label??''}`} aria-disabled={disabled} onClick={e=>{if(disabled)e.preventDefault();}}>{selected?.label??label}<span aria-hidden="true">⌄</span></summary>
  <div className="select-menu-options" role="group" aria-label={label}>{options.map(o=><button type="button" key={o.value} disabled={disabled} aria-pressed={value===o.value} onClick={()=>{if(value!==o.value)onChange(o.value);ref.current?.removeAttribute('open');ref.current?.querySelector('summary')?.focus();}}>{o.label}<span aria-hidden="true">{o.value===value?'✓':''}</span></button>)}</div>
 </details>;
}
