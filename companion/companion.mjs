import {toolCatalogue} from '../src/editor/assistant/catalogue.ts';
import {readTools} from '../src/editor/assistant/editor.ts';
import {createMcpHandler} from '../src/editor/assistant/mcp.ts';
import {createEditorBridge} from './bridge.mjs';
import {providerProxy} from './proxy.mjs';
import {serveStdio} from './stdio.mjs';
// The Companion executable injects its manifest and approved active editor selector. No project data is cached here.
export async function startAssistantCompanion({commands,words,origins,selectSession,input,output,port=0,allowedProviderHosts=['api.anthropic.com'],handlers=[]}){
 const provider=providerProxy({allowedHosts:allowedProviderHosts});
 const bridge=await createEditorBridge({origins,port,onRequest:async(request,response)=>{
   for(const handler of handlers)if(await handler(request,response))return true;
   if(request.url==='/provider/stream'){await provider(request,response);return true;}
   return false;
 }});
 const tools=[...toolCatalogue(commands,words),...readTools];
 const handler=createMcpHandler({tools,execute:async(name,args,signal)=>{
   const selected=await selectSession(bridge.sessions());if(!selected)throw new Error('Select an open editor before using tools');
   return bridge.call(selected,name,args,signal);
 }});
 const stop=serveStdio(handler,input,output);
 return{url:bridge.url,token:bridge.token,sessions:bridge.sessions,close:async()=>{stop();await bridge.close();}};
}
