// Shared parchment-theme UI primitives for The Adventurer's Almanac.
import React from "react";

// ---- palette (lifted from the Adventurer's Ledger design) ----
export const C = {
  ink: "#2c2013",
  parchment: "#e9dcbf",
  card: "#f2e9d2",
  cardAlt: "#ece1c6",
  cardLight: "#fbf6e8",
  rail: "#2a1a10",
  gold: "#b98f3e",
  goldBright: "#e3c878",
  goldDeep: "#7c5a22",
  line: "rgba(44,32,19,.18)",
  muted: "#8a6a38",
  muted2: "#6a5436",
  green: "#5c6e35",
  red: "#963a2c",
  purple: "#6a4a8a",
  teal: "#3c6b6b",
};

export const mono = (extra) => ({ fontFamily: "'JetBrains Mono', monospace", ...extra });
export const serif = (extra) => ({ fontFamily: "'EB Garamond', Georgia, serif", ...extra });
export const cinzel = (extra) => ({ fontFamily: "'Cinzel', serif", ...extra });

// Per-section theming. Every tab gets its own jewel-toned accent + banner
// gradient so each feels distinct, while the dark/earthy tones keep the whole
// almanac cohesive. `lite` is the highlight used for icon glows.
export const THEME = {
  dashboard: { accent: "#b98f3e", lite: "#e3c878", g1: "#3a2a14", g2: "#5a4424", icon: "⚔" },
  skills:    { accent: "#3c6b6b", lite: "#7fb0ad", g1: "#15302f", g2: "#274a48", icon: "✦" },
  pathfinder:{ accent: "#6a4a8a", lite: "#b79bd8", g1: "#2a1f3d", g2: "#42285f", icon: "🕸" },
  goals:     { accent: "#9a6b30", lite: "#d8a85a", g1: "#33220f", g2: "#54381b", icon: "✸" },
  networth:  { accent: "#6e7d3a", lite: "#b6c06a", g1: "#23301a", g2: "#3c4d24", icon: "🪙" },
  flipping:  { accent: "#b98f3e", lite: "#e3c878", g1: "#3a2a14", g2: "#5a4424", icon: "⚖" },
  alchemy:   { accent: "#6a4a8a", lite: "#b6a0d8", g1: "#241636", g2: "#3a2456", icon: "🔮" },
  bossing:   { accent: "#963a2c", lite: "#d57a5a", g1: "#2e1410", g2: "#4a201a", icon: "☠" },
  slayer:    { accent: "#8a3b30", lite: "#c87a5a", g1: "#2a1410", g2: "#46211a", icon: "🗡" },
  gear:      { accent: "#4a5e70", lite: "#8aa6bc", g1: "#19242e", g2: "#2c3e4c", icon: "🛡" },
  farming:   { accent: "#5c6e35", lite: "#9fbf6a", g1: "#1f2c16", g2: "#36431f", icon: "🌱" },
  quests:    { accent: "#5a4a8a", lite: "#9a8ad0", g1: "#1e1a36", g2: "#332c56", icon: "📜" },
  diary:     { accent: "#8a6a38", lite: "#d8b878", g1: "#2e2212", g2: "#4a3820", icon: "🏅" },
};
export const themeFor = (sec) => THEME[sec] || THEME.dashboard;

// Themed hero banner (the coloured gradient strip at the top of a section).
export function Hero({ theme, icon, kicker, title, blurb, statLabel, statValue, statSub }) {
  const t = theme || THEME.dashboard;
  return (
    <div style={{ background: `linear-gradient(115deg, ${t.g1}, ${t.g2})`, border: `2px solid ${t.accent}`, borderRadius: 8, padding: "18px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", boxShadow: "0 4px 16px rgba(30,20,8,.28)" }}>
      <div style={{ width: 52, height: 52, flex: "0 0 52px", borderRadius: "50%", background: `radial-gradient(circle at 38% 32%, ${t.lite}, ${t.accent} 60%, ${t.g2})`, border: `2px solid ${t.lite}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25, boxShadow: `0 0 18px ${t.accent}66` }}>{icon || t.icon}</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        {kicker && <div style={mono({ fontSize: 9.5, letterSpacing: ".24em", color: t.lite, textTransform: "uppercase" })}>{kicker}</div>}
        <div style={cinzel({ fontWeight: 700, fontSize: 23, color: "#f0e2bd", margin: "3px 0" })}>{title}</div>
        {blurb && <div style={serif({ fontSize: 13.5, fontStyle: "normal", color: "#cdb98a" })}>{blurb}</div>}
      </div>
      {statValue != null && (
        <div style={{ textAlign: "right", paddingLeft: 22, borderLeft: "1px solid rgba(201,162,74,.3)" }}>
          {statLabel && <div style={mono({ fontSize: 9.5, letterSpacing: ".18em", color: "#9c7c44", textTransform: "uppercase" })}>{statLabel}</div>}
          <div style={cinzel({ fontWeight: 800, fontSize: 28, color: t.lite })}>{statValue}</div>
          {statSub && <div style={mono({ fontSize: 10, color: "#cdb98a" })}>{statSub}</div>}
        </div>
      )}
    </div>
  );
}

// A parchment panel/card.
export function Card({ children, style, pad = 18 }) {
  return (
    <div
      style={{
        background: C.card,
        border: "1px solid rgba(44,32,19,.22)",
        borderRadius: 8,
        boxShadow: "0 2px 10px rgba(60,40,16,.10)",
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Small uppercase mono kicker label.
export function Kicker({ children, color = C.muted, style }) {
  return (
    <div style={mono({ fontSize: 9.5, letterSpacing: ".22em", color, textTransform: "uppercase", ...style })}>
      {children}
    </div>
  );
}

// A section heading block. `accent` tints the kicker + underline rule so each
// tab reads as its own place while sharing the layout.
export function SectionTitle({ kicker, title, right, accent }) {
  const a = accent || C.goldDeep;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
      <div>
        {kicker && <Kicker color={a}>{kicker}</Kicker>}
        <div style={cinzel({ fontWeight: 700, fontSize: 26, color: C.ink, marginTop: 4 })}>{title}</div>
        <div style={{ width: 54, height: 3, marginTop: 8, borderRadius: 2, background: `linear-gradient(90deg, ${a}, transparent)` }} />
      </div>
      {right}
    </div>
  );
}

// Grid of label/value stat cards.
export function StatCards({ items, cols }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols || items.length}, minmax(0,1fr))`,
        gap: 12,
        marginBottom: 16,
      }}
    >
      {items.map((it, i) => (
        <Card key={i} pad={14}>
          <Kicker>{it.label}</Kicker>
          <div style={cinzel({ fontWeight: 700, fontSize: 22, color: it.color || C.ink, marginTop: 6 })}>{it.value}</div>
          {it.sub && <div style={serif({ fontSize: 11.5, color: it.subColor || C.muted, marginTop: 3 })}>{it.sub}</div>}
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts — lightweight themed SVG, axis-labelled, built for insight not flash.
// ---------------------------------------------------------------------------

// Line/area chart over time. points: [{ v:number, label:string }].
export function LineChart({ points, theme, height = 220, yFmt = (v) => v, valueLabel }) {
  const t = theme || THEME.dashboard;
  const pts = (points || []).filter((p) => p && isFinite(p.v));
  const n = pts.length;
  if (n < 2) return <div style={serif({ fontStyle: "normal", color: C.muted, padding: 18 })}>Not enough data yet — log a couple of points and the curve draws here.</div>;
  const vals = pts.map((p) => p.v);
  const W = 760, H = height, padL = 66, padR = 70, padT = 24, padB = 30, iw = W - padL - padR, ih = H - padT - padB;
  let min = Math.min(...vals), max = Math.max(...vals);
  const head = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
  const lo = min - head, hi = max + head;
  const X = (i) => (n <= 1 ? padL + iw / 2 : padL + (i * iw) / (n - 1));
  const Y = (v) => padT + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * ih;
  const line = vals.map((v, i) => (i === 0 ? "M" : "L") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ");
  const area = "M" + X(0).toFixed(1) + "," + (padT + ih) + " " + vals.map((v, i) => "L" + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ") + " L" + X(n - 1).toFixed(1) + "," + (padT + ih) + " Z";
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((tk) => { const val = lo + tk * (hi - lo); return { val, y: padT + (1 - tk) * ih }; });
  const k = Math.min(6, n);
  const xIdx = [...new Set(Array.from({ length: k }, (_, j) => Math.round((j * (n - 1)) / (k - 1))))];
  const lastY = Math.max(padT + 8, Math.min(padT + ih - 4, Y(vals[n - 1])));
  const gid = "lc" + Math.round(X(1));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: height + 12 }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.accent} stopOpacity="0.30" /><stop offset="100%" stopColor={t.accent} stopOpacity="0" /></linearGradient></defs>
      {yTicks.map((tk, i) => (
        <g key={i}>
          <line x1={padL} y1={tk.y} x2={W - padR} y2={tk.y} stroke="rgba(44,32,19,.13)" strokeWidth="1" strokeDasharray={i === 0 ? "" : "3 3"} />
          <text x={padL - 9} y={tk.y + 3.5} textAnchor="end" style={mono({ fontSize: 10, fill: C.muted })}>{yFmt(tk.val)}</text>
        </g>
      ))}
      {xIdx.map((idx, i) => (<text key={i} x={X(idx)} y={H - 10} textAnchor="middle" style={mono({ fontSize: 10, fill: C.muted })}>{pts[idx].label}</text>))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => (<circle key={i} cx={X(i)} cy={Y(v)} r={i === n - 1 ? 4.5 : 2.3} fill={i === n - 1 ? t.lite : t.accent} stroke="#f2e9d2" strokeWidth={i === n - 1 ? 2 : 1} />))}
      <text x={X(n - 1) + 9} y={lastY + 4} textAnchor="start" style={cinzel({ fontSize: 13, fontWeight: 700, fill: C.ink })}>{valueLabel != null ? valueLabel : yFmt(vals[n - 1])}</text>
    </svg>
  );
}

// Item / skill icon with graceful fallback to a 2-letter badge.
// `url` may be a single source or an array — each is tried in turn on load
// error before falling back to the 2-letter badge.
export function Icon({ url, name, size = 28, abbr, style }) {
  const urls = React.useMemo(() => (Array.isArray(url) ? url.filter(Boolean) : url ? [url] : []), [Array.isArray(url) ? url.join("|") : url]);
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => { setIdx(0); }, [urls]);
  const ab = abbr != null ? abbr : (name ? name.replace(/[^a-zA-Z ]/g, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() : "");
  if (idx >= urls.length) {
    return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: 6, background: "rgba(44,32,19,.10)", flex: `0 0 ${size}px`, ...mono({ fontSize: Math.max(8, size * 0.32), fontWeight: 700, color: C.muted2 }), ...style }}>{ab}</span>;
  }
  return <img src={urls[idx]} alt={name || ""} referrerPolicy="no-referrer" onError={() => setIdx(idx + 1)} style={{ width: size, height: size, objectFit: "contain", flex: `0 0 ${size}px`, ...style }} />;
}

// Donut / ring chart. segments: [{ value, color, label }].
export function Donut({ segments, size = 150, thickness = 22, centerLabel, centerValue, centerColor = C.ink }) {
  const segs = (segments || []).filter((s) => s && s.value > 0);
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(44,32,19,.10)" strokeWidth={thickness} />
      {segs.map((s, i) => { const dash = (s.value / total) * circ; const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`} strokeDashoffset={(-off).toFixed(2)} transform={`rotate(-90 ${cx} ${cy})`} />; off += dash; return el; })}
      {centerValue != null && <text x={cx} y={cy + (centerLabel ? -2 : size * 0.06)} textAnchor="middle" style={cinzel({ fontSize: size * 0.19, fontWeight: 800, fill: centerColor })}>{centerValue}</text>}
      {centerLabel && <text x={cx} y={cy + size * 0.14} textAnchor="middle" style={mono({ fontSize: size * 0.08, fill: C.muted, letterSpacing: ".08em" })}>{centerLabel}</text>}
    </svg>
  );
}

// Stacked single-row band bar (level spreads, quest status…). segments: [{ value, color, label, fg? }].
export function BandBar({ segments, height = 24, showVals = true }) {
  const segs = (segments || []).filter((s) => s && s.value > 0);
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div style={{ display: "flex", height, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(44,32,19,.15)" }}>
      {segs.map((s, i) => (
        <div key={i} title={s.label} style={{ width: (s.value / total) * 100 + "%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", ...mono({ fontSize: 11, fontWeight: 700, color: s.fg || "#f4ecd6" }) }}>{showVals && (s.value / total) > 0.05 ? s.value : ""}</div>
      ))}
    </div>
  );
}

// Horizontal bar list — HTML so labels/values stay crisp at any card width
// (unlike a scaled SVG). Supports +/- values with a centred zero line.
export function BarChartH({ data, theme, valueFmt = (v) => v, barH = 26, labelW = 132 }) {
  const t = theme || THEME.dashboard;
  const rows = (data || []).filter((d) => d && isFinite(d.v));
  if (!rows.length) return <div style={serif({ color: C.muted, padding: 12 })}>No data to chart yet.</div>;
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.v)));
  const hasNeg = rows.some((r) => r.v < 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r, i) => {
        const col = r.color || (r.v >= 0 ? t.accent : C.red);
        const frac = Math.abs(r.v) / maxAbs;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: labelW, flex: `0 0 ${labelW}px`, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...serif({ fontSize: 13.5, color: C.ink }) }} title={r.label}>{r.label}</span>
            <div style={{ flex: 1, position: "relative", height: barH, background: "rgba(44,32,19,.06)", borderRadius: 4, overflow: "hidden" }}>
              {hasNeg && <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(44,32,19,.2)" }} />}
              <div style={{ position: "absolute", top: 4, bottom: 4, borderRadius: 3, background: col, opacity: 0.9, ...(hasNeg ? (r.v >= 0 ? { left: "50%", width: `${frac * 50}%` } : { right: "50%", width: `${frac * 50}%` }) : { left: 0, width: `${frac * 100}%` }) }} />
            </div>
            <span style={{ flex: "0 0 auto", minWidth: 64, textAlign: "right", ...mono({ fontSize: 12.5, fontWeight: 600, color: col }) }}>{valueFmt(r.v)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Progress bar.
export function Bar({ pct, c1 = C.gold, c2 = C.goldBright, h = 8 }) {
  const w = typeof pct === "string" ? pct : Math.max(0, Math.min(100, pct)) + "%";
  return (
    <div style={{ height: h, background: "rgba(44,32,19,.12)", borderRadius: h, overflow: "hidden" }}>
      <div style={{ width: w, height: "100%", background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
    </div>
  );
}

// Segmented control. options: [{key,label}]; active = current key.
export function Seg({ options, active, onPick, size = 10.5 }) {
  return (
    <div style={{ display: "inline-flex" }}>
      {options.map((o, i) => {
        const on = o.key === active;
        return (
          <button
            key={o.key}
            onClick={(e) => { e.preventDefault(); onPick(o.key); }}
            style={{
              ...mono({ fontSize: size, letterSpacing: ".05em" }),
              padding: "7px 14px",
              cursor: "pointer",
              color: on ? C.ink : C.muted2,
              background: on ? "linear-gradient(180deg,#caa24e,#9a7530)" : C.card,
              border: `1px solid ${on ? C.gold : "rgba(44,32,19,.25)"}`,
              borderLeft: i === 0 ? undefined : "none",
              borderRadius: i === 0 ? "5px 0 0 5px" : i === options.length - 1 ? "0 5px 5px 0" : 0,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Status pill.
export function Tag({ children, color = C.ink, bg = "rgba(44,32,19,.08)" }) {
  return (
    <span style={mono({ fontSize: 10, fontWeight: 600, color, background: bg, padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap" })}>
      {children}
    </span>
  );
}

// Ghost / action button.
export function Btn({ children, onClick, tone = "ghost", style }) {
  const tones = {
    ghost: { color: C.ink, background: "#ddcba6", border: "1px solid rgba(44,32,19,.25)" },
    gold: { color: C.ink, background: "linear-gradient(180deg,#caa24e,#9a7530)", border: "1px solid " + C.gold },
    quiet: { color: C.muted2, background: "transparent", border: "1px solid rgba(44,32,19,.2)" },
  };
  return (
    <button
      onClick={(e) => { e.preventDefault(); onClick && onClick(e); }}
      style={{ ...mono({ fontSize: 11 }), padding: "6px 12px", borderRadius: 5, cursor: "pointer", ...tones[tone], ...style }}
    >
      {children}
    </button>
  );
}

/**
 * Generic sortable/filterable table driven by the class's buildTable() output.
 *
 * props:
 *  tableKey  - the key passed to buildTable (used for data-table attributes)
 *  model     - buildTable() result { rows, headers, shown, total, anyFilter }
 *  cols      - [{ key, cell(row)->node, align }]  cell renderers, matched by key
 *  open      - this.state.tOpen
 *  on        - { sort, openFilter, toggle, text, clear }  the class handlers
 */
export function DataTable({ tableKey, model, cols, open, on, empty = "Nothing matches." }) {
  const colByKey = Object.fromEntries(cols.map((c) => [c.key, c]));
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {model.headers.map((h) => {
                const isOpen = open === tableKey + ":" + h.key;
                return (
                  <th
                    key={h.key}
                    style={{
                      ...mono({ fontSize: 9, letterSpacing: ".1em", color: C.muted, fontWeight: 600 }),
                      textAlign: h.justify === "flex-end" ? "right" : "left",
                      padding: "8px 10px",
                      borderBottom: "2px solid rgba(44,32,19,.22)",
                      position: "relative",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      onClick={(e) => { e.preventDefault(); on.sort(tableKey, h.key); }}
                      style={{ cursor: "pointer", color: h.ind ? C.ink : undefined }}
                    >
                      {h.label}{h.ind}
                    </span>
                    {h.filterable && (
                      <span
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); on.openFilter(tableKey, h.key); }}
                        style={{ cursor: "pointer", marginLeft: 5, color: h.fcolor }}
                        title="Filter"
                      >
                        ⏷
                      </span>
                    )}
                    {isOpen && (
                      <div
                        style={{
                          position: "absolute", top: "100%", zIndex: 30,
                          [h.popPos.startsWith("right") ? "right" : "left"]: 0,
                          marginTop: 4, background: C.cardLight, border: "1px solid " + C.gold,
                          borderRadius: 6, padding: 8, minWidth: 150, boxShadow: "0 6px 18px rgba(0,0,0,.25)",
                        }}
                      >
                        {h.openText && (
                          <input
                            className="led"
                            defaultValue={h.textVal}
                            placeholder="contains…"
                            onChange={(e) => on.text(tableKey, h.key, e.currentTarget.value)}
                            style={{ width: "100%" }}
                          />
                        )}
                        {h.openEnum &&
                          h.opts.map((o) => (
                            <div
                              key={o.v}
                              onClick={(e) => { e.preventDefault(); on.toggle(tableKey, h.key, o.v); }}
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", cursor: "pointer" }}
                            >
                              <span style={{ width: 12, height: 12, borderRadius: 3, border: "1px solid " + C.gold, background: o.box }} />
                              <span style={serif({ fontSize: 13 })}>{o.label}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, ri) => (
              <tr key={ri} style={{ background: row.rowBg || "transparent" }}>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      ...serif({ fontSize: 13.5, color: C.ink }),
                      padding: "8px 10px",
                      borderBottom: "1px solid rgba(44,32,19,.08)",
                      textAlign: c.align === "right" ? "right" : "left",
                      whiteSpace: c.wrap ? "normal" : "nowrap",
                    }}
                  >
                    {colByKey[c.key].cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {model.rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} style={serif({ fontSize: 13, fontStyle: "normal", color: C.muted, padding: 18 })}>
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <span style={mono({ fontSize: 10, color: C.muted })}>
          {model.shown} of {model.total}
        </span>
        {model.anyFilter && (
          <span onClick={(e) => { e.preventDefault(); on.clear(tableKey); }} style={mono({ fontSize: 10, color: C.red, cursor: "pointer" })}>
            clear filters ✕
          </span>
        )}
      </div>
    </div>
  );
}
