/* ============================================================
   CHARTS — tiny dependency-free SVG line chart
   ============================================================ */

const Charts = {
  // points: [{x: label, y: number}]
  line(points, { width = 560, height = 160, color = 'var(--blue)', unitLabel = '' } = {}) {
    if (!points || points.length === 0) {
      return `<div class="empty-state">Not enough logged sessions yet to chart a trend.</div>`;
    }
    const pad = { top: 16, right: 16, bottom: 24, left: 40 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const ys = points.map(p => p.y);
    let min = Math.min(...ys), max = Math.max(...ys);
    if (min === max) { min -= 5; max += 5; }
    const pad10 = (max - min) * 0.1;
    min -= pad10; max += pad10;

    const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
    const xy = (i, y) => {
      const x = pad.left + i * xStep;
      const yy = pad.top + innerH - ((y - min) / (max - min)) * innerH;
      return [x, yy];
    };

    const pathD = points.map((p, i) => {
      const [x, y] = xy(i, p.y);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const dots = points.map((p, i) => {
      const [x, y] = xy(i, p.y);
      const isLast = i === points.length - 1;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isLast ? 4.5 : 3}" fill="${isLast ? color : 'var(--surface)'}" stroke="${color}" stroke-width="2"/>`;
    }).join('');

    const labelEvery = Math.max(1, Math.ceil(points.length / 6));
    const xLabels = points.map((p, i) => {
      if (i % labelEvery !== 0 && i !== points.length - 1) return '';
      const [x] = xy(i, p.y);
      return `<text x="${x.toFixed(1)}" y="${height - 6}" font-size="9" fill="var(--text-dim)" text-anchor="middle">${p.x}</text>`;
    }).join('');

    const gridLines = [0, 0.5, 1].map(f => {
      const y = pad.top + innerH * f;
      const val = Math.round(max - (max - min) * f);
      return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="var(--border)" stroke-width="1"/>
              <text x="${pad.left - 6}" y="${y + 3}" font-size="9" fill="var(--text-dim)" text-anchor="end">${val}${unitLabel}</text>`;
    }).join('');

    return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;">
      ${gridLines}
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5"/>
      ${dots}
      ${xLabels}
    </svg>`;
  },

  // simple horizontal bar for volume landmarks
  bar(value, max, color) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return `<div class="muscle-bar-track"><div class="muscle-bar-fill" style="width:${pct}%; background:${color};"></div></div>`;
  }
};
