/** Version-specific ruled rows in the provided 2019 form. PDF coordinates are
 * points from the top of each original page, not the generic text box grid.
 * The first rule at 519.72 is below the instructions, not an answer baseline. */
export const statementSlots = [
  ...Array.from({length:8},(_,i)=>({page:19,row:5+i,bottom:551.28+i*31.56})),
  ...[99.12,129.48,159.72,190.08,220.32,250.56,280.92,311.16,341.52,371.76,402.12,432.36,462.6,492.96,523.2,553.56,583.8,614.04,644.4,674.64,705,735.24]
    .map((bottom,i)=>({page:20,row:1+i,bottom})),
];
export function wrapStatement(text:string, fits:(line:string)=>boolean):string[] {
  const lines:string[]=[];
  for(const paragraph of text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n')) {
    let line='';
    for(const char of paragraph) {
      if(line&&!fits(line+char)){lines.push(line);line='';}
      line+=char;
    }
    lines.push(line);
  }
  return lines;
}
