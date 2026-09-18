import {useEffect,useRef,useState} from 'react';
import {CandlestickSeries,ColorType,HistogramSeries,createChart} from 'lightweight-charts';
import {api} from '../services/agentGateway';
import {DocumentView} from './DocumentView';
import {parseTradingEvidence,type TradingEvidence} from '../domain/tradingChart';
import type {Task} from '../domain/company';

function PriceChart({evidence}:{evidence:TradingEvidence}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const element=host.current;if(!element)return;
  const chart=createChart(element,{height:340,width:element.clientWidth,layout:{background:{type:ColorType.Solid,color:'transparent'},textColor:'#30463e',attributionLogo:true},grid:{vertLines:{color:'#d8e4dd'},horzLines:{color:'#d8e4dd'}},rightPriceScale:{borderColor:'#9bb3a5'},timeScale:{borderColor:'#9bb3a5'}});
  const candles=chart.addSeries(CandlestickSeries,{upColor:'#237e68',downColor:'#bf5b52',borderVisible:false,wickUpColor:'#237e68',wickDownColor:'#bf5b52'});
  const volumeSeries=chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume'});volumeSeries.priceScale().applyOptions({scaleMargins:{top:0.78,bottom:0}});
  candles.setData(evidence.chart.bars.map(({time,open,high,low,close})=>({time,open,high,low,close})));
  volumeSeries.setData(evidence.chart.bars.map(({time,close,open,volume:barVolume})=>({time,value:barVolume,color:close>=open?'rgba(35,126,104,.42)':'rgba(191,91,82,.42)'})));
  chart.timeScale().fitContent();const resize=()=>chart.applyOptions({width:element.clientWidth});const observer=new ResizeObserver(resize);observer.observe(element);return()=>{observer.disconnect();chart.remove()};
 },[evidence]);
 return <div className="trading-chart" ref={host}/>;
}

export function TradingResearchResult({task}:{task:Task}){
 const index=task.files.findIndex(file=>file.endsWith('/tradingagents-evidence.json'));
 const [evidence,setEvidence]=useState<TradingEvidence>(),[error,setError]=useState('');
 useEffect(()=>{let live=true;if(index<0)return;void api<{content:string}>(`/tasks/${task.id}/artifact/${index}`).then(r=>{if(live)setEvidence(parseTradingEvidence(r.content))}).catch(e=>{if(live)setError((e as Error).message)});return()=>{live=false}},[task.id,index]);
 if(index<0)return task.research?<p className="note">TradingAgents 原始研究會在主管整案 PASS 後，連同圖表與可下載證據一起開放。</p>:null;
 if(error)return <div className="error">研究圖表無法顯示：{error}</div>;
 if(!evidence)return <p className="exp">正在載入已核對的市場圖表…</p>;
 const conclusion=evidence.reports.final_trade_decision||evidence.reports.investment_plan||'上游未提供可顯示的結論。';
 return <section className="trading-result"><h3>研究圖表與資料依據</h3><p className="exp">{evidence.ticker} · 研究截止 {evidence.analysisDate} · 最後交易資料 {evidence.chart.latestTradingDate} · {evidence.chart.bars.length} 根 K 線</p><PriceChart evidence={evidence}/><p className="attribution">圖表由 <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a> Lightweight Charts™ 呈現。</p><div className="check"><strong>上游模型觀點</strong><DocumentView text={conclusion}/></div><details><summary>資料來源、限制與研究內容</summary><p>OHLCV 資料：{evidence.chart.vendor}；請求截止日：{evidence.chart.requestedDate}。圖表只呈現上游實際回傳且不晚於截止日的資料。</p><DocumentView text={Object.entries(evidence.reports).filter(([key])=>key!=='final_trade_decision').map(([key,value])=>`## ${key}\n\n${value}`).join('\n\n')}/><h4>限制</h4><ul>{evidence.limitations.map((x,i)=><li key={i}>{x}</li>)}</ul><p>原始資料可在下方正式交付檔案下載，並以 SHA-256 校驗。</p></details></section>;
}
