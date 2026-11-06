/** Semantic cell rows in the supplied 2019 HWP, not PDF layout coordinates.
 * HWP auto-height cells have zero stored height, so PDF geometry is insufficient. */
export const hwpTableRows:Record<string,{page:number;row:number}[]>={};
function rows(id:string,page:number,start:number,count:number) {hwpTableRows[id]=Array.from({length:count},(_,i)=>({page,row:start+i}));}
rows('2-table',4,3,4);rows('3-table',4,11,4);rows('4',4,18,1);
hwpTableRows['4'].push(...Array.from({length:4},(_,i)=>({page:5,row:i+1})));
rows('5',5,9,5);rows('6',5,18,4);rows('8',6,12,5);rows('11.7-table',9,11,4);
rows('12.9-table',11,3,5);rows('12.10-table',11,10,5);
rows('14.8-table',15,5,3);rows('14.10-table',16,4,2);rows('14.11-table',16,8,4);rows('14.16-table',18,5,4);
