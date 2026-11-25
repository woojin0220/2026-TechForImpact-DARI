import { useRef } from 'react';

export function AnswerChoices({id,label,value,options,disabled,onChange,clearLabel,chooseLabel}:{id:string;label:string;value:string;options:{value:string;label:string}[];disabled:boolean;onChange:(value:string)=>void;clearLabel:string;chooseLabel:string}) {
 const ref=useRef<HTMLDetailsElement>(null);
 const list=<fieldset className={`answer-option-list${options.length===2&&options.every(o=>o.label.length<22)?' short-options':''}`} disabled={disabled}>
  <legend className="sr-only">{label}</legend>{options.map(o=><label key={o.value} className={`answer-option${value===o.value?' selected':''}`}><input type="radio" name={id} value={o.value} checked={value===o.value} onChange={()=>{onChange(o.value);ref.current?.removeAttribute('open');}}/><span>{o.label}</span></label>)}
 </fieldset>;
 return <div className="answer-choices-control">{options.length>4?<details ref={ref} className="answer-options-disclosure"><summary>{options.find(o=>o.value===value)?.label??chooseLabel}<span aria-hidden="true">⌄</span></summary>{list}</details>:list}
 {value&&<button className="quiet clear-choice" type="button" disabled={disabled} onClick={()=>onChange('')}>{clearLabel}</button>}</div>;
}
