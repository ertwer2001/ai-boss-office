# 第三方元件與授權

## TradingAgents 0.5.0

- 專案：https://github.com/TauricResearch/TradingAgents
- 固定來源 commit：`2d17df8da1536c121e4d7395ac5a5dcec9e96d6f`
- Apache-2.0 授權原文：[LICENSE](../tools/tradingagents/LICENSE)
- 上游原始碼不修改，透過獨立 Python bridge 呼叫。安裝於專案上一層 `runtime/tradingagents`；實際相依清單保存在 `installed-packages.txt`。
- 本 App 的 bridge、呼叫預算、停止控制和 Review 接線是本專案新增實作。研究來源與 LLM API 依各供應商條款，不因開源授權而免除模型費用。

## Docling 2.127.0

- 用途：在本機將 PDF、DOCX 轉成 Markdown，供主管派工與來源追蹤。
- 專案：<https://github.com/docling-project/docling>
- 程式授權：MIT（已安裝 wheel 的 `METADATA` 亦標示 `License-Expression: MIT`）。
- 本機套件清單：安裝後位於專案上一層的 `runtime/docling/installed-packages.txt`

## PDF 模型

| 模型 | 固定下載版本 | 授權標示 |
|---|---|---|
| `docling-project/docling-layout-heron` | `8f39ad3c0b4c58e9c2d2c84a38465abf757272d8` | Apache-2.0 |
| `docling-project/docling-layout-heron-onnx` | `40bde044036bb181c130ddf6c51792187268748f` | Apache-2.0 |
| `docling-project/docling-models`（TableFormer） | `fc0f2d45e2218ea24bce5045f58a389aed16dc23` | CDLA-Permissive-2.0 |

上述版本與授權標示保存在安裝後的 `runtime/docling/models` 各模型 `README.md` 及 Hugging Face cache tree 紀錄。這些元件由第三方依各自授權提供；本 App 不代替授權原文。

執行期固定使用已下載檔案，設定 `HF_HUB_OFFLINE=1`、`TRANSFORMERS_OFFLINE=1`、`enable_remote_services=false`、`allow_external_plugins=false`。文件解析不呼叫付費 API；之後真正派工給員工時，仍會使用使用者現有的 Codex 額度。
