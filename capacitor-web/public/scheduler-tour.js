(function(){
 if(!document.documentElement.classList.contains('dari-embedded'))return;
 var copy=window.DariSchedulerTourCopy[I18N.language]||window.DariSchedulerTourCopy.en;
 var key=window.DariProcedureScope.key('dari.scheduler.tour.v1'),running=false,index=0,initial,resizeObserver;
 var dialog=document.createElement('dialog');dialog.id='scheduler-tour';dialog.className='scheduler-tour scheduler-dialog';dialog.setAttribute('aria-labelledby','scheduler-tour-title');document.body.append(dialog);
 var uid='scheduler-tour-cutout';
 dialog.innerHTML='<svg class="scheduler-tour-mask" aria-hidden="true"><defs><mask id="'+uid+'"><rect width="100%" height="100%" fill="white"/><rect class="scheduler-tour-hole" rx="16" fill="black"/></mask></defs><rect width="100%" height="100%" fill="#151515" fill-opacity=".55" mask="url(#'+uid+')"/><rect class="scheduler-tour-outline" rx="16" fill="none" stroke="white" stroke-opacity=".6"/></svg><section class="scheduler-tour-panel"><small></small><h2 id="scheduler-tour-title"></h2><p></p><div class="scheduler-tour-actions"><button type="button" data-tour="skip"></button><button type="button" data-tour="back"></button><button type="button" data-tour="next"></button></div></section>';
 var panel=dialog.querySelector('.scheduler-tour-panel'),next=dialog.querySelector('[data-tour=next]'),back=dialog.querySelector('[data-tour=back]');
 dialog.querySelector('[data-tour=skip]').textContent=copy.labels[4];back.textContent=copy.labels[2];
 var targets=[['.scheduler-current'],['#scheduler-process-dialog .flow-card'],['#dari-cal-add'],['#dari-cal-title','.dari-cal-field-row'],['#dari-cal-place','#dari-cal-note'],['#documentsList .doc h3','#documentsList .scheduler-document-context'],['#institutionFilters'],['#knowledgeCards>details:first-child']];
 function closeForm(){var form=document.querySelector('.scheduler-form-dialog[open]');if(form){var cancel=form.querySelector('.dari-cal-form-actions button:last-child');if(cancel)cancel.click();}}
 function prepare(){
  if(index!==3&&index!==4)closeForm();
  var process=document.getElementById('scheduler-process-dialog');if(index!==1&&process.open)process.close();
  if(index<=4){go('home');if(index===1)document.querySelector('.scheduler-process-trigger').click();else if((index===3||index===4)&&!document.querySelector('.scheduler-form-dialog[open]'))document.getElementById('dari-cal-add').click();}
  else go(index===5?'documents':index===6?'institutions':'guide');
 }
 function measure(){
  if(!running||!dialog.open)return;
  var nodes=targets[index].map(function(s){var n=document.querySelector(s);return n&&(n.matches('input,textarea')?n.closest('.dari-cal-field'):n);}).filter(Boolean);if(!nodes.length)return;
  var rects=nodes.map(function(n){return n.getBoundingClientRect();});var left=Math.max(8,Math.min.apply(null,rects.map(r=>r.left))-10),right=Math.min(innerWidth-8,Math.max.apply(null,rects.map(r=>r.right))+10),top=Math.max(8,Math.min.apply(null,rects.map(r=>r.top))-10),bottom=Math.min(innerHeight-8,Math.max.apply(null,rects.map(r=>r.bottom))+10);
  dialog.querySelectorAll('.scheduler-tour-hole,.scheduler-tour-outline').forEach(function(rect){rect.setAttribute('x',left);rect.setAttribute('y',top);rect.setAttribute('width',Math.max(0,right-left));rect.setAttribute('height',Math.max(0,bottom-top));});
  var ph=panel.getBoundingClientRect().height,base=innerHeight-ph-32,overlap=top<base+ph+12&&bottom>base-12;
  panel.style.top=Math.max(12,overlap?Math.min(base,top-ph-16):base)+'px';
 }
 function render(){
  if(dialog.open)dialog.close();prepare();
  panel.querySelector('small').textContent=copy.labels[0]+' · '+(index+1)+' / '+copy.steps.length;panel.querySelector('h2').textContent=copy.steps[index][0];panel.querySelector('p').textContent=copy.steps[index][1];back.hidden=index===0;next.textContent=copy.labels[index===copy.steps.length-1?3:1];
  positionEmbeddedDialog(dialog);dialog.showModal();next.focus({preventScroll:true});
  requestAnimationFrame(function(){var node=document.querySelector(targets[index][0]);if(node)node.scrollIntoView({block:'center',behavior:'instant'});measure();});setTimeout(measure,120);setTimeout(measure,380);
 }
 function finish(){if(!running)return;running=false;if(dialog.open)dialog.close();closeForm();var process=document.getElementById('scheduler-process-dialog');if(process.open)process.close();viewed=initial.viewed;detailOpen=initial.detailOpen;outcomesOpen=initial.outcomesOpen;renderRoadmap();renderDetail();go(initial.tab);try{localStorage.setItem(key,'1');}catch{try{sessionStorage.setItem(key,'1');}catch{}}resizeObserver&&resizeObserver.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);sendAppEvent('dari-procedure:fullscreen',{active:false});}
 function start(){if(running)return;running=true;index=0;initial={tab:tab,viewed:viewed,detailOpen:detailOpen,outcomesOpen:outcomesOpen};resizeObserver=new ResizeObserver(measure);resizeObserver.observe(panel);window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);render();}
 dialog.addEventListener('cancel',function(e){e.preventDefault();finish();});dialog.querySelector('[data-tour=skip]').onclick=finish;back.onclick=function(){index=Math.max(0,index-1);render();};next.onclick=function(){if(index===copy.steps.length-1)finish();else{index++;render();}};
 window.addEventListener('message',function(e){if(e.source===window.parent&&e.origin===DARI_PARENT_ORIGIN&&e.data?.type==='dari-procedure:start-tour')start();});
 var seen=false;try{seen=localStorage.getItem(key)==='1'||sessionStorage.getItem(key)==='1';}catch{}if(!seen)setTimeout(start,350);
})();
