import {useState} from 'react';
import {DocumentView} from './DocumentView';
import {TradingResearchResult} from './TradingChart';
import {api} from '../services/agentGateway';
import {labels,type Task} from '../domain/company';

export function TaskDetail({task,onAction}:{task:Task;onAction:(action:string,feedback?:string,input?:string)=>Promise<void>}){
 const [feedback,setFeedback]=useState(''),[input,setInput]=useState(''),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(action:string){setBusy(true);setError('');try{await onAction(action,feedback,input)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <>
  <div className="sub">{task.projectId&&task.state==='approve'?'待主管審查':labels[task.state]} · {task.model} · {task.effort}</div>
  <p>{task.stage}</p>
  {task.assignment&&<p className="exp">派工角色：{task.assignment.profile?`${task.assignment.profile.name} · v${task.assignment.profile.version}`:'沿用職位說明'} · {task.assignment.name}</p>}
  {task.error&&<div className="error">{task.error}</div>}
  <DocumentView text={task.result||'尚未完成，主管正在處理。'}/>
  <TradingResearchResult task={task}/>
  {task.checks?.map((c,i)=><div className="check" key={i}>{c.passed?'通過':'未通過'} · {c.name}<pre>{c.output}</pre></div>)}
  {task.projectId&&<section className="review-history"><h3>主管 Review 紀錄</h3>{task.reviews?.length?task.reviews.map((r,i)=><div className="check" key={i}><strong>{r.verdict==='pass'?'PASS／OK':r.verdict==='fail'?'FAIL／NG':'重大決策'}</strong><p>{r.reason}</p>{r.evidence.map((e,j)=><div key={j}>{e.passed?'✓':'✕'} {e.criterion}<small>{e.evidence}</small></div>)}{r.guidance&&<p>主管修正方向：{r.guidance}</p>}</div>):<p className="exp">尚未完成主管審查。員工遇到問題會先請示主管。</p>}</section>}
  <h3>正式交付檔案</h3>
  {task.projectId&&!task.files.length&&<p className="note">尚未通過整案驗收，內部草稿不開放為正式成果。上方摘要僅供查看工作進度。</p>}
  {task.files.map((f,i)=><div className="file-row" key={f}><span>{f.split('/')[0]} / {f.split('/').at(-1)}</span><button className="btn small" onClick={async()=>{try{setPreview((await api<{content:string}>(`/tasks/${task.id}/artifact/${i}`)).content)}catch(e){setError((e as Error).message)}}}>預覽文字</button><a className="btn small" href={`/api/download/${task.id}/${i}`}>下載</a></div>)}
  {preview&&<DocumentView text={preview}/>}
  {task.external&&<p className="note">此任務只交付草稿。驗收會留下老闆紀錄；對外發布服務尚未接入。</p>}
  {!task.projectId&&['blocked','approve','cancelled'].includes(task.state)&&<><label className="field">修改意見<textarea value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="指出需要修改的內容"/></label><label className="field">補充文字或 CSV 資料<textarea value={input} onChange={e=>setInput(e.target.value)}/></label><div className="actions">{task.state==='approve'&&<button disabled={busy} className="btn primary" onClick={()=>act('accept')}>驗收草稿</button>}<button disabled={busy} className="btn" onClick={()=>act('retry')}>{task.state==='approve'?'退回修改':'補充後重試'}</button></div></>}
  {!['done','cancelled'].includes(task.state)&&<button className="btn" onClick={()=>act('cancel')}>停止／休息（含後續接力）</button>}
  {error&&<div className="error">{error}</div>}
  <details><summary>來源與檔案校驗</summary>{task.sources.map((s,i)=><pre className="source" key={i}>{s.kind} · {s.ref}{s.sha256?'\nSHA-256 '+s.sha256:''}{'\n'+s.at}</pre>)}</details>
  <details><summary>工作紀錄</summary><pre className="screen">{task.logs.map(l=>`${new Date(l.at).toLocaleTimeString('zh-TW')} ${l.text}`).join('\n')||'等待執行'}</pre></details>
  {task.usage&&<div className="sub">累計輸入 {task.usage.input_tokens.toLocaleString()} tokens · 輸出 {task.usage.output_tokens.toLocaleString()} tokens</div>}
 </>;
}
