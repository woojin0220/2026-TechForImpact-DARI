import {writeFileSync} from 'node:fs';
import {applicationSteps} from '../src/form/schema.ts';

// Context is a translation subject, never an answer or a conditional threshold.
const subjects={
 '1.12':'Race, ethnic or tribal group (인종, 종족, 민족)',
 '1.13':'Mother tongue and language proficiency',
 '1.14':'Interpreter needs and requested language',
 '2':'Other citizenship or permanent residence',
 '3':'Marital status and family circumstances',
 '4':'Family members and their biographical details',
 '5':'Education history', '6':'Employment history', '8':'Residence history',
 '9.10':'Travel document available for issuance',
 '14.1':'Stated reasons for seeking refugee status',
 '14.2':'Past harm or threats personally experienced',
 '14.3':'Feared harm upon return and uncertainty about future events',
 '14.4':'Harm or threats concerning family or friends, including reported events',
 '14.5':'Requests for protection from authorities or reasons for not requesting protection',
 '14.6':'Relocation within the home country for safety',
 '14.7':'Departure date', '14.8':'Membership or participation in organizations',
 '14.9':'Political activities', '14.10':'Criminal proceedings or punishment',
 '14.11':'Previous asylum applications, including to UNHCR',
 '14.12':'Previously recognized refugee status in another country',
 '14.13':'Whether children accompany the applicant',
 '14.14':'Risks specific to accompanying children',
 '14.15':'Contact with family remaining in the home country',
 '14.16':'Supporting evidence and documents',
 '14.17':'How the applicant learned about the application procedure',
 '14.18':'Timing of application and reasons for delay',
 '15':'Additional statement besides the answers above',
};
const fields=applicationSteps.flatMap(s=>s.fields);
const ids=[...new Set(fields.map(f=>f.id.split('-')[0]))];
const profiles=Object.fromEntries(ids.map(id=>{
 const members=fields.filter(f=>f.id.split('-')[0]===id);
 const kind=members.some(f=>f.type==='table')?'table':members.some(f=>f.type==='long')?'narrative':'short';
 return [id,{subject:subjects[id]??members[0].en,kind}];
}));
writeFileSync(new URL('../src/application/translationProfiles.json',import.meta.url),JSON.stringify({version:'application-hymt-v2',profiles},null,2)+'\n');
