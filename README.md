# 美國高收益債市場氛圍儀表板

純靜態網站,部署於 GitHub Pages,由 GitHub Actions 每日自動拉取 FRED 資料更新。

- **資料源**: FRED 公開 CSV 端點(無需 API key)
- **更新頻率**: 每日一次,排程於 UTC 22:00 ≈ Asia/Taipei 06:00 翌日
- **看板** (21 個指標):
  - **主指標**: 整體 HY OAS 利差(互動式圖,可拖曳放大、滑鼠檢視精確值、1M/3M/6M/1Y/3Y 切換)
  - **HY 分評等利差**: BB / B / CCC
  - **HY 殖利率**: 有效殖利率、最差殖利率
  - **信用條件與市場壓力**: IG 投資級 OAS(對照)、NFCI 金融條件指數、STLFSI4 金融壓力指數、DRTSCILM 銀行 C&I 緊縮意願(違約率領先指標代理)
  - **利率與殖利率曲線**: 聯邦資金利率、10Y 公債、2Y 公債、10Y−2Y 利差、10Y−3M 利差
  - **通膨**: CPI 年增、Core PCE 年增
  - **經濟成長**: 失業率、實質 GDP 季增年化
  - **市場風險情緒與商品**: VIX、WTI 原油
- **第三方資源**: 互動圖表用 [lightweight-charts](https://www.tradingview.com/lightweight-charts/) (TradingView 開源,Apache 2.0),從 jsDelivr CDN 載入,無 build step

---

## 目錄結構

```
.
├── index.html              前端入口
├── data.json               每日由 Actions 寫入(初次部署前可能不存在)
├── config/
│   └── series.json         FRED series 清單與抓取參數(共用 config)
├── scripts/
│   ├── fetch-data.js       主抓取腳本(Node.js,零外部依賴)
│   ├── fred-client.js      FRED CSV 下載與解析
│   ├── series-stats.js     計算 latest / previous / min / max / percentile
│   └── preview-server.js   本機預覽用迷你 HTTP server
├── web/
│   ├── app.js              前端 bootstrap + 卡片渲染
│   ├── charts.js           純 SVG sparkline 與 range bar
│   ├── sentiment.js        氛圍判讀文字生成
│   ├── config.js           前端 UI 參數
│   └── style.css           終端機風格樣式
├── .github/workflows/
│   └── update.yml          每日排程 workflow
├── package.json
└── README.md
```

---

## 一、本機預覽

需求:**Node.js 20+**(用內建 `fetch` 與 ESM,無 npm 依賴)。

```bash
# 1. 抓一次 FRED 資料(產生 data.json)
npm run fetch

# 2. 啟動預覽 server
npm run preview
# 開瀏覽器到 http://localhost:8080
```

> 為什麼不能直接點開 `index.html`?
> 因為 `file://` 協定下瀏覽器禁止 ES module 與 `fetch('data.json')`。

## 二、首次部署到 GitHub Pages

### 1. 推到 GitHub

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo-name>.git
git push -u origin main
```

### 2. 開啟 GitHub Pages

進到 repo 的 **Settings → Pages**:

- **Source**: 選 `Deploy from a branch`
- **Branch**: 選 `main`,資料夾選 `/ (root)`
- 點 **Save**

幾十秒後 GitHub 會給你網址(`https://<帳號>.github.io/<repo>/`)。

### 3. 確認 Actions 有 commit 權限

進到 repo 的 **Settings → Actions → General → Workflow permissions**:

- 勾選 **Read and write permissions**(否則 workflow 無法把 `data.json` commit 回 repo)
- 儲存

> 已在 workflow 內宣告 `permissions: contents: write`,但 repo 層級的設定若未開放,單一 workflow 的宣告也會被擋下。

### 4. 手動觸發第一次更新

進到 repo 的 **Actions** 分頁:

- 左側選 `update-data` workflow
- 右上角點 **Run workflow** → 選 `main` → **Run workflow**

成功後 repo 會多一筆 `data: daily update YYYY-MM-DD` commit,Pages 隨後會自動 rebuild,網址即可看到資料。

---

## 三、排程行為

| 項目 | 設定 |
|---|---|
| 觸發 | `cron: '0 22 * * *'`(UTC)+ `workflow_dispatch`(手動) |
| 對應時區 | Asia/Taipei 06:00 翌日 |
| commit 作者 | `github-actions[bot]` |
| 變動為零時 | 跳過 commit(避免無意義版本紀錄) |
| Concurrency | 同名 workflow 不會並行,但不會 cancel 在跑中的 |

> **不掛 `on: push` 的原因**:Actions 自己 commit `data.json` 後若觸發 push 事件,會引起遞迴執行。改由 GitHub Pages 自己偵測 `main` 更新即可。

---

## 四、調整資料來源

要加新 series、改 lookback 年數,改 `config/series.json`:

```jsonc
{
  "lookback_years": 3,               // 抓近 N 年
  "missing_value_policy": "drop",    // FRED 缺值 "." 的處理
  "fred_csv_endpoint": "https://fred.stlouisfed.org/graph/fredgraph.csv",
  "series": [
    {
      "id": "BAMLH0A0HYM2",
      "label": "整體 OAS 利差",
      "label_en": "ICE BofA US HY OAS",
      "category": "main",            // main | rating | yield | credit | rates | inflation | growth | risk
      "unit": "percent",             // percent → 加 % 後綴、delta 顯示為 bp;level → 不加後綴、delta 為 pt
      "transform": "yoy_pct",        // (可選)目前只有 yoy_pct:把指數轉年增率
      "allow_zero": false            // (可選)預設 false,值=0 視為 FRED 假日 placeholder 丟棄
                                     // NFCI/STLFSI4/DRTSCILM 等指數型,0 是合法中性值,需設 true
    }
  ]
}
```

`category` 決定它出現在哪一區塊。對照 `sections` 設定:主指標 / 分評等 / 殖利率 / 信用條件 / 利率與曲線 / 通膨 / 成長 / 風險情緒。

---

## 五、本頁「沒有涵蓋」的指標

以下幾項在投資判讀上重要,但 FRED 沒有公開資料源,本頁刻意不放,避免錯誤暗示:

| 項目 | 為何沒做 | 可參考的替代 |
|---|---|---|
| 違約率 / 預期違約機率 (PD) / 回收率 | FRED 沒有 Moody's/S&P 月報資料;PDF/付費 feed | **Proxy 1(最強)**: 儀表板「信用條件」區的 **DRTSCILM**(銀行 C&I 緊縮意願),歷史上領先違約率上升約 2-4 季。**Proxy 2**: CCC OAS 與 BB→CCC 利差擴散度。 |
| 跌落天使 (Fallen Angels)、不良交換 (Distressed Exchange) | 事件型資料,需要 issuer-level feed(Bloomberg / S&P CapIQ) | 商業終端機;或手動追蹤 |
| 高收益債資金流向 (Fund Flows) | FRED 沒有;資料源是 ICI / EPFR / ETF.com(多為付費) | EPFR 月度報告;或 HYG/JNK ETF 的 AUM 變動 |
| HY 整體存續期間 (Duration) | 沒有單一可觀測指標 | 產業共識值約 **3-4 年**(美元 HY 指數約 3.2-3.8 年)。對利率敏感度的判讀:HY OAS 對利率變動的反應遠小於投資等級債,因利差波動本身遠大於同期利率變動 |

如果你想把這些補上,做法是新增另一條 ingestion pipeline(從付費 API 或 PDF parser),寫進 `data.json` 同一份檔案,前端會自動顯示。

---

## 六、設計決策摘要

| 決策 | 理由 |
|---|---|
| Node.js 而非 Python | 與前端同語言、Actions 內建、零外部依賴 |
| 主指標用 lightweight-charts,其他用純 SVG | 主指標需要拖曳放大/crosshair 等互動,自製不划算;其他卡只是 glance,SVG 夠 |
| 抓取放後端 | 避開 FRED 對瀏覽器的 CORS;前端只讀同源 `data.json` |
| Pages 用 branch deploy | 不寫第二個 deploy workflow,降低設定複雜度 |
| 後端算好 stats 寫進 data.json | 避免前端重算,單一資料真實源 |
| 缺值 drop | FRED 週末/假日值為 `.`,丟棄即可,符合慣例 |
| 利差走闊紅、收窄綠 | 與信用市場慣例一致(spread 上升 = 風險升高) |

---

## 七、免責

本專案僅整理公開資料,**不構成投資建議**。使用者應自行判斷資料正確性與投資風險。
FRED 與 ICE BofA 指數資料著作權歸原始提供者所有,本專案以一般使用條款引用。
