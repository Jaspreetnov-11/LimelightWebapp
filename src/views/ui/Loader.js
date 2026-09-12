'use client';
// Limelight loader: the wordmark over a radar-style sweep with orbiting nodes and a scanning bar.
// Pure CSS animation (see .lh-loader in globals.css); honours prefers-reduced-motion.
export function LimelightLoader({ text = 'Loading…', size = 168 }) {
  return (
    <div className="lh-loader" role="status" aria-live="polite" style={{ '--sz': size + 'px' }}>
      <div className="lh-radar" aria-hidden="true">
        <svg viewBox="0 0 200 200" width={size} height={size}>
          <defs>
            <linearGradient id="lhSweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--accent)" stopOpacity="0" /><stop offset="1" stopColor="var(--accent)" stopOpacity=".85" /></linearGradient>
          </defs>
          <circle className="ring r1" cx="100" cy="100" r="92" />
          <circle className="ring r2" cx="100" cy="100" r="68" />
          <circle className="ring r3" cx="100" cy="100" r="44" />
          <g className="ticks">{Array.from({ length: 36 }).map((_, i) => <line key={i} x1="100" y1="6" x2="100" y2={i % 9 === 0 ? 16 : 11} transform={'rotate(' + i * 10 + ' 100 100)'} />)}</g>
          <g className="sweep"><path d="M100 100 L100 8 A92 92 0 0 1 165 35 Z" fill="url(#lhSweep)" /></g>
          <g className="orbit o1"><circle cx="100" cy="32" r="3.2" /></g>
          <g className="orbit o2"><circle cx="100" cy="56" r="2.6" /></g>
          <g className="orbit o3"><circle cx="100" cy="144" r="2.6" /></g>
          <polygon className="mark" points="86,90 114,90 100,113" />
          <circle className="core" cx="100" cy="100" r="30" />
        </svg>
      </div>
      <img src="/logo.png" alt="limelight" className="lh-wordmark" width="3096" height="774" />
      <div className="lh-scan" aria-hidden="true"><i></i></div>
      <div className="lh-text">{text}<span className="dots"><i>.</i><i>.</i><i>.</i></span></div>
    </div>
  );
}
