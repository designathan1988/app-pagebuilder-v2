// Authenticated by createEditorBridge before this handler runs. The key stays in the request memory, never a log.
export function providerProxy({allowedHosts=['api.anthropic.com'],fetcher=fetch}={}){
 return async(request,response)=>{
   if(request.method!=='POST'||request.url!=='/provider/stream'){response.writeHead(404);response.end();return;}
   let size=0;const parts=[];
   for await(const part of request){size+=part.length;if(size>16*1024*1024){response.writeHead(413);response.end();return;}parts.push(part);}
   let value;try{value=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{response.writeHead(400);response.end();return;}
   let url;try{url=new URL(value.url);}catch{response.writeHead(400);response.end();return;}
   if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||!allowedHosts.includes(url.hostname)||url.pathname!=='/v1/messages'){response.writeHead(403);response.end();return;}
   const key=value.apiKey;if(typeof key!=='string'||!key.trim()||typeof value.body!=='string'){response.writeHead(400);response.end();return;}
   const controller=new AbortController();response.on('close',()=>controller.abort());
   try{
     const upstream=await fetcher(url,{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:value.body,signal:controller.signal,redirect:'error'});
     response.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')??'text/event-stream','cache-control':'no-store'});
     if(upstream.body)for await(const chunk of upstream.body){if(!response.write(chunk))await new Promise(resolve=>{const finish=()=>{response.off('drain',finish);response.off('close',finish);resolve();};response.once('drain',finish);response.once('close',finish);});if(controller.signal.aborted)break;}
     response.end();
   }catch{if(!response.headersSent)response.writeHead(502);response.end();}
 };
}
