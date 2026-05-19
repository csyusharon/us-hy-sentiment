// 主抓取腳本:讀 config → 對每個 series 抓 FRED CSV → 視 transform 處理 → 寫 data.json。
// 由 GitHub Actions 每日排程觸發,也可在本機用 `npm run fetch` 跑。

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchSeriesCsv, parseSeriesCsv } from './fred-client.js';
import { summarize, applyYoyPct, trimToLookback } from './series-stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONFIG_PATH = resolve(ROOT, 'config/series.json');
const OUTPUT_PATH = resolve(ROOT, 'data.json');

// 回推起始日:固定用 UTC,避免不同 runner 時區造成抓取範圍差一天。
// 對於 YoY transform 的 series 額外加幾個月歷史(否則最早 12 個月會算不出 YoY)。
function startDate(lookbackYears, extraMonths = 0) {
  const now = new Date();
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear() - lookbackYears,
      now.getUTCMonth() - extraMonths,
      now.getUTCDate(),
    ),
  );
  return start.toISOString().slice(0, 10);
}

async function fetchOne(config, series) {
  const needsYoy = series.transform === 'yoy_pct';
  const cosd = needsYoy
    ? startDate(config.lookback_years, config.extra_history_months_for_yoy)
    : startDate(config.lookback_years);

  const csv = await fetchSeriesCsv(config.fred_csv_endpoint, series.id, cosd);
  let rows = parseSeriesCsv(csv, series.id, {
    allowZero: series.allow_zero === true,
  });

  if (needsYoy) {
    rows = applyYoyPct(rows);
    rows = trimToLookback(rows, config.lookback_years);
  }

  const stats = summarize(rows, series.unit);
  return {
    id: series.id,
    label: series.label,
    label_en: series.label_en,
    category: series.category,
    unit: series.unit,
    transform: series.transform || 'raw',
    data: rows,
    ...stats,
  };
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  console.log(`[fetch] series=${config.series.length}, lookback=${config.lookback_years}y`);

  // 序列化執行,避免對 FRED 一次打十幾個請求被 throttle。
  const results = [];
  for (const series of config.series) {
    try {
      const result = await fetchOne(config, series);
      console.log(
        `[fetch] ${series.id.padEnd(18)} ${result.n_observations.toString().padStart(4)} rows, ` +
          `latest=${result.latest.value.toFixed(2)} (${result.latest.date})`,
      );
      results.push(result);
    } catch (err) {
      console.error(`[fetch] FAILED on ${series.id}: ${err.message}`);
      process.exitCode = 1;
      throw err;
    }
  }

  const output = {
    updated_at: new Date().toISOString(),
    lookback_years: config.lookback_years,
    sections: config.sections,
    series: results,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[fetch] wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
