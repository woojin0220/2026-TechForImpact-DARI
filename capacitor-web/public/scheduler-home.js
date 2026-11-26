/* Reuse the procedure's records and checklists; no inferred dates or stages. */
(function(){
 if(!document.documentElement.classList.contains('dari-embedded'))return;
 var c=window.DariSchedulerHomeCopy[window.DariProcedureI18n.language]||window.DariSchedulerHomeCopy.en;
 var experience=window.DariSchedulerTourCopy[I18N.language]||window.DariSchedulerTourCopy.en;
 var home=document.getElementById('view-home'),calendar=document.getElementById('dari-calendar-root');
 var stage=document.createElement('section');stage.className='scheduler-current';
 var tasks=document.createElement('section');tasks.className='scheduler-tasks';
 var process=document.createElement('dialog');process.className='scheduler-process scheduler-dialog';process.id='scheduler-process-dialog';
 var summary=document.createElement('h2');summary.textContent=c[4];summary.id='scheduler-process-title';process.setAttribute('aria-labelledby',summary.id);var close=document.createElement('button');close.type='button';close.className='scheduler-dialog-close';close.textContent='×';close.setAttribute('aria-label',document.querySelector('[data-close=locateDialog]').textContent);close.onclick=function(){process.close();};process.append(close,summary);
 var overview=home.querySelector('.overview-title');if(overview)overview.hidden=true;
 ['.flow-card','#stageDetail','.home-notes'].forEach(function(selector){var el=home.querySelector(selector);if(el)process.append(el);});
 home.append(stage,calendar,tasks,process);
 var info=document.createElement('ol');info.className='scheduler-footnote';
 (window.DariSchedulerRiskCopy[I18N.language]||window.DariSchedulerRiskCopy.en).forEach(function(text){var item=document.createElement('li');item.textContent=text;info.append(item);});home.append(info);
 info.hidden=true;
 function syncNotice(){sendAppEvent('dari-procedure:notice',{lines:window.DariSchedulerRiskCopy[I18N.language]||window.DariSchedulerRiskCopy.en,active:!home.hidden&&!document.querySelector('dialog[open]')});}
 new MutationObserver(syncNotice).observe(home,{attributes:true,attributeFilter:['hidden']});syncNotice();
 new MutationObserver(syncNotice).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 var footer=document.querySelector('.content>footer.footer');if(footer)footer.hidden=true;
 var storage=document.getElementById('storageStatus');if(storage){function placeStorage(){storage.hidden=!storage.classList.contains('is-error');}new MutationObserver(placeStorage).observe(storage,{attributes:true,attributeFilter:['class']});placeStorage();}
 var trigger=document.createElement('button');trigger.className='scheduler-process-trigger';trigger.type='button';trigger.textContent=experience.labels[6]+' ›';trigger.addEventListener('click',function(){openProcess(position().stage||'prepare');});
 stage.before(trigger);tasks.hidden=true;
 var locate=document.getElementById('locateDialog');locate.querySelectorAll('p.small-note').forEach(function(el){el.hidden=true;});
 document.getElementById('questionHelp').hidden=false;

 ['documents','institutions','guide'].forEach(function(key,index){var view=document.getElementById('view-'+key),intro=view.querySelector('.intro');if(intro){var eyebrow=intro.querySelector('.eyebrow');if(eyebrow)eyebrow.hidden=true;var text=intro.querySelector('p');if(text)text.textContent=c[24+index];var chip=intro.querySelector('.chip');if(chip)chip.hidden=true;}});
 document.querySelectorAll('[data-go=review],.nav .review').forEach(function(el){el.hidden=true;});
 var inst=document.getElementById('institutionCards'),counter=document.createElement('p');counter.className='scheduler-institution-count';inst.before(counter);function countInstitutions(){counter.textContent=inst.children.length+' '+c[23];Array.from(inst.children).forEach(function(card,index){var title=card.querySelector('h3');if(!title)return;var number=title.querySelector('.scheduler-list-number');if(!number){number=document.createElement('span');number.className='scheduler-list-number';title.prepend(number);}number.textContent=new Intl.NumberFormat(I18N.language).format(index+1)+'. ';});}new MutationObserver(countInstitutions).observe(inst,{childList:true});countInstitutions();
 if(c[35]){
  var resources=document.createElement('article');resources.className='card scheduler-materials';
  var basic=document.createElement('p');basic.textContent=c[28];resources.append(basic);
  [[29,30],[31,32],[33,34]].forEach(function(pair){var h=document.createElement('h3'),text=document.createElement('p');h.textContent=c[pair[0]];text.textContent=c[pair[1]];resources.append(h,text);});
  var source=document.createElement('a');source.textContent=c[35]+' ↗';source.href='https://help.unhcr.org/southkorea/applying-for-asylum/what-happens-after-i-apply-for-asylum/';source.target='_blank';source.rel='noopener noreferrer';resources.append(source);var law=document.createElement('a');law.textContent=I18N.language==='ko'?'첨부 서류 요건 ↗':'Required attachments ↗';law.href='https://law.go.kr/LSW/lsLinkCommonInfo.do?lspttninfSeq=57668';law.target='_blank';law.rel='noopener noreferrer';resources.append(document.createElement('br'),law);var target=document.querySelector('#view-documents .stack>.card:last-child');if(target)target.replaceWith(resources);else document.getElementById('view-documents').append(resources);
 }
 process.addEventListener('click',function(e){if(e.target.closest('[data-action],[data-go]'))process.close();});
 function openProcess(key){viewed=key;detailOpen=true;outcomesOpen=key==='decision';renderRoadmap();renderDetail();saveView();if(!process.open){positionEmbeddedDialog(process);process.showModal();}else process.scrollTop=0;}
 function draw(){
  var focused=document.activeElement&&document.activeElement.id,p=position();
  stage.replaceChildren();var label=document.createElement('p');label.className='scheduler-label';label.textContent=c[0];
  var row=document.createElement('div');row.className='scheduler-current-row';var title=document.createElement('h2');title.textContent=p.stage?stageData[p.stage].name:c[1];
  var edit=document.createElement('button');edit.type='button';edit.className='scheduler-stage-edit';edit.textContent=experience.labels[5];edit.addEventListener('click',startLocate);row.append(title);var head=document.createElement('div');head.className='scheduler-current-heading';head.append(label,edit);stage.before(trigger);stage.append(head,row);
  var rail=document.createElement('ol');rail.className='scheduler-stage-rail';var labels=['m096','m184','m116','m126','m136'];
  stageOrder.forEach(function(key,index){var li=document.createElement('li');var button=document.createElement('button');button.type='button';button.className='scheduler-rail-step';if(key===p.stage){button.classList.add('is-active');button.setAttribute('aria-current','step');}var dot=document.createElement('span');dot.className='scheduler-rail-dot';dot.textContent=String(index+1);var name=document.createElement('span');name.textContent=I18N.t(labels[index]);button.append(dot,name);button.addEventListener('click',function(){openProcess(key);});li.append(button);rail.append(li);});stage.append(rail);
  tasks.hidden=true;tasks.replaceChildren();if(p.stage){var heading=document.createElement('h2');heading.textContent=c[3];var head=document.createElement('div');head.className='scheduler-task-heading';var count=document.createElement('span');var done=stageData[p.stage].tasks.filter(function(task){return state.checks[task[0]]===true;}).length;count.textContent=done+' / '+stageData[p.stage].tasks.length;count.setAttribute('aria-label',c[9]+' '+count.textContent);head.append(heading,count);var progress=document.createElement('progress');progress.max=stageData[p.stage].tasks.length;progress.value=done;progress.setAttribute('aria-label',c[9]);tasks.append(head,progress);
   stageData[p.stage].tasks.forEach(function(task){var item=document.createElement('div');item.className='scheduler-task';var box=document.createElement('input');box.type='checkbox';box.id='home-task-'+task[0];box.dataset.check=task[0];box.checked=state.checks[task[0]]===true;
    var name=document.createElement('label');name.htmlFor=box.id;name.textContent=task[1];
    var action=document.createElement('button');action.type='button';action.textContent='→';action.setAttribute('aria-label',task[1]);action.addEventListener('click',function(){if(task[3]==='writing')openApplication();else go(task[3]);});item.append(box,name,action);tasks.append(item);});}
  if(focused){var target=document.getElementById(focused);if(target)target.focus({preventScroll:true});}
 }
 new MutationObserver(draw).observe(document.getElementById('roadmap'),{childList:true});draw();
})();
