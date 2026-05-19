// 根據主指標(整體 OAS 利差)的近 3 年分位與最近變動,自動產出一段判讀文字。
// 規則寫死在這裡而不放 config 的理由:這是「市場語意」,不該被輕易改參數;
// 真要調整,直接看程式碼來理解推論鏈比較清楚。

import { SENTIMENT_BUCKETS } from './config.js';

const FLAT_DELTA_BP_THRESHOLD = 2; // |Δ| < 2bp 視為持平(日內噪音)

export function bucketOf(percentile) {
  if (percentile < SENTIMENT_BUCKETS.low.max_percentile) return 'low';
  if (percentile < SENTIMENT_BUCKETS.mid.max_percentile) return 'mid';
  return 'high';
}

export function bucketLabel(percentile) {
  return SENTIMENT_BUCKETS[bucketOf(percentile)].label;
}

function levelNarrative(bucket) {
  switch (bucket) {
    case 'low':
      return (
        '整體利差落在近 3 年低檔區,反映市場對信用風險評價偏樂觀。' +
        '此時高收益債估值偏貴、風險溢酬有限,追逐 carry 的同時要留意若利差由低檔反彈將快速擴大下行幅度。'
      );
    case 'mid':
      return (
        '整體利差位於近 3 年中段區間,市場情緒接近中性 — 既無顯著恐慌、亦無極度樂觀。' +
        '此區間方向訊號通常不明確,觀察利差動能與分評等利差是否同步較有意義。'
      );
    case 'high':
      return (
        '整體利差攀升至近 3 年高檔,反映市場避險情緒升高或對信用基本面有疑慮。' +
        '估值面已修正、未來報酬潛力提高,但需評估是否伴隨經濟下行、違約率上升或流動性緊縮的同向訊號。'
      );
  }
}

function deltaNarrative(deltaBp) {
  if (Math.abs(deltaBp) < FLAT_DELTA_BP_THRESHOLD) {
    return '近一個觀測日利差變動幅度有限,短線維持觀望態勢。';
  }
  if (deltaBp < 0) {
    return `近一個觀測日利差收窄 ${Math.abs(deltaBp)} bp,顯示風險偏好回升、信用環境短線轉趨友善。`;
  }
  return `近一個觀測日利差走闊 ${deltaBp} bp,顯示市場對信用風險的補償要求上升。`;
}

export function sentimentText({ percentile, delta_bp }) {
  return `${levelNarrative(bucketOf(percentile))}${deltaNarrative(delta_bp)}`;
}
