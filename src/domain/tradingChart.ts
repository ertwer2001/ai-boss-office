export type TradingBar={time:string;open:number;high:number;low:number;close:number;volume:number};
export type TradingChart={vendor:string;requestedDate:string;latestTradingDate:string;bars:TradingBar[]};
export type TradingEvidence={engine:'TradingAgents';ticker:string;analysisDate:string;retrievedAt:string;chart:TradingChart;reports:Record<string,string>;limitations:string[];toolEvidence:unknown[]};
const date=/^\d{4}-\d{2}-\d{2}$/;
const validDate=(value:string)=>date.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
export function parseTradingEvidence(raw:string):TradingEvidence{
 const value=JSON.parse(raw) as Partial<TradingEvidence>;
 if(value.engine!=='TradingAgents'||typeof value.ticker!=='string'||!validDate(value.analysisDate||'')||!value.chart||!Array.isArray(value.chart.bars))throw new Error('TradingAgents 研究證據格式不正確');
 const chart=value.chart;
 if(typeof chart.vendor!=='string'||!validDate(chart.requestedDate)||!validDate(chart.latestTradingDate)||chart.requestedDate!==value.analysisDate||chart.latestTradingDate>chart.requestedDate||chart.bars.length<2||chart.bars.length>260)throw new Error('研究圖表的日期或資料範圍不正確');
 let previous='';for(const bar of chart.bars){if(!validDate(bar.time)||bar.time>chart.requestedDate||bar.time<=previous||![bar.open,bar.high,bar.low,bar.close,bar.volume].every(finite)||bar.high<Math.max(bar.open,bar.close)||bar.low>Math.min(bar.open,bar.close)||bar.volume<0)throw new Error('研究圖表含有無效 OHLCV 資料');previous=bar.time}
 if(chart.latestTradingDate!==previous)throw new Error('研究圖表的最後交易日期不符');
 if(!value.reports||typeof value.reports!=='object'||Array.isArray(value.reports)||!Array.isArray(value.limitations)||!Array.isArray(value.toolEvidence))throw new Error('研究報告證據不完整');
 return value as TradingEvidence;
}
