import type {Answers} from './model.ts';
export type ApplicationFileFormat='pdf'|'hwp';
export async function downloadApplicationFile(answers:Answers,format:ApplicationFileFormat){
 const bytes=format==='pdf'?await(await import('./pdf')).applicationPdf(answers):await(await import('./hwp')).applicationHwp(answers);
 const mime=format==='pdf'?'application/pdf':'application/x-hwp';
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:mime}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=`DARI-application.${format}`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
