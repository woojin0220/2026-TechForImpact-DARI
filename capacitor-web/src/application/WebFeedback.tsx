import {exampleSource} from './uxExample';
export function WebFeedback({language,onExample}:{language:string;onExample?:()=>void}){
 const ko=language==='ko';
 return <aside className="web-feedback-note"><strong>{ko?'사용 흐름 체험 · 실제 번역 제외':'UX demo · live translation excluded'}</strong>
 <p>{ko?'직접 작성하거나 준비된 가상 예시로 확인·저장 과정을 체험하세요. 입력은 이 기기에만 남습니다.':'Write freely, or use the fictional example to explore review and download. Entries stay on this device.'}</p>
 {onExample&&<button type="button" className="secondary" onClick={onExample}>{ko?'가상 예시로 작성 흐름 보기':'Try the fictional example'}</button>}
 </aside>;
}
export {exampleSource};
