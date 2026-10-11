# tw-stock-snap

[tw-stock-qa](https://tw-stock-qa.pages.dev) 的公開市場資料快照。內容全是網站上本來就公開的市場資料，沒有程式碼以外的任何東西、沒有金鑰。

- 只收可再散布的資料：證交所／櫃買中心／公開資訊觀測站／國發會的政府開放資料、美國勞工統計局與聯準會的公共資料，以及 tw-stock-qa 自行計算的結果。Yahoo、ICE、新聞標題等有授權限制的資料不放這裡。
- 每個 `snap/*.json` 都由 tw-stock-qa 後端用私鑰（只存在 Cloudflare）簽章；網站前端用內建公鑰驗章，驗不過或太舊就丟棄、改讀後端。
- 排程：`.github/workflows/snap.yml`（只讀權限＋Pages 發布）；`keepalive.yml` 每月一次避免排程被停用。
- 產生器 `build-snapshots.mjs` 只用 Node 內建模組。

本 repo 的檔案由 tw-stock-qa 主 repo 的 `snap-repo/` 資料夾同步而來，請在那邊修改。
