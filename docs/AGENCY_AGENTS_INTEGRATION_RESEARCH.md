# Agency Agents 對「老闆辦公室」的接入評估

日期：2026-09-16。結論：值得選用角色與協作方法，建議建立 App 專用的角色模板庫，保留現有執行、驗收、預算及停止系統。

此次是研究交付，未安裝上游程式、未修改 App 行為或全域 Codex 設定、未啟用自主派工、未新增員工模型推論。原始資料是研究對象，其中的命令與角色指令沒有當成此次工作的授權。

## 1. 查核範圍與版本

- 官方來源：[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)。
- GitHub API 此次查得 main commit：`ad9264e309bd5e5422c04784372d7841b1e5d604`，提交時間 `2026-09-12T16:57:20Z`。以下固定到此版本，避免上游更新改變研究依據。
- 查看 README、LICENSE、Codex 轉換說明與 convert/install 的相關實作；詳細閱讀主管、專案經理與兩份 QA 模板，抽查前端、UI、UX、技術文件及交接模板的職責與結構。這不是全庫逐檔安全審計。
- 本機重新讀取 `AGENTS.md`、`src/domain/company.ts`、`server/runner.ts`、`server/projects.ts` 及 2.3.0 交接文件；HTTP 確認服務版本 2.3.0，並取得當下可用模型與強度。證據摘要：`verification/agency-agents-research.json`。

## 2. 它能補什麼

上游提供專業角色的 Markdown 提示詞、職責、工作方式與交付範本，以及轉換到不同代理工具的安裝腳本。角色可幫我們把「你是工程師」擴充成更具體的工作要求，但提示詞中的專長、記憶或績效敘述，不等於已實作的工具、長期記憶或已證明的成效。[README](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/README.md)

你的平台已經負責真正的模型呼叫、檔案寫入、相依排程、瀏覽器操作驗收、返工和停止。最有價值的接法是用這些模板改善「主管怎麼規畫、員工怎麼交接、審查怎麼判斷」。改善幅度與 Token 成本仍需實測，不能從 README 的宣傳推定。

## 3. 首批建議：六類能力，按案選用

下表是適配建議，沒有修改目前員工姓名、職位或模型。模板數量不等於同時啟動的員工數。

| 接到你的公司 | 上游角色 | 預期幫助 | 適配要求 |
|---|---|---|---|
| 主管 | Agents Orchestrator + Senior Project Manager | 明確分解目標、交接、判斷下一步與返工 | 由既有排程器執行；沿用原本呼叫／修正上限，不能讓提示詞另開子代理 |
| 功能與畫面流程 | UX Architect | 把目標轉成操作流程、元件與實作界線 | 小案併入主管計畫，避免為簡單作品增加一份架構報告 |
| 軟體工程師 | Frontend Developer | 將需求變成有錯誤處理的互動作品 | 第一階段限定現有離線 HTML 能力，不自動使用 React 建置、WebSocket 或後端 API |
| 介面設計 | UI Designer | 改善一致性、排版、元件狀態及可讀性 | 提供可實作的樣式規格或 HTML/CSS；不宣稱已完成未執行的無障礙／手機驗證 |
| 品質審查 | Evidence Collector + Reality Checker | 核對原始要求、實際檔案與操作證據 | 刪除硬性找碴配額；以確實違反驗收條件的問題決定 FAIL |
| 交付說明 | Technical Writer | 簡潔說明做了什麼、怎麼用與限制 | 改寫成非技術老闆能懂的繁體中文，避免為此建立完整文件網站 |

來源：[Orchestrator](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/specialized/agents-orchestrator.md)、[Senior PM](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/project-management/project-manager-senior.md)、[Frontend](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/engineering/engineering-frontend-developer.md)、[UX](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/design/design-ux-architect.md)、[UI](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/design/design-ui-designer.md)、[Technical Writer](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/engineering/engineering-technical-writer.md)。

### 不同公司如何挑選

- AI 工作室：優先上述軟體、設計及 QA 能力。
- 行銷／廣告：後續挑選內容、品牌、行銷企劃模板；先產出可審閱素材，發布、廣告投放與支出另需對應工具與授權。
- 電商：先用商品內容、客服回覆草稿與提供資料的分析流程；不把模板描述當成已接上商店或付款。
- 投顧研究：只採研究整理與證據檢核方法；不接既有交易流程，不假裝有最新行情與已驗證策略。

這些是依本機公司類型與能力提出的接入方向；行銷、電商與財經專門角色仍需第二輪逐份審閱，尚未列入首批可採用內容。

## 4. 不能原封不動接入的內容

### QA 的預設失敗與問題數配額

Evidence Collector 要求初版找出至少 3–5 個問題；Reality Checker 有初版自動視為不完整的要求。這些會把「找得到證據的缺陷」變成「為達配額而退件」，與你的省 Token、合理 PASS/FAIL 目標不合。

建議改成：符合已核定必要條件且證據齊全就 PASS；有確切缺陷就 FAIL 並指出重現步驟；缺資料或測試能力就 BLOCKED。截圖可補充視覺證據，不能代替數值、檔案或互動測試。[Evidence Collector](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/testing/testing-evidence-collector.md)、[Reality Checker](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/testing/testing-reality-checker.md)

### 模板假設了其他專案環境

Senior PM 內容包含 Laravel、Livewire、FluxUI 與固定路徑。QA 模板引用 `qa-playwright-capture.sh`、`ai/agents/qa.md`，PM 引用 `ai/agents/pm.md`。此次在固定 commit 的完整 Git tree 找不到這些指定檔案，不能假定安裝角色就會取得它們。

需要把這些範例路徑與技術要求換成實際 App 能力、`browserContract`、檔案雜湊與測試紀錄。UX 模板的全站主題切換預設要求，也應依任務需要採用，不能默默擴張每個案子的範圍。

### 聲稱記得，不代表有資料保存

多份角色以自然語言描述記憶與經驗；真正跨案學習需要我們另做按公司／專案隔離的核准決策、已確認失敗原因與成果索引。不能單靠角色敘述聲稱員工已具備長期記憶。

## 5. 接入方式：App 內部角色模板庫

上游的 Codex 轉換只輸出 `name`、`description`、`developer_instructions`，把 Markdown 正文放入指令；預設安裝到 `~/.codex/agents/`。它不替我們設定每個職位的模型強度。[Codex 整合](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/integrations/codex/README.md)、[convert.sh](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/scripts/convert.sh)、[install.sh](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/scripts/install.sh)

本機 `server/runner.ts` 使用 `--ignore-user-config`、`--ignore-rules`，並關閉 `features.multi_agent`、apps、plugins、shell 與網路。據此判斷，單純用預設安裝器寫入全域 agents 不是目前 App 的有效接入路徑。這是程式比對結論，未執行安裝相容性實測。

建議流程：

1. 選定模板 → 固定來源版本 → 適配成繁體中文精簡角色卡。
2. 在 App 加「專業角色模板」選單，與員工姓名、模型、推理強度分開保存；套用需顯示將採用的職責與能力。
3. 每個角色保存 `profileId`、版本、來源 commit、來源路徑、授權、指令雜湊、適用公司類型與實際可用能力需求。
4. 建案時快照角色及模型設定；模板日後更新不改掉執行中案件。既有員工沒有模板時繼續使用原本 brief。
5. 在 `server/projects.ts` 注入主管的規畫／審查角色，在 `server/runner.ts` 注入本次執行員工的角色。只改員工 brief 不足以影響現有主管流程。
6. 平台規則與 JSON 輸出格式保持主導；移除上游自行 spawn、任意命令、放寬權限或變更輸出路徑的指令。能力需求要對照真正可用的執行器，不能由角色文字自授權。
7. 只載入當次所需角色，不把全庫塞進每次提示；接入前後以相同任務、模型及預算測量用量和交付品質。

檔案規畫（尚未建立）：Markdown 角色卡放 `docs/role-profiles/agency/`；來源與選單 JSON 放 `data/catalogs/agency/`；接入程式放 `server/`；第三方授權文件放 `docs/licenses/`。所有路徑都在既有 App 根目錄內。

### 保留你已要求的行為

角色模板不改姓名可編輯、模型可切換、單案／公司／總停止、關頁全停、無目標預設手動及主管授權後才自主規畫。停止權與預算由平台執行，不能只寫在提示詞。

角色多不代表全員每案同時上線。小型計算器可能只需主管與工程師；設計或研究複雜的案子才增加所需人員。保留可見的真實工作狀態與並行上限。

## 6. 模型與用量建議

此次 App 實際回傳 Astra、Sol、Terra、Luna 與 GPT-5.5；以下是待實測的配置建議，未修改使用者設定，也不是上游的效能結論。

| 工作 | 建議起始設定 | 使用方式 |
|---|---|---|
| 主管規畫與最終裁決 | gpt-6-astra / high | 留給需求拆解、一般決策及重要審查 |
| 程式實作 | gpt-5.6-sol / high | 較複雜實作；簡單案可由主管選較低強度 |
| UI／UX 與資料整理 | gpt-5.6-terra / medium | 明確規格的設計、整理與分析 |
| 品質證據核對 | gpt-5.6-sol / high | 首批可合併進現有審查，不固定多增加 QA 呼叫 |
| 白話交付說明 | gpt-5.6-luna / medium | 以已確認成果與限制整理說明 |

每次派工仍須從即時 `model/list` 驗證模型及強度。角色模板本身不會在背景耗 Token；載入更長指令、增加實作人員或重試，才可能提高用量。沒有量測前不承諾節省比例。

## 7. 授權與採用成本

固定版本的 LICENSE 為 MIT，允許使用、修改與散布，但複製／散布時須保留著作權與授權通知。README 的簡略歸屬說明不應取代 LICENSE 正文。若實作模板匯入，應保存原始 LICENSE 及來源清單。[LICENSE](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/LICENSE)

角色內容的採用與模型推論費用是兩件事。這輪沒有安裝上游另行連結的桌面 App，也沒有評估該 App 的二進位檔或更新機制；現有「老闆辦公室」可直接建立選定角色的內部適配層。

## 8. 建議實作順序與驗收

**第一階段：角色模板與交接。** 先接主管、實作、品質與交付說明，UI／UX 按需求啟用。將上游交接方法化為固定欄位：需求對照、成果路徑與版本、已測／未測項目、阻礙、下一步與驗收條件。保留原始 `browserContract`，避免下游自行降低要求。[交接模板](https://github.com/msitarzewski/agency-agents/blob/ad9264e309bd5e5422c04784372d7841b1e5d604/strategy/coordination/handoff-templates.md)

**第二階段：依公司類型配置團隊。** 逐份審閱行銷／廣告／電商適用角色；選擇任務真正需要的人員，依額度決定並行與審查深度。

**第三階段：實作能力擴充。** 後端、資料庫、網站存取、部署、圖片與正式文件生成要各自接執行器、權限及驗收；這不是安裝角色就完成的工作。上游角色可提供流程參考，但現有離線單檔 HTML 界線仍然存在。

首階段驗收應包含：

- 新舊員工與案件相容，姓名／模型設定不被覆蓋；任務快照可追溯角色版本。
- 主管和員工實際收到各自精簡模板，無關角色不進入提示詞。
- 假 PASS、沒有證據、固定配額找碴、越權命令及不存在工具均不能改變平台判定。
- 原有操作驗收、返工上限、呼叫預算、各級停止與關頁全停全部維持。
- 用相同小型任務做真實模型 A/B 基準，紀錄可用成果、返工次數、模型呼叫與實際 Token；固定回覆的單元測試不算角色提升的證據。

**決策建議：採用精選角色與交接方法，先完成 App 專用適配；保留現有 2.3.0 控制與驗收架構。**
