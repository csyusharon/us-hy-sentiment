// 從 FRED 公開 CSV 端點抓單一 series。
// FRED 不需要 API key,但偶爾會回 5xx。呼叫端負責 retry/錯誤處理。

const FRED_MISSING_TOKEN = '.';

export function buildSeriesUrl(endpoint, seriesId, startDate) {
  const url = new URL(endpoint);
  url.searchParams.set('id', seriesId);
  url.searchParams.set('cosd', startDate);
  return url.toString();
}

export async function fetchSeriesCsv(endpoint, seriesId, startDate) {
  const url = buildSeriesUrl(endpoint, seriesId, startDate);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'hy-bond-dashboard/1.0' },
  });
  if (!res.ok) {
    throw new Error(`FRED fetch failed for ${seriesId}: HTTP ${res.status}`);
  }
  return await res.text();
}

// FRED CSV 格式:第一欄為日期(欄名歷年來變過,如 DATE / observation_date),
// 第二欄為 series ID。每列 2 欄,無 quote 跳脫。
// 缺值處理:文件上是 ".",但實測 FRED 對美國市場假日(聖誕、元旦、Good Friday、
// Memorial Day、Juneteenth、Labor Day…)會回 "0" 而非 "."。本專案目前使用的
// 15 個 series(HY OAS/分評等/殖利率、Treasury 殖利率、T10Y2Y、UNRATE、VIX、
// CPI/PCE 指數、實質 GDP)在合法觀測下都不會等於 0,因此一律當缺值丟掉。
// 若未來新增可能合法為 0 的 series,需要另外處理(例如改用 series-level 設定)。
export function parseSeriesCsv(csv, seriesId) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error(`FRED CSV for ${seriesId} has no data rows`);
  }
  const header = lines[0].split(',');
  if (header.length !== 2 || header[1] !== seriesId) {
    throw new Error(
      `FRED CSV header mismatch for ${seriesId}: got "${lines[0]}"`,
    );
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, rawValue] = lines[i].split(',');
    if (!date || rawValue === FRED_MISSING_TOKEN || rawValue === undefined) {
      continue;
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    if (value === 0) continue;
    rows.push({ date, value });
  }
  if (rows.length === 0) {
    throw new Error(`FRED series ${seriesId} returned no usable rows`);
  }
  return rows;
}
