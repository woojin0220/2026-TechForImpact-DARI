/** Fixed fictional UX example. Never a translation engine or generated response. */
export const exampleSource = "Two men came to my home and threatened me. I think they were police officers, but I am not certain. I do not remember the exact date. It was around the beginning of March. I was not detained. My neighbor later told me they came back, but I did not see that myself.";
export const exampleKorean = "두 남자가 집에 찾아와 저를 위협했습니다. 경찰관이었던 것 같지만 확실하지 않습니다. 정확한 날짜는 기억나지 않으며, 3월 초쯤이었습니다. 저는 구금되지 않았습니다. 이후 이웃에게 그들이 다시 찾아왔다는 말을 들었지만, 저는 직접 보지 못했습니다.";
export function exampleTranslation(text:string,language:string,id?:string,target='ko'){
 if(id==='14.2'&&language==='en'&&target==='ko'&&text===exampleSource)return exampleKorean;
 throw new Error('WEB_FEEDBACK_ONLY');
}
