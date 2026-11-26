import { isCurrent,isReviewed,type Answer } from './model';
import { reviewCopy } from './reviewCopy';
export function ReviewConfirmation({answer,id,language,disabled,onChange}:{answer:Answer;id:string;language:string;disabled:boolean;onChange:(checked:boolean)=>void}){
 const c=reviewCopy(language);
 return <div className="answer-confirmation"><label><input type="checkbox" checked={isReviewed(answer,id)} disabled={disabled||!isCurrent(answer,id)} onChange={event=>onChange(event.target.checked)}/><span>{c.confirm}</span></label><p>{c.helper}</p></div>;
}
