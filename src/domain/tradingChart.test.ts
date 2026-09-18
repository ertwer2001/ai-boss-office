import {describe,expect,it} from 'vitest';
import {parseTradingEvidence} from './tradingChart';
const good=JSON.stringify({engine:'TradingAgents',ticker:'AAPL',analysisDate:'2026-01-05',retrievedAt:'2026-01-05T00:00:00Z',chart:{vendor:'yfinance',requestedDate:'2026-01-05',latestTradingDate:'2026-01-05',bars:[{time:'2026-01-02',open:10,high:12,low:9,close:11,volume:20},{time:'2026-01-05',open:11,high:13,low:10,close:12,volume:30}]},reports:{final_trade_decision:'研究結論'},limitations:['限制'],toolEvidence:[]});
describe('Trading research chart evidence',()=>{
 it('accepts only chronological OHLCV on or before the research date',()=>expect(parseTradingEvidence(good).chart.bars).toHaveLength(2));
 it('rejects future, duplicate, malformed and invented price ranges',()=>{for(const raw of [good.replace('2026-01-05","open', '2026-01-06","open'),good.replace('"high":12','"high":8'),good.replace('"volume":20','"volume":-1')])expect(()=>parseTradingEvidence(raw)).toThrow()});
});
