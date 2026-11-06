// Hand-authored fictional end state, not a recorded LLM run or a real application.
// Exercises the actual metadata -> question14 -> export path without model calls.
import {createSession,calculateCoverage,exportSession} from '../src/intake/index.ts';
import {applyFormAnswers} from '../src/intake/form.ts';
import {buildQuestion14Answers} from '../src/intake/derive14.ts';
import {requirementsById} from '../src/intake/catalog.ts';
const text=text=>({kind:'text',text});
const choice=(...values)=>({kind:'choice',values});
const table=(...rows)=>({kind:'table',rows});
export function fullExportFixture() {
  let session=createSession('en','full');
  session.id='fictional-full-export';
  session=applyFormAnswers(session,{
    '1.1':choice('principal'),'1.2':text('SOKOLOV'),'1.3':text('ALEKSEI'),
    '1.4':text('없음'),'1.5':text('1991/08/17'),'1.6':choice('male'),
    '1.7':text('러시아'),'1.8':text('소프트웨어 개발자(현재 무직)'),'1.9':text('러시아 상트페테르부르크'),
    '1.10':text('러시아 상트페테르부르크 중앙구 (상세 주소는 시연에서 생략)'),'1.11':text('무종교'),'1.12':text('러시아인'),
    '1.13':text('러시아어'),'1.13-fluent':choice('en','other'),'1.13-other':text('러시아어'),'1.14':choice('yes'),
    '1.14-language':text('러시아어'),'1.14-request':text('일상적인 영어 대화는 가능하지만 중요한 진술은 모국어인 러시아어 통역을 통해 확인하고 싶습니다. 한국어는 이해하지 못합니다.'),
    '2':choice('no'),'3':choice('single'),
    '4':table(
      {relationship:'부',name:'SERGEI SOKOLOV',dob:'1962/03/12',nationality:'러시아',city:'2021/11/08 사망'},
      {relationship:'모',name:'ELENA SOKOLOVA',dob:'1965/09/24',nationality:'러시아',city:'상트페테르부르크'}),
    '5':table(
      {from:'1998/09',to:'2009/06',school:'시립 일반학교',location:'상트페테르부르크',degree:'초중등 졸업'},
      {from:'2009/09',to:'2014/06',school:'네바 공과대(가공)',location:'상트페테르부르크',degree:'컴퓨터공학 학사'}),
    '6':table({from:'2014/08',to:'2026/04',workplace:'노스코드(가공)',location:'상트페테르부르크',duty:'서버 개발자'}),
    '7.1':choice('compulsory'),'7.2':choice('no'),'7.9':choice('no'),
    '8':table(
      {from:'1991/08',to:'2026/04',country:'러시아',address:'상트페테르부르크',status:'국민'},
      {from:'2026/04',to:'2026/05',country:'러시아',address:'사마라 친구 집',status:'국민'},
      {from:'2026/05',to:'현재',country:'대한민국',address:'서울 동대문구',status:'C-3'}),
    '9.1':choice('yes'),'9.2':text('러시아 내무부'),'9.3':text('2024/01/10'),
    '9.4':text('여행'),'9.5':choice('yes'),
    '9.6':text('2024년 해외여행을 준비하면서 본인이 신분증과 신청서를 제출하고 여권을 발급받았습니다. 제 실제 이름과 생년월일이 기재되어 있습니다.'),
    '10.1':choice('yes'),'10.2':text('주러시아 대한민국 공관'),'10.3':text('C-3'),
    '10.4':text('2026/04/20'),'10.5':text('여권, 사진, 신청서, 잔고증명서'),
    '10.6':text('도움을 준 사람 없이 본인이 사증 신청과 항공권 예약을 진행했습니다.'),
    '10.7':text('2026/05/15'),'10.8':text('인천국제공항'),
    '10.9':text('관광 사증으로 입국했으며 위협을 피하여 안전한 곳을 찾으려는 목적도 있었습니다.'),
    '10.10':choice('yes'),'10.11':choice('yes'),
    '11.1':text('C-3'),'11.2':text('2026/08/12'),
    '11.3':{kind:'status',status:'not_applicable'},
    '11.4':text('서울특별시 동대문구 휘경동 임시 숙소 (상세 주소는 시연에서 생략)'),
    '11.5':text('010-0000-0000 (시연용)'),'11.6':text('aleksei.sokolov@example.invalid'),
    '11.7':choice('friends'),
    '11.7-table':table({name:'DMITRI VOLKOV',relationship:'대학 동창',phone:'010-0000-0000'}),
    '11.8':choice('savings'),'11.8-detail':text('본국에서 모은 예금으로 생활하고 있습니다.'),
    '11.9':choice('good'),'11.10':choice('no'),
    '12.1':text('2026/05/15'),'12.2':text('모스크바 공항'),'12.3':text('비행기'),
    '12.4':text('위협을 피해 안전한 곳을 찾기 위해 출국했습니다.'),
    '12.5':choice('no'),'12.9':choice('yes'),
    '12.9-table':table({entry:'2026/05/15',departure:'2026/05/15',country:'튀르키예',location:'이스탄불 공항',visa:'공항 환승',purpose:'한국행 항공편 환승'}),
    '12.10':choice('no'),
  });
  const groups=[
    ['grounds',{
      category:['political'],identity:'I oppose the war and believe people should be able to express that peacefully.',
      perceived:'I attended a small peaceful anti-war gathering in Saint Petersburg in March 2026 and posted a photograph on my public account.',
      summary:'I am a Russian citizen seeking protection after being threatened following my public anti-war activity.'
    },'저는 러시아 국적자로 전쟁에 반대하는 의견을 가지고 있습니다. 2026년 3월 상트페테르부르크에서 열린 소규모의 평화적인 반전 모임에 참석하고 공개 계정에 사진을 올렸습니다. 그 뒤 위협을 받아 정치적 의견을 이유로 보호를 신청합니다.'],
    ['harm',{
      gate:'yes',event:'Two men came to my home and told me not to attend another rally.',
      type:['threat'],time:'Around early April 2026; I cannot remember the exact date.',
      place:'My apartment in the central district of Saint Petersburg.',actor:'Two men wore what looked like police uniforms, but I could not confirm their affiliation.',
      reason:'I believe it was connected to the rally because they told me not to attend another rally.',
      result:'I was not detained or injured. I left my apartment in mid-April and stayed with my friend Pavel in Samara.'
    },'2026년 4월 초쯤 상트페테르부르크 중앙구의 제 아파트에 두 남성이 찾아와 다시 집회에 참석하지 말라고 위협했습니다. 정확한 날짜는 기억나지 않습니다. 경찰 제복처럼 보이는 옷을 입고 있었지만 실제 소속은 확인하지 못했습니다. 집회에 다시 나가지 말라는 말 때문에 제 반전 의견 및 활동과 관련된 일이라고 생각합니다. 구금되거나 다치지는 않았습니다. 4월 중순에 집을 떠나 사마라에 사는 친구 파벨의 집에서 지냈습니다.'],
    ['fear',{
      gate:'yes',harm:'I fear being threatened again or detained if I return.',
      actor:'The men who visited me, although I do not know who they were.',
      reason:'My mother told me by phone that someone asked for me in late April. I did not witness this and do not know whether they were the same men.'
    },'귀국하면 저를 찾아왔던 사람들에게 다시 위협받거나 구금될까 두렵습니다. 그들의 정확한 신원은 모릅니다. 어머니는 2026년 4월 말 누군가 저를 찾았다고 전화로 말했습니다. 저는 직접 보지 못했으며 이전에 찾아온 두 사람과 같은 사람인지는 알지 못합니다.'],
    ['family_harm',{gate:'no'},null],
    ['protection',{gate:'no',no_reason:'I was afraid to approach the police because the visitors appeared to wear police uniforms; I do not know whether they really were police.'},'방문자들이 경찰 제복처럼 보이는 옷을 입고 있어 경찰에 보호를 요청하기가 두려웠습니다. 다만 그들이 실제 경찰인지는 확인하지 못했습니다.'],
    ['relocation',{
      gate:'yes',time:'From mid-April until 14 May 2026.',destination:'My friend Pavel’s home in Samara.',
      left_reason:'I could only stay temporarily and remained afraid after the call from my mother.',
      elsewhere:'I did not know a place where I could safely settle. I do not know whether the men could find me nationwide.'
    },'2026년 4월 중순부터 5월 14일까지 사마라의 친구 파벨 집에 피신했습니다. 임시로만 머물 수 있었고 어머니의 전화를 받은 뒤에도 두려움이 남아 그곳을 떠났습니다. 모스크바로 이동해 5월 15일 출국했습니다. 안전하게 정착할 수 있는 다른 지역을 알지 못했습니다. 다만 그들이 전국에서 저를 찾을 수 있는지는 알지 못합니다.'],
    ['departure',{date:'2026/05/15'},null],
    ['org',{gate:'no'},null],
    ['activity',{gate:'yes',time:'March 2026.',place:'Central Saint Petersburg.',content:'I attended one small peaceful anti-war gathering as an ordinary participant. I did not organize it and was not a member of any political organization. I posted a photograph on my public account. I have not carried out political activity in Korea.'},'2026년 3월 상트페테르부르크 시내에서 열린 소규모의 평화적인 반전 모임에 일반 참가자로 한 차례 참석했습니다. 모임을 주최하지 않았고 정당이나 정치 단체의 회원도 아닙니다. 공개 계정에 현장 사진을 게시했습니다. 한국에 온 뒤에는 정치 활동을 하지 않았습니다.'],
    ['criminal',{gate:'no'},null],['other_app',{gate:'no'},null],['minor',{gate:'no'},null],
    ['contact',{gate:'yes',who:'My mother.',method:'Phone calls.',frequency:'About once a week.'},'본국의 어머니와 일주일에 한 번 정도 전화로 연락합니다.'],
    ['evidence',{gate:'yes',name:'집회 사진',content:'본인 참가 모습',method:'직접 촬영',when:'신청 시'},null],
    ['learned',{time:'2026년 5월 20일',place:'서울',person:'대학 동창 드미트리 볼코프'},null],
    ['late',{gate:'no'},null],
  ];
  for(const [group,values,korean] of groups) {
    const sourceId=`demo-source-${group}`;
    const source=Object.entries(values).map(([key,value])=>`${key}: ${Array.isArray(value)?value.join(', '):value}`).join('\n');
    session.messages.push({id:sourceId,role:'user',content:source,createdAt:'2026-06-01T01:00:00Z'});
    const ids=[];
    for(const [key,value] of Object.entries(values)) {
      const requirementId=key==='gate'?group:`${group}.${key}`,requirement=requirementsById.get(requirementId);
      if(!requirement)throw new Error(`Fixture requirement not found: ${requirementId}`);
      const quote=Array.isArray(value)?value.join(', '):value;
      const fact={id:`demo-fact-${session.facts.length+1}`,requirementId,value,
        sourceIds:[sourceId],sourceQuotes:[{sourceId,quote}],status:'answered',confirmed:true,
        certainty:/cannot remember|Around|could not confirm|do not know/.test(quote)?'uncertain':'exact',
        knowledge:group==='fear'&&key==='reason'?'heard':key==='reason'?'inferred':'direct',
        ...(requirement.repeatable?{eventId:`demo-${group}-1`}:{})};
      session.facts.push(fact);ids.push(fact.id);
    }
    if(korean)session.draft.push({questionId:requirementsById.get(keyForGroup(group)).questionId,text:korean,factIds:ids,sourceIds:[sourceId],sentences:[{text:korean,factIds:ids,sourceIds:[sourceId]}]});
  }
  session.facts=session.facts.map(f=>({...f,confirmed:true}));
  session.narrativeDone=true;session.guidedDone=true;session.draftRevision=1;
  session.question14=buildQuestion14Answers(session);
  session.question14['15']=text('저는 상트페테르부르크에서 소프트웨어 개발자로 일하며 어머니와 가까이 지냈습니다. 정당이나 정치 단체에 가입한 적은 없지만 전쟁에 반대한다는 제 생각을 평화적으로 표현하고 싶었습니다. 방문자들의 경고를 받은 뒤에는 직장에 계속 출근하지 못하고 친구 집에 머물렀습니다.\n사마라에 있는 동안 한국에 거주하는 대학 동창 드미트리에게 연락했습니다. 그는 제가 잠시 머물 곳을 알아보는 데 도움을 주겠다고 했습니다. 저는 제 여권으로 항공권을 예약했고 2026년 5월 15일 모스크바에서 출발해 이스탄불 공항을 경유한 뒤 같은 날 인천에 도착했습니다.\n어머니에게 누군가 저를 찾았다는 말을 들었지만 그 사람이 누구인지는 직접 확인하지 못했습니다. 방문자들이 경찰이었는지 또는 전국에서 저를 찾고 있는지도 알지 못합니다. 저는 구금되거나 폭행당했다고 진술하는 것이 아닙니다. 다시 위협받거나 제 의견 때문에 구금될까 두렵다는 것이 제 우려입니다.\n저는 영어로 기본적인 의사소통을 할 수 있지만 한국어는 이해하지 못합니다. 중요한 내용은 러시아어로 다시 확인하고 싶습니다. 이 신청서에는 제가 직접 겪은 일과 어머니에게 전해 들은 일을 구분하여 적었습니다.');
  const personalStatement='I worked as a software developer in Saint Petersburg and lived near my mother. I was not a member of any political organization, but I wanted to express my opposition to the war peacefully. After the warning I stopped going to work and stayed with a friend. While in Samara I contacted my former university classmate Dmitri, who lives in Korea. He offered to help me find temporary accommodation. I booked my own flights with my own passport and left Moscow on 15 May 2026, transiting through Istanbul and arriving at Incheon that day. My mother told me someone had asked for me, but I did not witness that visit. I do not know whether the visitors were police or could find me nationwide. I am not saying I was detained or assaulted. I fear being threatened again or detained because of my views. I can communicate in English but do not understand Korean. I want to check important details in Russian and distinguish what I experienced from what my mother told me.';
  session.messages.push({id:'demo-source-statement',role:'user',content:personalStatement,createdAt:'2026-06-01T01:00:00Z'});
  session.facts.push({id:`demo-fact-${session.facts.length+1}`,requirementId:'15',value:personalStatement,sourceIds:['demo-source-statement'],sourceQuotes:[{sourceId:'demo-source-statement',quote:personalStatement}],status:'answered',confirmed:true,certainty:'uncertain',knowledge:'unspecified'});
  session.question14['14.18']={kind:'status',status:'not_applicable'};
  session.coverage=calculateCoverage(session);
  session.updatedAt='2026-06-01T01:00:00Z';
  return session;
}
function keyForGroup(group){return group==='grounds'?'grounds.category':group;}
export function fullFixtureMetadata(session) {
  return JSON.stringify({demoOnly:true,note:'Hand-authored fictional completed workflow; no actual LLM execution, legal verification or submission.',...JSON.parse(exportSession(session))},null,2);
}
