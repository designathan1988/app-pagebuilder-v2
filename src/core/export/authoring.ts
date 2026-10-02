import type {DocumentJson,NodeId} from '../document/model.ts';
import {locate,walk} from '../document/model.ts';
import {languageTagAllowed} from '../document/validate.ts';
import type {Patch} from '../history/transaction.ts';
import type {HandlerContext,Outcome} from '../commands/registry.ts';
import {renameCommand} from '../nodes/names.ts';
import {setAttributeCommand} from '../elements/attributes.ts';
import {batchNames,buttonKind,pageLanguage} from './names.ts';
export type ExportDocument=DocumentJson&{readonly language?:string;readonly codeLanguage?:string};
export function projectLanguagePatches(document:ExportDocument,language:string,codeLanguage:string):readonly Patch[]{
 if(!languageTagAllowed(language)||!languageTagAllowed(codeLanguage))throw new Error('A project language must be a valid language tag');
 return [['language',language],['codeLanguage',codeLanguage]].flatMap(([key,value])=>{if(key===undefined||value===undefined)return [];const held=key==='language'?document.language:document.codeLanguage;return held===value?[]:[{op:held===undefined?'add' as const:'replace' as const,path:[key],value}];});
}
// Reuse the rename owner for every refusal and patch; no partial changes escape when one target is locked.
export function renameBatch(context:HandlerContext<never>,targets:readonly NodeId[],pattern:string,start=1):Outcome<never>{
 if(new Set(targets).size!==targets.length)throw new Error('A batch target must occur once');
 const names=targets.map(id=>{const at=locate(context.state.document,id);if(at===null)throw new Error('A batch target no longer exists');return at.node.name;});
 const renamed=batchNames(names,pattern,start);const patches:Patch[]=[];
 for(const [index,target] of targets.entries()){const outcome=renameCommand.run(context,{target,name:renamed[index]??''});if(outcome.kind!=='change')return outcome;patches.push(...outcome.patches??[]);}
 return {kind:'change',patches};
}
export interface OutputIssue {readonly node:NodeId;readonly kind:'page-language'|'button-kind';readonly value:string;readonly attribute:string}
export function outputIssues(document:ExportDocument,attributeNames:ReadonlyMap<string,string|null>):readonly OutputIssue[]{
 const language=[...attributeNames].find(([,name])=>name==='lang')?.[0];
 const button=[...attributeNames].find(([id,name])=>name==='type'&&id.toLowerCase().includes('button'))?.[0];
 const issues:OutputIssue[]=[];
 for(const page of document.pages){
  if(language!==undefined&&!languageTagAllowed(String((page.tree.attributes as Readonly<Record<string,unknown>>)[language]??'')))issues.push({node:page.tree.id,kind:'page-language',value:pageLanguage(undefined,document.language),attribute:language});
  const visit=(node:typeof page.tree,inForm:boolean)=>{const values=node.attributes as Readonly<Record<string,unknown>>;if(button!==undefined&&node.tag==='button'&&!['button','submit','reset'].includes(String(values[button]??node.customAttributes?.type??'')))issues.push({node:node.id,kind:'button-kind',value:buttonKind(undefined,inForm,typeof node.customAttributes?.form==='string'&&node.customAttributes.form!==''),attribute:button});for(const child of node.children)visit(child,inForm||node.tag==='form');};
  visit(page.tree,false);
 }
 return issues;
}
// Page settings already pass the language validator. Node attributes pass their existing owner, including lock refusal.
export function fixOutputIssues(context:HandlerContext<never>,issues:readonly OutputIssue[]):Outcome<never>{
 const patches:Patch[]=[];
 for(const issue of issues){const at=locate(context.state.document,issue.node);if(at===null)throw new Error('The reported node no longer exists');
  if(issue.kind==='page-language'){
   if(at.parent!==null||!languageTagAllowed(issue.value))throw new Error('Invalid page language correction');
   const held=(at.node.attributes as Readonly<Record<string,unknown>>)[issue.attribute];if(held!==issue.value)patches.push({op:held===undefined?'add':'replace',path:[...at.path,'attributes',issue.attribute],value:issue.value});
  }else{const outcome=setAttributeCommand.run(context,{target:issue.node,attribute:issue.attribute as Parameters<typeof setAttributeCommand.run>[1]['attribute'],value:issue.value});if(outcome.kind!=='change')return outcome;patches.push(...outcome.patches??[]);}
 }
 return {kind:'change',patches};
}
export function formNodes(document:DocumentJson):ReadonlySet<NodeId>{const inside=new Set<NodeId>();for(const page of document.pages)for(const node of walk(page.tree))if(node.tag==='form')for(const child of walk(node))inside.add(child.id);return inside;}
