/* Shared building blocks for all five dashboard directions.
   Token-driven (var(--…) from tokens.css). Exported to window at the end. */

const T = window.TSD;
const cat = (k) => T.CATEGORIES[k];

/* ---- Section eyebrow: tracked uppercase label preceded by a matcha rule ---- */
function Eyebrow({ children, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 24, height: 1.5, background: color || "var(--matcha)", flex: "0 0 auto" }} />
      <span style={{
        font: "600 12.5px/1 var(--sans)", letterSpacing: "0.2em", textTransform: "uppercase",
        color: color || "var(--matcha-deep)", whiteSpace: "nowrap",
      }}>{children}</span>
    </div>
  );
}

/* ---- Category dot + label (Matcha Oat language-dot pattern; hue never the only cue) ---- */
function CatDot({ k, size = 8, withLabel = true, style }) {
  const c = cat(k);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, ...style }}>
      <span style={{ width: size, height: size, borderRadius: "50%", background: c.dot, flex: "0 0 auto" }} />
      {withLabel && <span style={{ font: "500 12px/1 var(--sans)", color: "var(--ink-2)" }}>{c.label}</span>}
    </span>
  );
}

/* ---- Category chip — color FIELD reserved for the urgent signals ---- */
function chipStyle(k) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 7, borderRadius: "var(--r-pill)",
    padding: "5px 13px 5px 11px", font: "700 12px/1.4 var(--mono)", letterSpacing: "0",
    border: "1px solid transparent", whiteSpace: "nowrap",
  };
  if (k === "incident") return { ...base, background: "var(--rust-tint)", color: "var(--rust-deep)", borderColor: "var(--rust-tint-border)" };
  if (k === "unplanned") return { ...base, background: "var(--yolk-tint)", color: "var(--yolk-tint-text)", borderColor: "#EAD9AE" };
  if (k === "support") return { ...base, background: "#EDEADD", color: "#6C6647", borderColor: "#DCD6C3" };
  if (k === "lent") return { ...base, background: "#F1EFE9", color: "var(--ink-2)", borderColor: "var(--line-2)" };
  // planned, ad-hoc -> quiet matcha/neutral
  if (k === "planned") return { ...base, background: "var(--matcha-tint)", color: "var(--matcha-deep)", borderColor: "var(--matcha-tint-border)" };
  return { ...base, background: "var(--paper)", color: "var(--ink-2)", borderColor: "var(--line-2)" };
}
function CatChip({ k }) {
  const c = cat(k);
  return (
    <span style={chipStyle(k)}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flex: "0 0 auto" }} />
      {c.label}
    </span>
  );
}

/* ---- Confidence: low-confidence guesses render tentative (italic serif), with a marker ---- */
function What({ person, size = 16 }) {
  const low = person.conf === "low";
  return (
    <span style={{
      font: low ? `400 italic ${size}px/1.35 var(--serif)` : `400 ${size}px/1.35 var(--sans)`,
      color: low ? "var(--matcha-deep)" : "var(--ink)",
    }}>
      {low && <span style={{ color: "var(--muted)", fontStyle: "italic" }}>~ </span>}
      {person.what}
    </span>
  );
}
function ConfTag({ person }) {
  if (person.conf !== "low") return null;
  return (
    <span style={{
      font: "600 10px/1 var(--sans)", letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--muted)", border: "1px dashed var(--line-2)", borderRadius: "var(--r-pill)",
      padding: "3px 8px", whiteSpace: "nowrap",
    }}>inferred · low confidence</span>
  );
}

/* ---- Since-you-last-looked diff note ---- */
function SinceNote({ person, align = "left" }) {
  if (!person.since) return null;
  const isNew = /new this snapshot/i.test(person.since);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      font: "700 11px/1.4 var(--mono)", color: "var(--ink-2)", textAlign: align,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", flex: "0 0 auto",
        background: isNew ? "var(--matcha)" : "var(--yolk)",
      }} />
      <span>{person.since}</span>
    </span>
  );
}

/* ---- Avatar (initials, privacy-light) ---- */
function Avatar({ person, size = 34, bg = "var(--paper)", text = "var(--ink-2)" }) {
  const c = cat(person.cat);
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", flex: "0 0 auto",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: bg, border: `1.5px solid ${c.dot}`,
      font: `700 ${Math.round(size * 0.33)}px/1 var(--mono)`, color: text,
      letterSpacing: "0.02em",
    }}>{person.initials}</span>
  );
}

/* ---- Distribution bar — stacked, calm -> urgent, the "where effort goes" hero ---- */
function DistributionBar({ counts, total, height = 16, rounded = true, trackBg = "var(--paper)", borderColor = "var(--line-2)" }) {
  const order = T.CAT_ORDER;
  return (
    <div style={{ width: "100%" }}>
      <div style={{
        display: "flex", width: "100%", height, borderRadius: rounded ? "var(--r-pill)" : 4,
        overflow: "hidden", border: `1px solid ${borderColor}`, background: trackBg,
      }}>
        {order.map((k) => {
          const n = counts[k] || 0;
          if (!n) return null;
          return (
            <div key={k} title={`${cat(k).label}: ${n}`} style={{
              flex: `${n} 0 0`, background: cat(k).dot,
              opacity: (k === "planned") ? 0.82 : 0.92,
            }} />
          );
        })}
      </div>
    </div>
  );
}

/* ---- Unit chart — one dot per person, grouped calm -> urgent.
     Each dot is a teammate, so proportion reads honestly without a loud bar. ---- */
function UnitDots({ people, size = 10, gap = 5, groupGap = 12 }) {
  const order = window.TSD.CAT_ORDER;
  const sorted = [...people].sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: `${gap}px`, alignItems: "center" }}>
      {sorted.map((p, i) => {
        const prev = sorted[i - 1];
        const newGroup = prev && prev.cat !== p.cat;
        return (
          <span key={i} title={`${p.name} — ${cat(p.cat).label}`} style={{
            width: size, height: size, borderRadius: "50%", flex: "0 0 auto",
            background: cat(p.cat).dot, marginLeft: newGroup ? groupGap : 0,
          }} />
        );
      })}
    </div>
  );
}

/* ---- Legend row for the distribution ---- */
function DistLegend({ counts, total, gap = 18 }) {
  const order = T.CAT_ORDER;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: `8px ${gap}px`, alignItems: "center" }}>
      {order.map((k) => {
        const n = counts[k] || 0;
        if (!n) return null;
        const pct = Math.round((n / total) * 100);
        return (
          <span key={k} style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat(k).dot, alignSelf: "center" }} />
            <span style={{ font: "500 12.5px/1 var(--sans)", color: "var(--ink-2)" }}>{cat(k).label}</span>
            <span style={{ font: "700 12.5px/1 var(--mono)", color: "var(--ink)" }}>{n}</span>
            <span style={{ font: "400 11px/1 var(--mono)", color: "var(--muted)" }}>{pct}%</span>
          </span>
        );
      })}
    </div>
  );
}

/* ---- Snapshot freshness meta ---- */
function SnapshotMeta({ light }) {
  const s = T.SNAPSHOT;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--matcha)" }} />
        <span style={{ font: "700 12px/1 var(--mono)", color: light ? "var(--oat)" : "var(--ink-2)" }}>
          Snapshot · {s.day.split(",")[0]} {s.time}
        </span>
      </span>
      <span style={{ font: "400 12px/1 var(--mono)", color: light ? "rgba(250,247,239,0.7)" : "var(--muted)" }}>
        next refresh {s.next}
      </span>
    </div>
  );
}

Object.assign(window, {
  Eyebrow, CatDot, CatChip, chipStyle, What, ConfTag, SinceNote,
  Avatar, DistributionBar, UnitDots, DistLegend, SnapshotMeta, TSDcat: cat,
});
