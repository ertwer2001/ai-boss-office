import {useEffect,useSyncExternalStore} from 'react';
let current:'connecting'|'connected'|'disconnected'='connecting',started=false,exiting=false;
let lease:{id:string;token:string}|undefined,events:EventSource|undefined;
const listeners=new Set<()=>void>();
export const pageHeaders=():Record<string,string>=>lease?{'X-Boss-Page':lease.id,'X-Boss-Page-Token':lease.token}:{};
const set=(s:typeof current)=>{current=s;listeners.forEach(f=>f())};
async function request(path:string,body:unknown){return fetch('/api/presence/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Boss-Office':'local'},body:JSON.stringify(body)})}
async function connect(){
 if(exiting)return;
 try{const r=await request('open',{});if(!r.ok)throw new Error('未連線');const next=await r.json();if(exiting){void request('close',next);return}lease=next;
  const source=new EventSource(`/api/presence/events?id=${next.id}&token=${next.token}`);events=source;
  source.onmessage=()=>{if(exiting||events!==source)return;void request('ack',next).then(r=>{if(r.ok)set('connected');else source.onerror?.(new Event('error'))}).catch(()=>set('disconnected'))};
  source.onerror=()=>{source.close();if(events!==source||exiting)return;set('disconnected');setTimeout(()=>void connect(),2000)};
 }catch{set('disconnected');if(!exiting)setTimeout(()=>void connect(),2000)}
}
function start(){if(started)return;started=true;void connect();window.addEventListener('pagehide',()=>{exiting=true;set('disconnected');if(lease){const body=JSON.stringify(lease);if(!navigator.sendBeacon('/api/presence/close',new Blob([body],{type:'application/json'})))void fetch('/api/presence/close',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true})}events?.close()});window.addEventListener('pageshow',e=>{if(e.persisted){exiting=false;void connect()}})}
export function useOfficePresence(){useEffect(start,[]);return useSyncExternalStore(f=>{listeners.add(f);return()=>{listeners.delete(f)}},()=>current)}
