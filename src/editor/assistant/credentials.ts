// Credentials live outside the project/autosave/export. The browser origin can use this key, but cannot export it.
// This protects data at rest from accidental cleartext inspection; it is not an XSS security boundary.
export interface CredentialVault {save(value:string):Promise<void>;read():Promise<string|null>;clear():Promise<void>;close():void}
export async function openCredentialVault(indexedDB:IDBFactory,cryptography:Pick<Crypto,'subtle'>,nonce:()=>Uint8Array<ArrayBuffer>,name='assistant-credentials'):Promise<CredentialVault>{
 const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('secrets');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close another preferences window to unlock credential storage'));});
 const read=<T>(key:string)=>new Promise<T|undefined>((resolve,reject)=>{const request=database.transaction('secrets','readonly').objectStore('secrets').get(key);request.onsuccess=()=>resolve(request.result as T|undefined);request.onerror=()=>reject(request.error);});
 const write=(entries:readonly(readonly[string,unknown])[])=>new Promise<void>((resolve,reject)=>{const tx=database.transaction('secrets','readwrite');for(const[key,value]of entries){if(value===undefined)tx.objectStore('secrets').delete(key);else tx.objectStore('secrets').put(value,key);}tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
 const generated=await cryptography.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 // A readwrite transaction serializes first-open races across windows; never replace an existing encryption key.
 const key=await new Promise<CryptoKey>((resolve,reject)=>{const tx=database.transaction('secrets','readwrite'),store=tx.objectStore('secrets'),request=store.get('key');let selected:CryptoKey;
   request.onsuccess=()=>{selected=(request.result as CryptoKey|undefined)??generated;if(request.result===undefined)store.put(selected,'key');};
   tx.oncomplete=()=>resolve(selected);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
 return{
   save:async value=>{if(!value.trim())throw new Error('API key is empty');const iv=nonce();if(iv.length!==12)throw new Error('Credential nonce must contain 12 secure random bytes');const encrypted=await cryptography.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value.trim()));await write([['credential',{iv,encrypted}]]);},
   read:async()=>{const stored=await read<{iv:Uint8Array<ArrayBuffer>;encrypted:ArrayBuffer}>('credential');if(!stored)return null;const decrypted=await cryptography.subtle.decrypt({name:'AES-GCM',iv:stored.iv},key,stored.encrypted);return new TextDecoder().decode(decrypted);},
   clear:()=>write([['credential',undefined]]),close:()=>database.close(),
 };
}
