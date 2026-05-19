// 純 SVG 小圖元件,不依賴任何 chart library。
// sparkline:走勢線 + 線下方漸層填色(FT/Bloomberg.com 風格)
// rangeBar:橫向 track + 四分位細刻度 + 圓點 marker 標示目前位置

import { SPARKLINE, RANGE_BAR } from './config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// 同頁多個 sparkline 需要各自獨立的 <linearGradient> id,用 module 計數器避免碰撞。
let chartUid = 0;

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  return node;
}

export function sparkline(rows, { color, stroke_width: strokeOverride } = {}) {
  const { width, height, padding } = SPARKLINE;
  const stroke_width = strokeOverride ?? SPARKLINE.stroke_width;
  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    class: 'sparkline',
  });

  if (rows.length < 2) return svg;

  const values = rows.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // 區間零寬度時(極端情況),所有點疊在中間以免除以 0。
  const yRange = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const bottomY = padding + innerH;

  const points = rows.map((r, i) => {
    const x = padding + (i / (rows.length - 1)) * innerW;
    const y = padding + innerH - ((r.value - min) / yRange) * innerH;
    return { x, y };
  });

  const gradId = `spark-grad-${++chartUid}`;
  const defs = el('defs');
  const grad = el('linearGradient', {
    id: gradId,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 1,
  });
  grad.appendChild(
    el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.28' }),
  );
  grad.appendChild(
    el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }),
  );
  defs.appendChild(grad);
  svg.appendChild(defs);

  const lineCoords = points
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');

  // 面積路徑:從第一點底部 → 沿著線到末點 → 回到末點底部 → 封閉。
  const first = points[0];
  const last = points[points.length - 1];
  const areaD = [
    `M ${first.x.toFixed(2)},${bottomY.toFixed(2)}`,
    ...points.map((p) => `L ${p.x.toFixed(2)},${p.y.toFixed(2)}`),
    `L ${last.x.toFixed(2)},${bottomY.toFixed(2)}`,
    'Z',
  ].join(' ');

  svg.appendChild(
    el('path', { d: areaD, fill: `url(#${gradId})`, stroke: 'none' }),
  );

  svg.appendChild(
    el('polyline', {
      points: lineCoords,
      fill: 'none',
      stroke: color,
      'stroke-width': stroke_width,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }),
  );

  return svg;
}

export function rangeBar({ percentile, color }) {
  const { width, height } = RANGE_BAR;
  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    class: 'range-bar',
  });

  const trackY = height / 2;
  const markerX = Math.max(6, Math.min(width - 6, percentile * width));

  // 四分位刻度 — 給眼睛一個對齊基準,但用很弱的對比避免搶戲。
  for (const q of [0.25, 0.5, 0.75]) {
    svg.appendChild(
      el('line', {
        x1: q * width,
        x2: q * width,
        y1: trackY - 5,
        y2: trackY + 5,
        class: 'range-tick',
      }),
    );
  }

  svg.appendChild(
    el('line', {
      x1: 1,
      x2: width - 1,
      y1: trackY,
      y2: trackY,
      class: 'range-track',
      'stroke-linecap': 'round',
    }),
  );

  // 外圈光暈製造一點層次感。
  svg.appendChild(
    el('circle', {
      cx: markerX,
      cy: trackY,
      r: 7,
      fill: color,
      'fill-opacity': '0.18',
    }),
  );
  svg.appendChild(
    el('circle', {
      cx: markerX,
      cy: trackY,
      r: 4,
      fill: color,
      class: 'range-marker',
    }),
  );

  return svg;
}
