// MCP standard-input/output transport. The executable wiring injects the current manifest-derived handler.
export function serveStdio(handler,input,output){
 let buffer='';let closed=false;
 const write=(value)=>{if(value!==null&&!closed)output.write(JSON.stringify(value)+'\n');};
 const data=(chunk)=>{buffer+=chunk.toString('utf8');if(buffer.length>16*1024*1024){write({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Request too large'}});buffer='';return;}
   for(let end;(end=buffer.indexOf('\n'))>=0;){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;let value;try{value=JSON.parse(line);}catch{write({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});continue;}void handler(value).then(write,error=>write({jsonrpc:'2.0',id:value.id??null,error:{code:-32603,message:error instanceof Error?error.message:'Internal error'}}));}
 };
 input.setEncoding('utf8');input.on('data',data);
 return()=>{closed=true;input.off('data',data);};
}
