// Live gp evaluation for the ACTIVITIES_DATA library (the Oracle's ground
// truth). Rows whose gp model is 'computed' or 'gather' carry a machine-
// readable `compute` block referencing items BY NAME; this service resolves
// name → id/price via the Wiki feed the app already loads (fetchPrices:
// /mapping + /latest) and returns fresh gp in each row's own `per` basis.
//
// Stay-current contract (non-negotiable): gp stays LIVE, xp stays STABLE.
//   'computed' / 'gather'  → recomputed here from live prices
//   'wiki-mmg'             → keeps its published MMG rate (tracked by mmgId,
//                            re-read when the dataset file is updated)
//   'scales' / 'estimate'  → keeps its snapshot rate
//   xp rates               → never touched by price refreshes
import { fetchPrices } from "./api.js";
import { ACTIVITIES_DATA, ACTIVITIES_META } from "../data/activitiesData.js";

const ECON = ACTIVITIES_META.economy || {};

// GE sell tax per unit: exempt under the floor, else rate, capped per item.
export function geSellNet(price) {
  const t = ECON.geTax || { rate: 0.02, capPerItem: 5e6, floor: 50 };
  if (!price || price < (t.floor || 50)) return price || 0;
  return price - Math.min(t.capPerItem || 5e6, Math.floor(price * (t.rate || 0.02)));
}

// Mid price from the feed's byName row; null when the item isn't in the feed.
function px(byName, name) {
  const r = byName[(name || "").toLowerCase()];
  if (!r) return null;
  const lo = r.low || 0, hi = r.high || 0;
  return lo && hi ? Math.round((lo + hi) / 2) : hi || lo || null;
}
function haOf(byName, name) {
  const r = byName[(name || "").toLowerCase()];
  return r ? r.highalch || 0 : null;
}

// Evaluate one row's compute block against live prices. Returns a rate in the
// row's own `per` basis (compute.ratePerHr is "actions per `per` unit" — 1 for
// herb-run's per:'run'), or null when a referenced item is missing so the
// caller keeps the snapshot.
export function evalCompute(a, byName) {
  const c = a.gp && a.gp.compute;
  if (!c) return null;
  if (c.kind === "alch") {
    // max over scan of (highalch − item price − nature rune) × casts
    const nat = px(byName, c.natureRune || "Nature rune");
    if (nat == null) return null;
    let best = null;
    (c.scan || []).forEach((n) => {
      const ha = haOf(byName, n), cost = px(byName, n);
      if (ha == null || cost == null || !ha || !cost) return;
      const m = ha - cost - nat;
      if (best == null || m > best) best = m;
    });
    return best == null ? null : Math.round(best * (c.castsPerHr || ECON.alchCastsPerHour || 1200));
  }
  if (c.kind === "process" || c.kind === "gather") {
    // per action: Σ(outputs · price, taxed on the sell side) − Σ(inputs · price) − fixed
    let per = -(c.fixedCostPerAction || 0);
    const taxed = c.kind === "gather" ? true : !!c.taxable; // gathered output is sold on the GE
    for (const o of c.outputs || []) {
      const p = px(byName, o.item);
      if (p == null) return null;
      per += (o.qty || 1) * (taxed ? geSellNet(p) : p);
    }
    for (const inp of c.inputs || []) {
      const p = px(byName, inp.item);
      if (p == null) return null;
      per -= (inp.qty || 1) * p;
    }
    return Math.round(per * (c.ratePerHr || 1));
  }
  return null;
}

// ---- cached refresh over the whole library ----
let _live = { at: 0, rates: {}, updated: 0 };

// Sync read: live rate when we have one, else the row's snapshot (same basis).
export function liveGpRate(a) {
  if (!a || !a.gp) return 0;
  const v = _live.rates[a.id];
  return v == null ? a.gp.rate || 0 : v;
}
export function liveGpAt() { return _live.at; }

// Re-evaluate every computed/gather row from the (cached) price feed.
export async function refreshActivityGp({ maxAgeMs = 15 * 60 * 1000 } = {}) {
  if (_live.at && Date.now() - _live.at < maxAgeMs) return _live;
  const { byName } = await fetchPrices({ maxAgeMs: 60_000 });
  const rates = {};
  let updated = 0;
  ACTIVITIES_DATA.forEach((a) => {
    if (!a.gp || !a.gp.compute) return;
    const v = evalCompute(a, byName);
    if (v != null) { rates[a.id] = v; updated++; }
  });
  _live = { at: Date.now(), rates, updated };
  return _live;
}
