import {slug} from '../text/fold.ts';
import roles from './roles.json' with {type:'json'};
export function semanticName(name:string,tag:string,language:string):string{
 const vocabulary:Readonly<Record<string,readonly string[]>>=language.toLowerCase().startsWith('pt')?roles.pt:roles.en;
 const normalized=slug(name.replace(/\s+\d+$/,''));
 const role=Object.entries(vocabulary).find(([,aliases])=>aliases.some(alias=>slug(alias)===normalized));
 const word=role?.[0]??slug(name);
 return word===''||/^\d/.test(word)?tag.toLowerCase():word;
}
// A name already taken by an element with other styles takes the next free number (hero-2): readable, and stable
// from one export to the next, since elements with the same identity reuse the first name (see export.ts).
export function stableClass(base:string,_identity:string,_page:string,taken:ReadonlySet<string>):string{
 let name=base;
 for(let index=2;taken.has(name);index++)name=`${base}-${index}`;
 return name;
}
export function batchNames(names:readonly string[],pattern:string,start=1):readonly string[]{
 if(!Number.isSafeInteger(start)||start<1||!Number.isSafeInteger(start+names.length))throw new Error('Invalid starting index');
 const output=names.map((name,index)=>pattern.replaceAll('{name}',name).replaceAll('{n}',String(start+index)).trim());
 if(output.some(name=>name===''))throw new Error('Every layer must have a nonempty name');
 return output;
}
export function pageLanguage(own:unknown,project:unknown):string{return typeof own==='string'&&own.trim()!==''?own:typeof project==='string'&&project.trim()!==''?project:'en';}
export function buttonKind(own:unknown,inForm:boolean,associated:boolean):string{return typeof own==='string'&&['button','submit','reset'].includes(own)?own:inForm||associated?'submit':'button';}
