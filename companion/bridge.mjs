import {createServer} from 'node:http';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {WebSocketServer} from 'ws';
export async function createEditorBridge({origins,port=0,timeoutMs=30000,onRequest}){
 const token=randomBytes(32).toString('base64url'),sessions=new Map(),pending=new Map();
 const server=createServer((request,response)=>{
   const origin=request.headers.origin,allowed=origins.includes(origin),host=/^127\.0\.0\.1:\d+$/.test(request.headers.host??'');
   if(!allowed||!host){response.writeHead(403);response.end();return;}
   response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');
   if(request.method==='OPTIONS'){response.writeHead(204,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'authorization,content-type'});response.end();return;}
   const bearer=request.headers.authorization?.replace(/^Bearer /,''),supplied=Buffer.from(bearer??''),expected=Buffer.from(token);
   if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){response.writeHead(401);response.end();return;}
   if(onRequest){void Promise.resolve(onRequest(request,response)).then(handled=>{if(handled===false&&!response.writableEnded){response.writeHead(404);response.end();}}).catch(()=>{if(!response.headersSent)response.writeHead(500);response.end();});return;}
   response.writeHead(404);response.end();
 });
 const sockets=new WebSocketServer({noServer:true,maxPayload:12*1024*1024});
 server.on('upgrade',(request,socket,head)=>{
   const origin=request.headers.origin,host=request.headers.host;
   if(!origins.includes(origin)||!/^127\.0\.0\.1:\d+$/.test(host??'')||request.url!=='/editor'){socket.destroy();return;}
   sockets.handleUpgrade(request,socket,head,connection=>sockets.emit('connection',connection,request));
 });
 sockets.on('connection',socket=>{
   let session;const timer=setTimeout(()=>socket.close(1008,'Authentication required'),5000);
   socket.on('message',bytes=>{
     let data;try{data=JSON.parse(bytes.toString());if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid envelope');}catch{socket.close(1007,'Invalid JSON');return;}
     if(!session){const supplied=typeof data.token==='string'?Buffer.from(data.token):Buffer.alloc(0),expected=Buffer.from(token);
       if(data.kind!=='hello'||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){socket.close(1008,'Unauthorized');return;}
       clearTimeout(timer);session=randomUUID();sessions.set(session,socket);socket.send(JSON.stringify({kind:'connected',session}));return;
     }
     const held=pending.get(data.id);if(!held||held.session!==session)return;
     pending.delete(data.id);clearTimeout(held.timer);held.cleanup();if(data.error)held.reject(new Error(String(data.error)));else held.resolve(data.result);
   });
   socket.on('close',()=>{clearTimeout(timer);if(session)sessions.delete(session);for(const[id,held]of pending)if(held.session===session){pending.delete(id);clearTimeout(held.timer);held.cleanup();held.reject(new Error('Editor disconnected'));}});
   socket.on('error',()=>socket.close());
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 const address=server.address();
 return{token,url:`ws://127.0.0.1:${address.port}/editor`,sessions:()=>[...sessions.keys()],
   call:(session,method,args,signal)=>new Promise((resolve,reject)=>{
     const socket=sessions.get(session);if(!socket){reject(new Error('Select an open editor session'));return;}
     if(signal?.aborted){reject(signal.reason);return;}const id=randomUUID();
     const abort=()=>{const held=pending.get(id);if(!held)return;pending.delete(id);clearTimeout(held.timer);held.cleanup();socket.send(JSON.stringify({kind:'cancel',id}));reject(signal.reason??new Error('Cancelled'));};
     const timer=setTimeout(()=>{pending.delete(id);signal?.removeEventListener('abort',abort);if(socket.readyState===1)socket.send(JSON.stringify({kind:'cancel',id}));reject(new Error('Editor request timed out'));},timeoutMs);
     pending.set(id,{session,resolve,reject,timer,cleanup:()=>signal?.removeEventListener('abort',abort)});signal?.addEventListener('abort',abort,{once:true});socket.send(JSON.stringify({kind:'request',id,method,args}));
   }),close:async()=>{for(const socket of sockets.clients)socket.terminate();await new Promise(resolve=>sockets.close(resolve));await new Promise(resolve=>server.close(resolve));},
 };
}
