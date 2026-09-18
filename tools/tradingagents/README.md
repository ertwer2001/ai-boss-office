# TradingAgents 研究引擎

此整合實際呼叫 TauricResearch/TradingAgents 的 Python graph，再交由辦公室 Codex 員工整理及主管 Review。上游固定 commit `2d17df8da1536c121e4d7395ac5a5dcec9e96d6f`（0.5.0），Apache-2.0；沒有券商或下單介面。

## 安裝與模型設定

1. 執行 `powershell -ExecutionPolicy Bypass -File tools/tradingagents/install.ps1`。環境只安裝於專案上一層 `runtime/tradingagents`，不變更全域 Python。
2. 複製 `config.example.json` 到 `data/tradingagents.local.json`，填入模型設定。該設定不進 Git，不接受 API key 欄位。
3. `provider=openai` 需要服務程序環境的 `OPENAI_API_KEY`，由使用者在本機管理，勿貼到聊天室或提交 Git。Codex 訂閱登入不能直接替代它。
4. `provider=ollama` 或 `openai_compatible` 要填 `backendUrl` 與該服務實際支援工具呼叫及結構化輸出的模型名稱。遠端端點須 HTTPS；本機可 HTTP。這些模型不是 Codex `model/list`。
5. 啟動辦公室，選投顧研究公司 → 指令框下方「TradingAgents 投資研究室」→ 重新檢查設定。恢復手動工作後指定代碼、截止日期和問題，按開始研究。

「已設定」僅代表安裝及設定檢查通過，不代表模型服務已實測。模型/API 費用依供應商；目前整合不提供金額精準估算。

## 執行與停止

上游最多 8–40 次呼叫（預設 20）、每次最多 4096 輸出 tokens、一輪多空與風控辯論、無 SDK 自動重試、15 分鐘逾時。LangChain callback 在送出前限制呼叫；不同模型是否接受 token 參數仍取決於供應商。Codex 整理及 Review 另限 12 次。關頁、全停、公司停、專案停共用平台擁有程序樹管理；已送到供應商的請求停止後仍可能計費。

研究失敗不自動再次花 API 預算；重新研究要由使用者手動新開案。成功後的返工重用同一份 SHA-256 原始證據，不重新查詢。原始 JSON 隨員工草稿交主管審查，只有整案 PASS 才可正式下載。正式成果沿用文件／資料等分類。

資料來自上游工具與供應商，保留實際工具回應與取得時間。模型報告不是來源證據。截止日期不保證所有來源均更新，也不能當作歷史無前視偏誤回測證明。第一版採人工指定日期；尚未接入台股 App 的最新交易日判斷或官方資料流程。

## 驗證範圍

預設測試不呼叫付費模型或宣稱完成實際選股。真實研究須設定模型後由使用者手動開始。
