import {initialWorkspace,validateBackup} from './documents.mjs';
let database;
export async function openStore(){
  database=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('beck-business-test-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Lokale opslag is niet beschikbaar. Gebruik een gewone browser en sta lokale opslag toe.'));
  });
  return new Promise((resolve,reject)=>{const tx=database.transaction('workspace','readonly'),request=tx.objectStore('workspace').get('main');request.onsuccess=()=>{try{resolve(request.result?validateBackup(request.result):initialWorkspace());}catch(error){reject(error);}};request.onerror=()=>reject(request.error);});
}
// Read and write in one IndexedDB transaction so two tabs cannot allocate the
// same test number or silently overwrite a concurrent document revision.
export function mutate(fn){
  return new Promise((resolve,reject)=>{
    const tx=database.transaction('workspace','readwrite'),store=tx.objectStore('workspace'),request=store.get('main');let result;
    request.onsuccess=()=>{try{result=fn(request.result||initialWorkspace());store.put(result.state||result,'main');}catch(error){tx.abort();reject(error);}};
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('Opslaan is mislukt. Je invoer blijft staan. Maak ruimte vrij en probeer opnieuw.'));
    tx.onabort=()=>reject(new Error('Opslaan is afgebroken. Je invoer blijft staan.'));
  });
}
