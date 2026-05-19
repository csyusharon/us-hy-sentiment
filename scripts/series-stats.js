// 在抓到的 series 上計算前端需要的衍生數值。
// 放在後端是因為:(1) 避免前端 N 次重算 (2) data.json 是 single source of truth。

// CPI / PCE 等指數類 series 需要轉成年增率(YoY %)才有解讀意義。
// 規則:對於月頻或日頻指數,使用「12 個月前同月份」作為基準。
export function applyYoyPct(rows) {
  if (rows.length < 13) {
    throw new Error('YoY transform requires at least 13 monthly observations');
  }
  // 用日期字串的「YYYY-MM」匹配,避免日數差異(月底資料日期可能 28/30/31)。
  const byMonth = new Map(rows.map((r) => [r.date.slice(0, 7), r]));
  const out = [];
  for (const r of rows) {
    const yearAgoMonth = shiftMonth(r.date.slice(0, 7), -12);
    const base = byMonth.get(yearAgoMonth);
    if (!base || base.value === 0) continue;
    out.push({
      date: r.date,
      value: (r.value / base.value - 1) * 100,
    });
  }
  if (out.length === 0) {
    throw new Error('YoY transform produced no rows (gap > 12 months?)');
  }
  return out;
}

function shiftMonth(yearMonth, deltaMonths) {
  const [y, m] = yearMonth.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(totalMonths / 12);
  const nm = (totalMonths % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

// 把超出近 lookback_years 的早期資料砍掉(用於 YoY 計算時抓的額外歷史)。
export function trimToLookback(rows, lookbackYears) {
  const cutoff = new Date(rows[rows.length - 1].date);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - lookbackYears);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => r.date >= cutoffStr);
}

export function summarize(rows, unit) {
  if (rows.length < 2) {
    throw new Error('series must have at least 2 observations');
  }
  const values = rows.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];

  // Percentile rank:目前值在歷史區間內 <= 多少比例。
  const sorted = [...values].sort((a, b) => a - b);
  const belowOrEqual = sorted.filter((v) => v <= latest.value).length;
  const percentile = belowOrEqual / sorted.length;

  // delta 單位:percent 系列(利差/殖利率)用 bp(1 pp = 100 bp);
  // level 系列(VIX 等)用 pt(原始點數差)。
  const rawDelta = latest.value - previous.value;
  const delta_unit = unit === 'percent' ? 'bp' : 'pt';
  const delta =
    unit === 'percent' ? Math.round(rawDelta * 100) : Math.round(rawDelta * 10) / 10;

  return {
    latest,
    previous,
    delta,
    delta_unit,
    min,
    max,
    percentile,
    n_observations: rows.length,
  };
}
