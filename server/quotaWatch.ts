import {quotaLow} from './codex';
/** Quota checks run independently of whether the scheduler has a free slot. */
export class QuotaWatch{
 private pending?:Promise<void>;
 constructor(private status:()=>Promise<{quota:unknown}>,private stop:()=>Promise<void>,private error:(message:string)=>void){}
 check(active:boolean){if(!active)return Promise.resolve();if(!this.pending)this.pending=(async()=>{try{if(quotaLow((await this.status()).quota))await this.stop()}catch(e){this.error((e as Error).message)}})().finally(()=>{this.pending=undefined});return this.pending}
}
