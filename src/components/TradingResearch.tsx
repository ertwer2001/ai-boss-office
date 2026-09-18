import {useEffect,useState} from 'react';
import {api} from '../services/agentGateway';

export function TradingResearch({companyId,refresh}:{companyId:string;refresh:()=>Promise<void>}){
 const [status,setStatus]=useState<{ready:boolean;message:string;deepModel?:string;quickModel?:string}>();
 const [ticker,setTicker]=useState(''),[date,setDate]=useState('');
 const [question,setQuestion]=useState('分析基本面、新聞與風險，說明支持及反對的證據，交付白話研究報告。');
 const [maxCalls,setMaxCalls]=useState(20),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function check(){try{setStatus(await api('/tradingagents/status'))}catch(e){setMessage((e as Error).message)}}
 async function start(){
  setBusy(true);
  try{await api(`/companies/${companyId}/trading-research`,'POST',{ticker,date,question,maxCalls});await refresh();setMessage('研究已排入專案；完成主管審查後可開啟成果。')}
  catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 useEffect(()=>{void check()},[]);
 return <details className="card">
  <summary>TradingAgents 投資研究室 · 手動開案</summary>
  <p>基本面、新聞、技術研究 → 多空辯論與風控 → 辦公室員工整理 → 主管 Review。</p>
  <p role="status">{status?.message||'正在檢查研究環境…'}{status?.ready&&`；深入模型 ${status.deepModel}／快速模型 ${status.quickModel}`}</p>
  <button type="button" className="btn small" onClick={()=>void check()}>重新檢查設定</button>
  <p className="exp">上游研究使用獨立模型 API／本機模型；Codex 負責整理與審查。API 可能另外收費。每案最多 {maxCalls} 次上游呼叫，每次最多 4,096 輸出 tokens、辯論 1 輪；辦公室另有 12 次呼叫上限。這不是金額上限。</p>
  <label className="field">標的代碼<input aria-label="研究標的代碼" value={ticker} maxLength={25} onChange={e=>setTicker(e.target.value)} placeholder="例如 AAPL；請確認市場代碼"/></label>
  <label className="field">研究截止日期<input aria-label="研究截止日期" type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)}/></label>
  <label className="field">研究問題<textarea aria-label="研究問題" maxLength={2000} value={question} onChange={e=>setQuestion(e.target.value)}/></label>
  <label className="field">上游模型呼叫上限<input aria-label="上游模型呼叫上限" type="number" min={8} max={40} value={maxCalls} onChange={e=>setMaxCalls(Number(e.target.value))}/></label>
  <p className="exp">請先恢復辦公室手動工作。關閉頁面、案件停止與總停止都會終止研究程序；已送出的模型請求仍可能計費。來源缺漏會列入報告，不會視為已查證；本功能不下單。</p>
  <button type="button" className="btn primary" disabled={busy||!status?.ready||!ticker.trim()||!date||!question.trim()} onClick={()=>void start()}>開始研究並交主管審查</button>
  <p role="status">{message}</p>
 </details>;
}
