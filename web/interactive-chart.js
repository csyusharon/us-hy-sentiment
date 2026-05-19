// 主指標卡用的互動式圖表 — 套 lightweight-charts(TradingView 開源版)。
// 載入方式:index.html 用 <script> 引入 UMD 全域,本檔抓 window.LightweightCharts。
// 為什麼用 UMD 而不是 ESM:lightweight-charts 的 ESM CDN 路徑常變動,UMD 最穩。

import { HERO_CHART_COLOR } from './config.js';

const LWC = window.LightweightCharts;
if (!LWC) {
  throw new Error(
    'lightweight-charts not loaded — check the <script> tag in index.html',
  );
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createHeroChart(container, rows) {
  const chart = LWC.createChart(container, {
    autoSize: true,
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#9aa3b2',
      fontFamily:
        '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 11,
    },
    grid: {
      vertLines: { color: 'rgba(35, 44, 57, 0.4)' },
      horzLines: { color: 'rgba(35, 44, 57, 0.4)' },
    },
    rightPriceScale: {
      borderColor: 'rgba(35, 44, 57, 0.8)',
      scaleMargins: { top: 0.1, bottom: 0.05 },
    },
    timeScale: {
      borderColor: 'rgba(35, 44, 57, 0.8)',
      rightOffset: 4,
      timeVisible: false,
      secondsVisible: false,
    },
    crosshair: {
      mode: LWC.CrosshairMode.Normal,
      vertLine: {
        color: 'rgba(245, 165, 36, 0.5)',
        width: 1,
        style: LWC.LineStyle.Dashed,
        labelBackgroundColor: '#f5a524',
      },
      horzLine: {
        color: 'rgba(245, 165, 36, 0.5)',
        width: 1,
        style: LWC.LineStyle.Dashed,
        labelBackgroundColor: '#f5a524',
      },
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
  });

  const series = chart.addAreaSeries({
    lineColor: HERO_CHART_COLOR,
    topColor: hexToRgba(HERO_CHART_COLOR, 0.35),
    bottomColor: hexToRgba(HERO_CHART_COLOR, 0),
    lineWidth: 2,
    priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    crosshairMarkerRadius: 5,
    crosshairMarkerBorderColor: '#0a0d13',
    crosshairMarkerBackgroundColor: HERO_CHART_COLOR,
  });

  series.setData(rows.map((r) => ({ time: r.date, value: r.value })));
  chart.timeScale().fitContent();

  return { chart, series };
}

// 把可視範圍設成 latest 往前推 N 個月,或 'ALL' 顯示完整資料。
export function setVisibleRange(chart, latestDate, months) {
  if (months === 'ALL') {
    chart.timeScale().fitContent();
    return;
  }
  const to = new Date(latestDate);
  const from = new Date(to);
  from.setMonth(from.getMonth() - months);
  chart.timeScale().setVisibleRange({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });
}

// 由外部訂閱 crosshair 移動,把游標下的值塞回對應 DOM 顯示。
export function bindCrosshairReadout(chart, series, onMove) {
  chart.subscribeCrosshairMove((param) => {
    if (!param.time || !param.seriesData.get(series)) {
      onMove(null);
      return;
    }
    const d = param.seriesData.get(series);
    onMove({ time: param.time, value: d.value });
  });
}
