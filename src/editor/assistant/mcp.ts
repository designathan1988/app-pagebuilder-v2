import type {ToolDefinition} from './catalogue.ts';
import type {ToolResult} from './chat.ts';
export interface McpPorts {tools:readonly ToolDefinition[];execute(name:string,args:unknown,signal:AbortSignal):Promise<ToolResult>}
interface Request {jsonrpc?:unknown;id?:unknown;method?:unknown;params?:unknown}
export function createMcpHandler(ports:McpPorts){
 let initialized=false,negotiated=false;const running=new Map<string,AbortController>();
 return async(value:unknown):Promise<unknown|null>=>{
   const request=value as Request;
   if(!request||request.jsonrpc!=='2.0'||typeof request.method!=='string')return{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}};
   if(request.params!==undefined&&(request.params===null||typeof request.params!=='object'||Array.isArray(request.params)))return{jsonrpc:'2.0',id:request.id??null,error:{code:-32602,message:'Parameters must be an object'}};
   const params=(request.params??{})as Record<string,unknown>;
   const error=(code:number,message:string)=>({jsonrpc:'2.0',id:request.id??null,error:{code,message}});
   if(request.method==='notifications/cancelled'){running.get(JSON.stringify(params.requestId))?.abort();return null;}
   if(request.method==='notifications/initialized'){if(negotiated)initialized=true;return null;}
   if(request.id===undefined)return null;
   if(typeof request.id!=='string'&&typeof request.id!=='number')return error(-32600,'Invalid request id');
   const ok=(result:unknown)=>({jsonrpc:'2.0',id:request.id,result});
   if(request.method==='initialize'){negotiated=true;return ok({protocolVersion:['2025-06-18','2025-03-26','2024-11-05'].includes(String(params.protocolVersion))?params.protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'builder-companion',version:'1.0.0'}});}
   if(request.method==='ping')return ok({});
   if(!initialized)return error(-32002,'Initialize the connection first');
   if(request.method==='tools/list')return ok({tools:ports.tools.map(tool=>({name:tool.name,description:tool.description,inputSchema:tool.input_schema}))});
   if(request.method!=='tools/call')return error(-32601,'Method not found');
   if(typeof params.name!=='string'||!ports.tools.some(tool=>tool.name===params.name))return error(-32602,'Unknown tool');
   const controller=new AbortController(),key=JSON.stringify(request.id);if(running.has(key))return error(-32600,'Duplicate request id');running.set(key,controller);
   try{return ok(await ports.execute(params.name,params.arguments??{},controller.signal));}
   catch(exception){return ok({isError:true,content:[{type:'text',text:exception instanceof Error?exception.message:'Tool failed'}]});}
   finally{running.delete(key);}
 };
}
