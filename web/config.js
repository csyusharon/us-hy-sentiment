// 前端 UI 與顯示用的參數集中於此,避免散落在 app.js / 各元件裡。
// 與 config/series.json 的 series 定義互補(後者是資料來源,這裡是顯示行為)。

export const SENTIMENT_BUCKETS = {
  low: { max_percentile: 1 / 3, label: '低檔' },
  mid: { max_percentile: 2 / 3, label: '中檔' },
  high: { max_percentile: 1.01, label: '高檔' },
};

export const SPARKLINE = {
  width: 240,
  height: 50,
  padding: 3,
  stroke_width: 1.0,
};

// 單一 series 的視覺微調(理由:VIX 是 level 系列、日間波動劇烈,自動拉伸到全高
// 後鋸齒密集,線寬要再細才看得清楚趨勢)。
export const SPARKLINE_OVERRIDES = {
  VIXCLS: { stroke_width: 0.6 },
};

export const RANGE_BAR = {
  width: 240,
  height: 22,
  marker_width: 2,
};

// 主指標互動圖的可選時間範圍。值是月數,'ALL' 代表整段近 3 年。
export const HERO_RANGES = [
  { key: '1M', label: '1M', months: 1 },
  { key: '3M', label: '3M', months: 3 },
  { key: '6M', label: '6M', months: 6 },
  { key: '1Y', label: '1Y', months: 12 },
  { key: '3Y', label: '3Y', months: 36 },
];

export const HERO_DEFAULT_RANGE = '3Y';

// 主指標圖配色:用主題琥珀色,避免跟 delta 紅綠混淆視覺訊號。
export const HERO_CHART_COLOR = '#f5a524';

// 顯示時區固定台北。資料的 updated_at 仍是 UTC ISO 字串,只是渲染時轉。
export const DISPLAY_TIMEZONE = 'Asia/Taipei';

export const EXTERNAL_REFERENCES = [
  {
    label: 'Moody’s Credit Risk Research',
    url: 'https://www.moodys.com/researchandratings/market-segment/corporate-finance/-/005005/005005/-/0/0/-/0/-/-/en/global/rr',
  },
  {
    label: 'S&P Global Ratings',
    url: 'https://www.spglobal.com/ratings/en/',
  },
  {
    label: 'Fitch Ratings',
    url: 'https://www.fitchratings.com/',
  },
  {
    label: 'FOMC 行事曆',
    url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
  },
  {
    label: 'BLS(美國勞工統計局)',
    url: 'https://www.bls.gov/',
  },
];
