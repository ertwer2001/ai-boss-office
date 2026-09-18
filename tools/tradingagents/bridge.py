"""Run pinned TradingAgents as a cancellable research subprocess, never an order executor."""
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

COMMIT = "2d17df8da1536c121e4d7395ac5a5dcec9e96d6f"


def main():
    request = json.load(sys.stdin)
    root = Path.cwd()
    config = request["config"]
    query = request["research"]
    for key in list(os.environ):
        if key.startswith("TRADINGAGENTS_"):
            del os.environ[key]
    os.environ["TRADINGAGENTS_RESULTS_DIR"] = str(root / "logs")
    os.environ["TRADINGAGENTS_CACHE_DIR"] = str(root / "cache")
    os.environ["TRADINGAGENTS_MEMORY_LOG_PATH"] = str(root / "memory.md")
    from budget import Budget
    from tradingagents.default_config import DEFAULT_CONFIG
    from tradingagents.graph.trading_graph import TradingAgentsGraph
    from tradingagents.dataflows.stockstats_utils import load_ohlcv
    import yfinance as yf
    yf.set_tz_cache_location(str(root / "cache" / "yfinance"))

    budget = Budget(query["maxCalls"])
    cfg = dict(DEFAULT_CONFIG)
    cfg.update(llm_provider=config["provider"], deep_think_llm=config["deepModel"],
               quick_think_llm=config["quickModel"], backend_url=config.get("backendUrl"),
               output_language="Traditional Chinese", max_debate_rounds=1,
               max_risk_discuss_rounds=1, max_recur_limit=80, checkpoint_enabled=False,
               llm_max_retries=0, max_tokens=4096,
               data_cache_dir=str(root / "cache"), results_dir=str(root / "logs"),
               memory_log_path=str(root / "memory.md"))
    if config.get("effort"):
        cfg["openai_reasoning_effort"] = config["effort"]
    graph = TradingAgentsGraph(selected_analysts=["market", "fundamentals", "news"], config=cfg, callbacks=[budget])
    state, signal = graph.propagate(query["ticker"], query["date"])
    market = load_ohlcv(query["ticker"], query["date"], fill_gaps=False).tail(240)
    bars = []
    for _, row in market.iterrows():
        values = [row.get(field) for field in ("Open", "High", "Low", "Close", "Volume")]
        if any(value is None or not math.isfinite(float(value)) for value in values):
            continue
        bars.append({"time": row["Date"].strftime("%Y-%m-%d"), "open": float(row["Open"]), "high": float(row["High"]), "low": float(row["Low"]), "close": float(row["Close"]), "volume": float(row["Volume"])})
    if len(bars) < 2:
        raise RuntimeError("Verified OHLCV has fewer than two complete rows; chart not produced")
    chart = {"vendor": "yfinance via TradingAgents", "requestedDate": query["date"], "latestTradingDate": bars[-1]["time"], "bars": bars}
    fields = ["market_report", "fundamentals_report", "news_report", "investment_plan", "trader_investment_plan", "final_trade_decision"]
    result = {"engine": "TradingAgents", "commit": COMMIT, "researchOnly": True,
              "ticker": query["ticker"], "analysisDate": query["date"],
              "retrievedAt": datetime.now(timezone.utc).isoformat(), "modelCalls": budget.calls, "modelConfig": config,
              "chart": chart,
              "signal": signal, "reports": {key: state.get(key, "") for key in fields},
              "toolEvidence": budget.tools,
              "limitations": ["研究模型的判斷不是已驗證報酬或交易指令。", "資料供應商回應的日期與完整性仍須逐項審查；分析日期不是所有來源均已更新的證明。", "歷史日期的新聞與財報可能缺少當時快照，不可據此宣稱無前視偏誤回測。"]}
    output = json.dumps(result, ensure_ascii=False, default=str)
    if len(output) > 100000:
        raise RuntimeError("Research evidence exceeds handoff limit; not silently truncated")
    (root / "result.json").write_text(output, encoding="utf-8")
    print(json.dumps({"event": "completed", "calls": budget.calls}), flush=True)


if __name__ == "__main__":
    main()
