import {randomBytes} from 'node:crypto';
/** Page leases control execution, not login. Any office page closing stops all office jobs. */
export class OfficePresence {
 private sessions=new Map<string,{token:string;ack:number;connected:boolean}>();
 private stopping?:Promise<void>;
 lastError='';
 constructor(private stopAll:()=>Promise<void>,readonly timeoutMs=15000,private now=()=>Date.now()){}
 open(){const id=randomBytes(16).toString('hex'),token=randomBytes(24).toString('hex');this.sessions.set(id,{token,ack:this.now(),connected:false});return {id,token}}
 valid(id:string,token:string){return this.sessions.get(id)?.token===token&&!!token}
 active(id:string,token:string){const s=this.sessions.get(id);return this.valid(id,token)&&!!s?.connected&&this.now()-s.ack<this.timeoutMs&&!this.stopping&&!this.lastError}
 connect(id:string,token:string){if(!this.valid(id,token))throw new Error('頁面連線已失效，請重新開啟辦公室');const s=this.sessions.get(id)!;if(s.connected)throw new Error('此頁面已連線');s.connected=true;s.ack=this.now()}
 ack(id:string,token:string){if(!this.valid(id,token))return false;this.sessions.get(id)!.ack=this.now();return true}
 get available(){return !this.stopping&&!this.lastError&&[...this.sessions.values()].some(s=>s.connected&&this.now()-s.ack<this.timeoutMs)}
 get count(){return [...this.sessions.values()].filter(s=>s.connected).length}
 async close(id:string,token:string){if(!this.valid(id,token))return;this.sessions.delete(id);await this.stop()}
 private async stop(){if(!this.stopping){this.stopping=this.stopAll().then(()=>{this.lastError=''}).catch(e=>{this.lastError=(e as Error).message}).finally(()=>{this.stopping=undefined})}await this.stopping}
 async sweep(){const expired=[...this.sessions].filter(([,s])=>this.now()-s.ack>=this.timeoutMs);for(const [id] of expired)this.sessions.delete(id);if(expired.length||this.lastError)await this.stop()}
}
