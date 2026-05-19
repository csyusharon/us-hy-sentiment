// 前端進入點:抓 data.json → 渲染 hero(互動圖)+ sentiment + 其他 section + 來源連結。
// hero 用 lightweight-charts;其他卡用 web/charts.js 的迷你 SVG sparkline。

import {
  DISPLAY_TIMEZONE,
  EXTERNAL_REFERENCES,
  HERO_RANGES,
  HERO_DEFAULT_RANGE,
  SPARKLINE_OVERRIDES,
} from './config.js';
import { sparkline, rangeBar } from './charts.js';
import { sentimentText, bucketLabel } from './sentiment.js';
import {
  createHeroChart,
  setVisibleRange,
  bindCrosshairReadout,
} from './interactive-chart.js';

// ── formatters ──────────────────────────────────────────

function deltaColor(delta) {
  if (delta > 0) return 'var(--color-bad)';
  if (delta < 0) return 'var(--color-good)';
  return 'var(--color-muted)';
}

function signedDelta(delta, unit) {
  if (delta === 0) return `±0 ${unit}`;
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(delta)} ${unit}`;
}

function deltaArrow(delta) {
  if (delta > 0) return '▲';
  if (delta < 0) return '▼';
  return '■';
}

function formatValue(value, unit) {
  return unit === 'percent' ? `${value.toFixed(2)}%` : value.toFixed(2);
}

function formatPercentile(p) {
  return `${Math.round(p * 100)}%`;
}

function formatUpdatedAt(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('zh-TW', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// ── card rendering ──────────────────────────────────────

function renderCard(series) {
  const color = deltaColor(series.delta);

  const card = document.createElement('article');
  card.className = `card card-${series.category}`;

  card.innerHTML = `
    <header class="card-head">
      <h3>${series.label}</h3>
      <span class="series-id">${series.id}</span>
    </header>
    <div class="value-row">
      <span class="value">${formatValue(series.latest.value, series.unit)}</span>
      <span class="delta" style="color:${color}">
        <span class="delta-arrow">${deltaArrow(series.delta)}</span>
        ${signedDelta(series.delta, series.delta_unit)}
      </span>
    </div>
    <div class="value-date">at ${series.latest.date}</div>
    <div class="spark-slot"></div>
    <div class="range-row">
      <div class="range-slot"></div>
      <div class="range-meta">
        <span class="range-bucket">${bucketLabel(series.percentile)}</span>
        <span class="range-pct">${formatPercentile(series.percentile)}</span>
      </div>
    </div>
    <div class="range-extremes">
      <span>${formatValue(series.min, series.unit)}</span>
      <span>${formatValue(series.max, series.unit)}</span>
    </div>
  `;

  card.querySelector('.spark-slot').appendChild(
    sparkline(series.data, { color, ...(SPARKLINE_OVERRIDES[series.id] ?? {}) }),
  );
  card.querySelector('.range-slot').appendChild(
    rangeBar({ percentile: series.percentile, color }),
  );
  return card;
}

// ── hero (main HY OAS, interactive) ─────────────────────

function renderHero(parent, series) {
  const color = deltaColor(series.delta);
  const hero = document.createElement('article');
  hero.className = 'card card-main';

  const buttonsHtml = HERO_RANGES.map(
    (r) =>
      `<button data-range="${r.key}" class="range-btn${r.key === HERO_DEFAULT_RANGE ? ' active' : ''}">${r.label}</button>`,
  ).join('');

  hero.innerHTML = `
    <header class="card-head">
      <h3>${series.label}</h3>
      <span class="series-id">${series.id}</span>
    </header>
    <div class="value-row">
      <span class="value" id="hero-value">${formatValue(series.latest.value, series.unit)}</span>
      <span class="delta" id="hero-delta" style="color:${color}">
        <span class="delta-arrow">${deltaArrow(series.delta)}</span>
        ${signedDelta(series.delta, series.delta_unit)}
      </span>
    </div>
    <div class="value-date" id="hero-date">at ${series.latest.date}</div>

    <div class="range-buttons" role="group" aria-label="時間範圍">
      ${buttonsHtml}
    </div>
    <div class="hero-chart" id="hero-chart"></div>

    <div class="range-row">
      <div class="range-slot"></div>
      <div class="range-meta">
        <span class="range-bucket">${bucketLabel(series.percentile)}</span>
        <span class="range-pct">${formatPercentile(series.percentile)}</span>
      </div>
    </div>
    <div class="range-extremes">
      <span>${formatValue(series.min, series.unit)}</span>
      <span>${formatValue(series.max, series.unit)}</span>
    </div>
  `;

  hero
    .querySelector('.range-slot')
    .appendChild(rangeBar({ percentile: series.percentile, color }));

  parent.appendChild(hero);

  // 建圖之前 container 必須已在 DOM 內(autoSize 用 ResizeObserver)。
  const container = hero.querySelector('#hero-chart');
  const { chart, series: chartSeries } = createHeroChart(container, series.data);

  // 時間範圍按鈕。
  const valueEl = hero.querySelector('#hero-value');
  const dateEl = hero.querySelector('#hero-date');
  const deltaEl = hero.querySelector('#hero-delta');

  const latestSnapshot = {
    value: formatValue(series.latest.value, series.unit),
    date: `at ${series.latest.date}`,
    deltaHtml: `<span class="delta-arrow">${deltaArrow(series.delta)}</span> ${signedDelta(series.delta, series.delta_unit)}`,
  };

  for (const btn of hero.querySelectorAll('.range-btn')) {
    btn.addEventListener('click', () => {
      for (const b of hero.querySelectorAll('.range-btn')) {
        b.classList.toggle('active', b === btn);
      }
      const rangeKey = btn.dataset.range;
      const months = HERO_RANGES.find((r) => r.key === rangeKey).months;
      setVisibleRange(chart, series.latest.date, months);
    });
  }

  // crosshair 跟著移時把 hero 上的值換成游標位置的值;離開後復原 latest。
  bindCrosshairReadout(chart, chartSeries, (point) => {
    if (!point) {
      valueEl.textContent = latestSnapshot.value;
      dateEl.textContent = latestSnapshot.date;
      deltaEl.innerHTML = latestSnapshot.deltaHtml;
      deltaEl.style.opacity = 1;
      return;
    }
    valueEl.textContent = formatValue(point.value, series.unit);
    dateEl.textContent = `at ${point.time}`;
    deltaEl.style.opacity = 0.3;
  });

  return hero;
}

// ── section orchestration ──────────────────────────────

function renderSection(parent, section, seriesList) {
  if (seriesList.length === 0) return;

  const wrap = document.createElement('section');
  wrap.className = 'section';
  wrap.innerHTML = `
    <h2 class="section-title">${section.label}</h2>
    <div class="card-grid"></div>
  `;
  const grid = wrap.querySelector('.card-grid');
  for (const s of seriesList) {
    grid.appendChild(renderCard(s));
  }
  parent.appendChild(wrap);
}

function renderSentiment(mainSeries) {
  const el = document.getElementById('sentiment-text');
  el.textContent = sentimentText({
    percentile: mainSeries.percentile,
    delta_bp: mainSeries.delta_unit === 'bp' ? mainSeries.delta : 0,
  });
}

function renderReferences(parent) {
  parent.innerHTML = '';
  for (const ref of EXTERNAL_REFERENCES) {
    const a = document.createElement('a');
    a.href = ref.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = ref.label;
    parent.appendChild(a);
  }
}

function showError(message) {
  document.getElementById('app').innerHTML = `
    <div class="error-banner">
      <strong>無法載入 data.json</strong>
      <p>${message}</p>
      <p>請先執行 <code>npm install</code> 與 <code>npm run fetch</code>,
      或在 GitHub Actions 手動觸發一次 update workflow。</p>
    </div>
  `;
}

// ── bootstrap ──────────────────────────────────────────

async function main() {
  let data;
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    showError(err.message);
    return;
  }

  document.getElementById('updated-at').textContent = formatUpdatedAt(
    data.updated_at,
  );

  const mainSeries = data.series.find((s) => s.category === 'main');
  if (mainSeries) {
    renderHero(document.getElementById('hero-slot'), mainSeries);
    renderSentiment(mainSeries);
  }

  const otherSections = data.sections.filter((s) => s.id !== 'main');
  const container = document.getElementById('sections-slot');
  for (const section of otherSections) {
    const seriesInSection = data.series.filter((s) =>
      section.categories.includes(s.category),
    );
    renderSection(container, section, seriesInSection);
  }

  renderReferences(document.getElementById('references'));
}

main();
