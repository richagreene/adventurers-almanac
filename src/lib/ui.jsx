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

// A section heading block.
export function SectionTitle({ kicker, title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
      <div>
        {kicker && <Kicker color={C.goldDeep}>{kicker}</Kicker>}
        <div style={cinzel({ fontWeight: 700, fontSize: 26, color: C.ink, marginTop: 4 })}>{title}</div>
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
                <td colSpan={cols.length} style={serif({ fontSize: 13, fontStyle: "italic", color: C.muted, padding: 18 })}>
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
