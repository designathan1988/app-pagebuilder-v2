export interface StreamEvent {event:string;data:Record<string,unknown>}
export async function* parseEvents(stream:ReadableStream<Uint8Array>,signal?:AbortSignal):AsyncGenerator<StreamEvent>{
 const reader=stream.getReader(),decoder=new TextDecoder();let buffer='',event='message',data:string[]=[];
 const parse=():StreamEvent|null=>{if(!data.length){event='message';return null;}const payload=JSON.parse(data.join('\n')) as Record<string,unknown>;const result={event,data:payload};event='message';data=[];return result;};
 const abort=()=>{void reader.cancel(signal?.reason);};signal?.addEventListener('abort',abort,{once:true});
 try{
   for(;;){signal?.throwIfAborted();const{value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});
     if(buffer.length>2_000_000||data.reduce((sum,line)=>sum+line.length,0)>2_000_000)throw new Error('Provider event exceeds size limit');
     let end:number;
     while((end=buffer.indexOf('\n'))>=0){let line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(line.endsWith('\r'))line=line.slice(0,-1);
       if(!line){const item=parse();if(item)yield item;continue;}if(line.startsWith(':'))continue;
       const colon=line.indexOf(':'),field=colon<0?line:line.slice(0,colon);let text=colon<0?'':line.slice(colon+1);if(text.startsWith(' '))text=text.slice(1);
       if(field==='event')event=text;else if(field==='data')data.push(text);
     }if(done)break;
   }
   if(buffer.trim()||data.length)throw new Error('Provider stream ended inside an event');
 }finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
