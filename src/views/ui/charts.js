'use client';
// Small inline-SVG charts for the dashboard: ring gauge, daily bars, horizontal bars, paired bars.
// Colours come from CSS tokens (--viz-*) so they follow the dark / light theme.
import { useState } from 'react';

/** Progress ring with a hero number in the middle. */
export function Ring({ value = 0, max = 1, size = 132, stroke = 12, label, sub, format = v => v, tone }) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="viz-ring" style={{ width: size }}>
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} role="img" aria-label={(label || '') + ' ' + format(value)}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--viz-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone || 'var(--viz-primary)'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={C * pct + ' ' + C * (1 - pct)} strokeDashoffset={C * 0.25} style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <div className="viz-ring-c"><b>{format(value)}</b>{sub && <span>{sub}</span>}</div>
      {label && <div className="viz-ring-l">{label}</div>}
    </div>
  );
}

/** Vertical bars (one series) with an optional target line and hover tooltip. */
export function Bars({ data = [], max, target, height = 150, format = v => v, empty = 'No data yet', labelEvery = 1 }) {
  const [hov, setHov] = useState(-1);
  const top = Math.max(max || 0, target || 0, ...data.map(d => d.value || 0), 1);
  const n = data.length;
  if (!n) return <div className="viz-empty" style={{ height }}>{empty}</div>;
  const W = 100, H = 100, pad = 2;
  const bw = Math.max(1.2, (W - pad * 2) / n - 1.2);
  const step = (W - pad * 2) / n;
  const y = v => H - (v / top) * H;
  return (
    <div className="viz-bars" style={{ height }} onMouseLeave={() => setHov(-1)}>
      <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">
        {[0.25, 0.5, 0.75].map(g => <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--viz-grid)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />)}
        {target !== undefined && target > 0 && <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="var(--viz-target)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        {data.map((d, i) => { const h = Math.max(d.value > 0 ? 1.5 : 0, H - y(d.value || 0)); return (
          <g key={i} onMouseEnter={() => setHov(i)} onTouchStart={() => setHov(i)}>
            <rect x={pad + i * step} y={0} width={step} height={H} fill="transparent" />
            <rect x={pad + i * step + (step - bw) / 2} y={H - h} width={bw} height={h} rx={0.8} fill={d.tone || (hov === i ? 'var(--viz-primary-hi)' : 'var(--viz-primary)')} />
          </g>); })}
      </svg>
      <div className="viz-x">{data.map((d, i) => <span key={i} style={{ visibility: i % labelEvery === 0 ? 'visible' : 'hidden' }}>{d.label}</span>)}</div>
      {hov >= 0 && data[hov] && <div className="viz-tip" style={{ left: ((pad + hov * step + step / 2) / W * 100) + '%' }}><b>{format(data[hov].value)}</b>{data[hov].tip && <span>{data[hov].tip}</span>}</div>}
      {target !== undefined && target > 0 && <div className="viz-target-l" style={{ top: (y(target) / H * 100) + '%' }}>target {format(target)}</div>}
    </div>
  );
}

/** Horizontal bars (one series) with direct labels. */
export function HBars({ data = [], max, format = v => v, empty = 'No data yet', tone }) {
  const top = Math.max(max || 0, ...data.map(d => d.value || 0), 1);
  if (!data.length) return <div className="viz-empty">{empty}</div>;
  return (
    <div className="viz-hbars">
      {data.map((d, i) => (
        <div className="viz-hrow" key={i} title={d.tip || ''}>
          <span className="viz-hl">{d.label}</span>
          <span className="viz-ht"><i style={{ width: Math.max(1, ((d.value || 0) / top) * 100) + '%', background: d.tone || tone || 'var(--viz-primary)' }}></i></span>
          <span className="viz-hv">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Two series side by side per category (e.g. revenue vs cost) with a legend. */
export function PairBars({ data = [], names = ['A', 'B'], colors = ['var(--viz-s1)', 'var(--viz-s2)'], format = v => v, empty = 'No data yet' }) {
  const top = Math.max(1, ...data.flatMap(d => [d.a || 0, d.b || 0]));
  if (!data.length) return <div className="viz-empty">{empty}</div>;
  return (
    <div className="viz-pair">
      <div className="viz-legend"><span><i style={{ background: colors[0] }}></i>{names[0]}</span><span><i style={{ background: colors[1] }}></i>{names[1]}</span></div>
      {data.map((d, i) => (
        <div className="viz-prow" key={i}>
          <span className="viz-hl" title={d.label}>{d.label}</span>
          <span className="viz-pt">
            <i title={names[0] + ' ' + format(d.a)} style={{ width: Math.max(1, ((d.a || 0) / top) * 100) + '%', background: colors[0] }}></i>
            <i title={names[1] + ' ' + format(d.b)} style={{ width: Math.max(1, ((d.b || 0) / top) * 100) + '%', background: colors[1] }}></i>
          </span>
          <span className="viz-hv">{format(d.a)} <em>/ {format(d.b)}</em></span>
        </div>
      ))}
    </div>
  );
}

/** Donut with gaps between segments, plus a legend that carries the values (never colour alone). */
export function DonutChart({ parts = [], size = 130, stroke = 16, center, legend = true }) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const total = parts.reduce((a, p) => a + (p.value || 0), 0);
  const gap = parts.filter(p => p.value > 0).length > 1 ? 2.2 : 0;
  let off = 0;
  const segs = total > 0 ? parts.map((p, i) => {
    const len = (C * (p.value || 0)) / total;
    const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={Math.max(0, len - gap) + ' ' + (C - Math.max(0, len - gap))} strokeDashoffset={-(off + gap / 2)} transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'} />;
    off += len; return el;
  }) : <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--viz-track)" strokeWidth={stroke} />;
  const [big, small] = String(center || '|').split('|');
  return (
    <div className="viz-donut">
      <div className="viz-donut-w" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} aria-hidden="true">{segs}</svg>
        <div className="viz-donut-c"><b>{big}</b><span>{small || ''}</span></div>
      </div>
      {legend && <div className="viz-legend col">{parts.map((p, i) => <span key={i}><i style={{ background: p.color }}></i>{p.label}<b>{p.value}</b></span>)}</div>}
    </div>
  );
}
