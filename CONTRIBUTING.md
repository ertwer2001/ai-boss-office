# 參與貢獻

感謝你協助改善 AI Boss Office。

## 開發流程

1. Fork 專案並建立功能分支。
2. 使用 Node.js 24 執行 `npm ci`。
3. 完成修改後執行 `npm test` 與 `npm run build`。
4. Pull request 請說明問題、修改後行為、驗證方式及已知限制。

請勿提交 `data/`、`runtime/`、`員工成果/`、本機驗收資料、登入資訊、API key 或使用者附件。新增模型整合時，模型與推理強度必須來自即時 `model/list`，不要把可能變動的清單寫死。

## 問題回報

一般錯誤與功能建議可使用 GitHub Issues。安全問題請依 [SECURITY.md](SECURITY.md) 私下回報。
