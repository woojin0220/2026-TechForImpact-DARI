/** Read-only presentation. Never insert numbering into, or retranslate the original. */
export function sentences(text:string,language:string):string[]{
 const keepWhitespace=(items:string[])=>{const result:string[]=[];let prefix='';for(const item of items){if(item.trim()){result.push(prefix+item);prefix='';}else if(result.length)result[result.length-1]+=item;else prefix+=item;}return result;};
 const api=Intl as typeof Intl & {Segmenter?:new(locale:string,options:{granularity:string})=>{segment:(text:string)=>Iterable<{segment:string}>}};
 if(api.Segmenter){
  try{return keepWhitespace(Array.from(new api.Segmenter(language,{granularity:'sentence'}).segment(text),s=>s.segment));}catch{/* Unsupported locale: retain whole paragraphs. */}
 }
 return keepWhitespace(text.split(/(?<=\n)/u));
}
