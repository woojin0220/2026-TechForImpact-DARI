import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type {Answers} from './model.ts';
const DocumentExport=registerPlugin<{save(options:{filename:string;uri:string}):Promise<{saved:boolean}>}>('DocumentExport');
export type ApplicationFileFormat='pdf'|'hwp';
export async function downloadApplicationFile(answers:Answers,format:ApplicationFileFormat){
 const bytes=format==='pdf'?await(await import('./pdf')).applicationPdf(answers):await(await import('./hwp')).applicationHwp(answers);
 const mime=format==='pdf'?'application/pdf':'application/x-hwp';
 if(Capacitor.isNativePlatform()){
  // Keep the cached file alive after the share sheet hands it to another app.
  const path=`exports/DARI-application-${Date.now()}.${format}`;
  let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const {uri}=await Filesystem.writeFile({path,data:btoa(binary),directory:Directory.Cache,recursive:true});
  if(Capacitor.getPlatform()==='android'){await DocumentExport.save({filename:`DARI-application.${format}`,uri});return;}
  try{await Share.share({title:`DARI application (${format.toUpperCase()})`,files:[uri]});}
  catch(error){if(!(error instanceof Error && /^Share cancel(?:ed|led)$/.test(error.message)))throw error;}
  return;
 }
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:mime}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=`DARI-application.${format}`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
