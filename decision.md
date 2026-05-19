# 架構決策紀錄 (Architectural Decisions)

依時間倒序排列(新的在上)。每筆格式:Context → Options → Decision → Why。

## 2026-05-19 — parseSeriesCsv 加入 allow_zero per-series 設定

**Context:** 初版時 `parseSeriesCsv` 一律把 `value === 0` 視為缺值丟棄,因為 FRED 對美國市場假日(聖誕、元旦、Good Friday、Memorial Day、Juneteenth、Labor Day…)會回 `0` 而非文件上講的 `.`,15 個原有 series(HY OAS、Treasury yields、VIX、UNRATE、CPI/PCE/GDP)在合法觀測下都不會等於 0,丟棄無副作用。但新增 NFCI(金融條件)、STLFSI4(金融壓力)、DRTSCILM(銀行緊縮意願)後,**0 是合法的「中性」值**,丟棄會丟掉真實資訊。

**Options considered:**
1. 一律保留 0,改用 `.` 作為唯一缺值符號 — 但 FRED 的假日 placeholder 0 會變成真實 0 進圖。
2. 每個 series 寫死特例邏輯在 `parseSeriesCsv` 內 — schema 與邏輯耦合,難維護。
3. **Series-level config flag `allow_zero`,parser 接受 `{ allowZero }` option。**

**Decision:** 採選項 3。`config/series.json` 每個 series 可選填 `allow_zero: true`(預設 false),`scripts/fetch-data.js` 把這個值傳進 `parseSeriesCsv`。

**Why:** 兩種 0 的語意根本不同 —「FRED 假日 placeholder」與「真實中性觀測」 — 需要顯式區分,但區分的知識屬於 series 設定(資料層),不屬於 parser 邏輯(處理層)。Flag 放在 config 讓未來新增 series 時可以直接宣告,parser 保持純函數。預設 false 維持現行行為,避免回頭修補既有 15 個 series 的設定。
