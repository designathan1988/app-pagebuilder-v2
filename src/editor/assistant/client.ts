import type {ToolResult} from './chat.ts';
export interface BridgeClientPorts {execute(name:string,args:unknown,signal:AbortSignal):Promise<ToolResult>;onState(state:'connecting'|'connected'|'disconnected',session?:string):void;onError(error:Error):void}
export function connectEditor(url:string,token:string,ports:BridgeClientPorts,makeSocket:(url:string)=>WebSocket=url=>new WebSocket(url)):()=>void{
 const address=new URL(url);if(address.protocol!=='ws:'||address.hostname!=='127.0.0.1'||address.pathname!=='/editor')throw new Error('Editor bridge must use authenticated loopback');
 const socket=makeSocket(url),running=new Map<string,AbortController>();let closed=false,queue=Promise.resolve();ports.onState('connecting');
 socket.addEventListener('open',()=>socket.send(JSON.stringify({kind:'hello',token})));
 socket.addEventListener('message',event=>{
   let message:Record<string,unknown>;try{message=JSON.parse(String(event.data)) as Record<string,unknown>;}catch{ports.onError(new Error('Invalid bridge message'));socket.close();return;}
   if(message.kind==='connected'){ports.onState('connected',String(message.session));return;}
   if(message.kind==='cancel'){running.get(String(message.id))?.abort();return;}
   if(message.kind!=='request'||typeof message.id!=='string'||typeof message.method!=='string')return;
   const id=message.id,method=message.method,controller=new AbortController();running.set(id,controller);
   queue=queue.then(async()=>{
     if(closed)return;
     try{controller.signal.throwIfAborted();const result=await ports.execute(method,message.args,controller.signal);if(socket.readyState===1)socket.send(JSON.stringify({id,result}));}
     catch(error){if(socket.readyState===1)socket.send(JSON.stringify({id,error:error instanceof Error?error.message:'Command failed'}));}
     finally{running.delete(id);}
   });
 });
 const finish=()=>{if(closed)return;closed=true;for(const controller of running.values())controller.abort();running.clear();ports.onState('disconnected');};
 socket.addEventListener('close',finish);socket.addEventListener('error',()=>{ports.onError(new Error('Editor bridge connection failed'));finish();});
 return()=>{finish();socket.close();};
}
