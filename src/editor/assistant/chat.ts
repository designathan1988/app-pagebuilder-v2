import type {ToolDefinition} from './catalogue.ts';
import {streamReply,type ChatMessage,type ContentBlock,type ProviderSettings} from './provider.ts';
export interface ToolResult {content:readonly ContentBlock[];isError?:boolean}
export interface TurnTransaction {execute(name:string,args:unknown,signal:AbortSignal):Promise<ToolResult>;commit():void;cancel():void}
export interface ChatPorts {tools:readonly ToolDefinition[];begin:()=>TurnTransaction;onText:(text:string)=>void;onTool:(name:string,result:ToolResult)=>void;fetch?:typeof fetch}
export interface TurnResult {messages:ChatMessage[];inputTokens:number;outputTokens:number}
// No tools execute before their complete JSON arrives. One transaction spans the turn; failure/cancel restores it.
export async function runTurn(settings:ProviderSettings,history:readonly ChatMessage[],ports:ChatPorts,signal:AbortSignal,maxRounds=24):Promise<TurnResult>{
 const messages=[...history];let transaction:TurnTransaction|undefined,inputTokens=0,outputTokens=0;
 try{
   for(let round=0;round<maxRounds;round++){
     signal.throwIfAborted();const reply=await streamReply(settings,messages,ports.tools,ports.onText,signal,ports.fetch);inputTokens+=reply.inputTokens;outputTokens+=reply.outputTokens;
     messages.push({role:'assistant',content:reply.content});const calls=reply.content.filter(block=>block.type==='tool_use');
     if(!calls.length){if(reply.stopReason==='max_tokens')throw new Error('Assistant response reached the token limit');transaction?.commit();return{messages,inputTokens,outputTokens};}
     transaction??=ports.begin();const results:ContentBlock[]=[];
     for(const call of calls){
       signal.throwIfAborted();if(typeof call.id!=='string'||typeof call.name!=='string')throw new Error('Malformed tool call');
       const result=await transaction.execute(call.name,call.input,signal);ports.onTool(call.name,result);
       const content=result.content.map(block=>block.type==='image'&&typeof block.data==='string'?{type:'image',source:{type:'base64',media_type:block.mimeType,data:block.data}}:block);
       results.push({type:'tool_result',tool_use_id:call.id,content,is_error:result.isError??false});
     }messages.push({role:'user',content:results});
   }throw new Error('Assistant tool round limit reached');
 }catch(error){transaction?.cancel();throw error;}
}
