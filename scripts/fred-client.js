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
// 缺值處理:
//   1. "." → 文件上的缺值符,丟棄。
//   2. value === 0 → FRED 對美國市場假日(聖誕、元旦、Good Friday、Memorial Day、
//      Juneteenth、Labor Day…)會回 "0" 而非 ".";對日頻 yield/spread/price 而言
//      0 是 placeholder 不是真實觀測,預設一併丟掉。
//   3. 但有些指標(NFCI、STLFSI4、DRTSCILM)0 是合法的「中性」觀測,
//      呼叫端要傳 { allowZero: true } 才會保留。
export function parseSeriesCsv(csv, seriesId, { allowZero = false } = {}) {
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
    if (value === 0 && !allowZero) continue;
    rows.push({ date, value });
  }
  if (rows.length === 0) {
    throw new Error(`FRED series ${seriesId} returned no usable rows`);
  }
  return rows;
}
