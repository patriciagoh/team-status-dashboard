/* CommandView — the chosen "one-screen command" layout (Option E), made theme-aware.
   Same structure every time; only the Matcha Oat surface treatment changes.
   Themes: paper (warm default) · terminal (dark git-log surface) · editorial (serif/yolk magazine). */

const TSD_THEMES = {
  paper: {
    label: "Paper",
    pageBg: "var(--oat)", panelBg: "var(--paper)", headBg: "var(--oat)",
    text: "var(--ink)", text2: "var(--ink-2)", muted: "var(--muted)",
    border: "var(--line-2)", hair: "var(--line)",
    bandBg: "var(--matcha-tint)", bandBorder: "var(--matcha-tint-border)", bandText: "var(--matcha-deep)",
    rowHover: "#FBF9F3", expandBg: "var(--oat)", expandCard: "var(--paper)", expandBorder: "var(--line)",
    barTrack: "var(--paper)", barBorder: "var(--line-2)", shadow: "var(--shadow-card)",
    avatarBg: "var(--paper)", avatarText: "var(--ink-2)",
    low: "var(--matcha-deep)", ticket: "var(--matcha-deep)",
    toneInk: "var(--ink)", toneYolk: "var(--yolk-deep)", toneRust: "var(--rust-deep)", toneMatcha: "var(--matcha-deep)",
    headRule: "var(--line-2)", titleSlash: "var(--muted)",
  },
  terminal: {
    label: "Terminal",
    pageBg: "#1B1A14", panelBg: "#26241D", headBg: "#211F18",
    text: "#F3EFE3", text2: "#CFC8B4", muted: "#908A74",
    border: "#3B382D", hair: "#322F26",
    bandBg: "#2F2C22", bandBorder: "#3B382D", bandText: "#BFCBA6",
    rowHover: "#2D2B21", expandBg: "#201E17", expandCard: "#2B2920", expandBorder: "#3B382D",
    barTrack: "#322F26", barBorder: "#3B382D", shadow: "0 18px 40px rgba(0,0,0,0.40)",
    avatarBg: "#2B2920", avatarText: "#E7E1D0",
    low: "#BFCBA6", ticket: "#BFCBA6",
    toneInk: "#F3EFE3", toneYolk: "#E8B23C", toneRust: "#E08266", toneMatcha: "#BFCBA6",
    headRule: "#3B382D", titleSlash: "#908A74",
  },
  editorial: {
    label: "Editorial",
    pageBg: "var(--oat)", panelBg: "var(--paper)", headBg: "#FFFDF7",
    text: "var(--ink)", text2: "var(--ink-2)", muted: "var(--muted)",
    border: "var(--line-2)", hair: "var(--line)",
    bandBg: "transparent", bandBorder: "transparent", bandText: "var(--ink)",
    rowHover: "#FCF7EA", expandBg: "#FFFDF7", expandCard: "var(--oat)", expandBorder: "var(--line)",
    barTrack: "var(--paper)", barBorder: "var(--line-2)", shadow: "var(--shadow-card)",
    avatarBg: "var(--paper)", avatarText: "var(--ink-2)",
    low: "var(--matcha-deep)", ticket: "var(--matcha-deep)",
    toneInk: "var(--ink)", toneYolk: "var(--yolk-deep)", toneRust: "var(--rust-deep)", toneMatcha: "var(--matcha-deep)",
    headRule: "var(--ink)", titleSlash: "var(--muted)",
  },
};

function CommandView({ theme = "paper" }) {
  const T = window.TSD;
  const tk = TSD_THEMES[theme] || TSD_THEMES.paper;
  const ed = theme === "editorial";
  const onPlan = T.counts.planned || 0;

  /* ---- themed inline bits (capture tk) ---- */
  const What = ({ person, size = 13.5 }) => {
    const low = person.conf === "low";
    return (
      <span style={{
        font: low ? `400 italic ${size}px/1.35 var(--serif)` : `400 ${size}px/1.35 var(--sans)`,
        color: low ? tk.low : tk.text,
      }}>
        {low && <span style={{ color: tk.muted, fontStyle: "italic" }}>~ </span>}{person.what}
      </span>
    );
  };
  const Since = ({ person }) => {
    if (!person.since) return <span style={{ font: "400 11px/1 var(--mono)", color: tk.muted }}>no change</span>;
    const isNew = /new this snapshot/i.test(person.since);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "700 11px/1.4 var(--mono)", color: tk.text2 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", flex: "0 0 auto", background: isNew ? "var(--matcha)" : "var(--yolk)" }} />
        {person.since}
      </span>
    );
  };
  const ConfTag = ({ person }) => person.conf !== "low" ? null : (
    <span style={{
      font: "600 10px/1 var(--sans)", letterSpacing: "0.08em", textTransform: "uppercase",
      color: tk.muted, border: `1px dashed ${tk.border}`, borderRadius: "var(--r-pill)", padding: "3px 8px", whiteSpace: "nowrap",
    }}>inferred · low confidence</span>
  );

  const StatTile = ({ big, label, tone }) => {
    const color = tone === "rust" ? tk.toneRust : tone === "yolk" ? tk.toneYolk : tk.toneInk;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ font: "700 38px/1 var(--sans)", letterSpacing: "-0.03em", color }}>{big}</span>
        <span style={{ font: "600 10.5px/1.2 var(--sans)", letterSpacing: "0.1em", textTransform: "uppercase", color: tk.muted }}>{label}</span>
      </div>
    );
  };

  const TeamMini = ({ team }) => {
    const c = {};
    team.people.forEach((p) => (c[p.cat] = (c[p.cat] || 0) + 1));
    const off = team.people.filter((p) => ["incident", "unplanned"].includes(p.cat)).length;
    return (
      <div
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = tk.shadow; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
        style={{ background: tk.panelBg, border: `1px solid ${tk.border}`, borderRadius: "var(--r-lg)", padding: "16px 18px", boxShadow: "none", transition: "transform .2s, box-shadow .2s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ font: "400 17px/1 var(--serif)", color: tk.text, letterSpacing: "-0.01em" }}>{team.name}</span>
          <span style={{ font: "700 11px/1 var(--mono)", color: tk.muted }}>{team.people.length}</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
          {window.TSD.CAT_ORDER.map((k) => {
            const n = c[k] || 0; if (!n) return null;
            const sig = k === "incident" ? "var(--rust-deep)" : k === "unplanned" ? "var(--yolk-deep)" : k === "planned" ? "var(--matcha-deep)" : tk.text2;
            return (
              <span key={k} style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ font: "700 12px/1 var(--mono)", color: sig }}>{n}</span>
                <span style={{ font: "400 11px/1.2 var(--sans)", color: tk.muted }}>{window.TSDcat(k).label.toLowerCase()}</span>
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${tk.hair}`, font: "700 10.5px/1 var(--mono)", color: off ? tk.toneRust : "var(--matcha-deep)" }}>
          {off ? `${off} off-plan` : "all on plan"}
        </div>
      </div>
    );
  };

  const Row = ({ person, idx, last }) => {
    const [open, setOpen] = React.useState(false);
    const d = person.detail || { tickets: [], note: "" };
    const wash = "linear-gradient(90deg, rgba(232,178,60,0.16), rgba(232,178,60,0) 60%)";
    return (
      <div style={{ borderBottom: last && !open ? "none" : `1px solid ${tk.hair}`, overflow: "hidden" }}>
        <div
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "grid", gridTemplateColumns: "34px 196px 1fr 132px 150px 86px", gap: 16, alignItems: "center",
            padding: ed ? "13px 16px" : "11px 16px", cursor: "pointer",
            background: open ? tk.rowHover : "transparent", backgroundImage: "none",
            transform: "none", transition: "transform .22s, background .22s",
          }}
          onMouseEnter={(e) => { if (!open) { e.currentTarget.style.background = wash; e.currentTarget.style.transform = "translateX(5px)"; const a = e.currentTarget.querySelector(".tsd-arr"); if (a) a.style.opacity = "1"; } }}
          onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "none"; const a = e.currentTarget.querySelector(".tsd-arr"); if (a) a.style.opacity = "0"; } }}
        >
          <span style={{ font: "400 12.5px/1 var(--mono)", color: tk.muted, fontVariantNumeric: "tabular-nums" }}>{String(idx).padStart(2, "0")}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Avatar person={person} size={26} bg={tk.avatarBg} text={tk.avatarText} />
            <span style={{ font: "500 15px/1.1 var(--serif)", color: tk.text, whiteSpace: "nowrap" }}>{person.name}</span>
            <span style={{ font: "400 10px/1 var(--mono)", color: tk.muted }}>{person.role}</span>
          </div>
          <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><What person={person} /></div>
          <CatChip k={person.cat} />
          <div style={{ minWidth: 0 }}><Since person={person} /></div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <span style={{ font: "700 11px/1 var(--mono)", color: tk.ticket, textAlign: "right" }}>{person.ticket || "—"}</span>
            <span className="tsd-arr" style={{ font: "400 13px/1 var(--mono)", color: "var(--matcha-deep)", opacity: 0, transition: "opacity .2s", flex: "0 0 auto" }}>{open ? "⌄" : "→"}</span>
          </div>
        </div>
        {open && (
          <div style={{ padding: "4px 14px 18px 52px", background: tk.expandBg }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, background: tk.expandCard, border: `1px solid ${tk.expandBorder}`, borderRadius: "var(--r-sm)", padding: "15px 18px" }}>
              <div>
                <div style={{ font: "600 10px/1 var(--sans)", letterSpacing: "0.13em", textTransform: "uppercase", color: tk.muted, marginBottom: 10 }}>Open items</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {d.tickets.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--matcha)", flex: "0 0 auto" }} />
                      <span style={{ font: "400 13px/1.4 var(--mono)", color: tk.text2 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ background: "var(--yolk-tint)", border: "1px solid #EAD9AE", borderRadius: "var(--r-sm)", padding: "13px 16px" }}>
                  <div style={{ font: "700 10.5px/1 var(--sans)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--yolk-deep)", marginBottom: 8 }}>Why</div>
                  <div style={{ font: "400 14.5px/1.55 var(--sans)", color: "var(--yolk-tint-text)" }}>{d.note}</div>
                </div>
                {person.conf === "low" && <div style={{ marginTop: 12 }}><ConfTag person={person} /></div>}
                <button
                  onMouseEnter={(e) => { const a = e.currentTarget.querySelector("i"); if (a) a.style.transform = "translateX(4px)"; }}
                  onMouseLeave={(e) => { const a = e.currentTarget.querySelector("i"); if (a) a.style.transform = "none"; }}
                  style={{ marginTop: 14, font: "600 12px/1 var(--sans)", color: "var(--matcha-deep)", background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  Correct {person.name.split(" ")[0]}'s row
                  <i style={{ fontStyle: "normal", transition: "transform .2s", display: "inline-block" }}>→</i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: tk.pageBg, padding: "38px 48px 44px", fontFamily: "var(--sans)" }}>
      {/* header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: ed ? "flex-end" : "center" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{
            font: ed ? "400 32px/1 var(--serif)" : "400 26px/1 var(--serif)", letterSpacing: "-0.02em", color: tk.text, margin: 0, whiteSpace: "nowrap",
            paddingBottom: ed ? 4 : 0, borderBottom: ed ? "3px solid var(--yolk)" : "none",
          }}>Team status</h1>
          <span style={{ font: "400 12px/1 var(--mono)", color: tk.titleSlash }}>/ engineering · {T.total} people</span>
        </div>
        {ed ? (
          <div style={{ transform: "rotate(-1.5deg)", background: "rgba(232,178,60,0.42)", padding: "8px 16px", borderRadius: 2 }}>
            <span style={{ font: "700 12px/1.4 var(--mono)", color: "var(--ink)" }}>Snapshot · {T.SNAPSHOT.day.split(",")[0]} {T.SNAPSHOT.time}</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span className="tsd-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--matcha)" }} />
              <span style={{ font: "700 12px/1 var(--mono)", color: tk.text2 }}>Snapshot · {T.SNAPSHOT.day.split(",")[0]} {T.SNAPSHOT.time}</span>
            </span>
            <span style={{ font: "400 12px/1 var(--mono)", color: tk.muted }}>next refresh {T.SNAPSHOT.next}</span>
          </div>
        )}
      </header>

      {/* summary strip */}
      <section style={{ marginTop: 26, display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 34, paddingRight: 34, borderRight: `1px solid ${tk.border}` }}>
          <StatTile big={onPlan} label="on plan" />
          <StatTile big={T.offPlan.length - T.firefighting.length} label="off plan" tone="yolk" />
          <StatTile big={T.firefighting.length} label="firefighting" tone="rust" />
          <StatTile big={T.changed.length} label="changed" />
        </div>
        <div>
          <div style={{ font: "600 10px/1 var(--sans)", letterSpacing: "0.13em", textTransform: "uppercase", color: tk.muted, marginBottom: 12 }}>Where the effort is going</div>
          <div style={{ display: "flex", flexWrap: "wrap", borderTop: `1px solid ${tk.hair}`, borderBottom: `1px solid ${tk.hair}` }}>
            {T.CAT_ORDER.map((k) => {
              const n = T.counts[k] || 0; if (!n) return null;
              const c = window.TSDcat(k);
              const sig = k === "incident" ? tk.toneRust : k === "unplanned" ? tk.toneYolk : k === "planned" ? tk.toneMatcha : tk.text;
              return (
                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 7, padding: "13px 22px 13px 0", marginRight: 22, borderRight: `1px solid ${tk.hair}` }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ font: "700 24px/1 var(--sans)", letterSpacing: "-0.03em", color: sig }}>{n}</span>
                    <span style={{ font: "400 11px/1 var(--mono)", color: tk.muted }}>{Math.round((n / T.total) * 100)}%</span>
                  </span>
                  <span style={{ font: "600 10.5px/1 var(--sans)", letterSpacing: "0.1em", textTransform: "uppercase", color: tk.muted }}>{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* table */}
      <section style={{ marginTop: 24, background: tk.panelBg, border: `1px solid ${tk.border}`, borderRadius: "var(--r-xl)", overflow: "hidden", boxShadow: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "34px 196px 1fr 132px 150px 86px", gap: 16, padding: "11px 16px", background: tk.headBg, borderBottom: `1px solid ${tk.border}` }}>
          <span style={{ font: "600 10px/1 var(--sans)", letterSpacing: "0.12em", textTransform: "uppercase", color: tk.muted }}>#</span>
          {["Person", "Working on", "Why", "Since last look", "Ticket"].map((h, i) => (
            <span key={i} style={{ font: "600 10px/1 var(--sans)", letterSpacing: "0.12em", textTransform: "uppercase", color: tk.muted, textAlign: i === 4 ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        {T.TEAMS.map((team, ti) => {
          const tc = {};
          team.people.forEach((p) => (tc[p.cat] = (tc[p.cat] || 0) + 1));
          const off = team.people.filter((p) => ["incident", "unplanned"].includes(p.cat)).length;
          const tally = (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 14px" }}>
              {window.TSD.CAT_ORDER.map((k) => {
                const n = tc[k] || 0; if (!n) return null;
                const sig = k === "incident" ? tk.toneRust : k === "unplanned" ? tk.toneYolk : k === "planned" ? tk.toneMatcha : tk.text2;
                return (
                  <span key={k} style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ font: "700 13px/1 var(--mono)", color: sig }}>{n}</span>
                    <span style={{ font: "400 11.5px/1 var(--sans)", color: tk.muted }}>{window.TSDcat(k).label.toLowerCase()}</span>
                  </span>
                );
              })}
            </div>
          );
          const offCallout = (
            <span style={{ font: "700 11px/1 var(--mono)", color: off ? tk.toneRust : tk.toneMatcha, whiteSpace: "nowrap" }}>
              {off ? `${off} off-plan` : "all on plan"}
            </span>
          );
          return (
            <div key={ti}>
              <div style={{
                display: "flex", alignItems: "center", gap: 18, padding: "15px 16px 14px",
                background: tk.headBg, borderTop: ti > 0 ? `1px solid ${tk.border}` : "none",
                borderBottom: `1px solid ${tk.hair}`,
              }}>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 9, whiteSpace: "nowrap" }}>
                  {ed
                    ? <span style={{ font: "400 20px/1 var(--serif)", color: tk.text, letterSpacing: "-0.01em", borderBottom: "2px solid var(--yolk)", paddingBottom: 3 }}>{team.name}</span>
                    : <span style={{ font: "700 12px/1 var(--sans)", letterSpacing: "0.14em", textTransform: "uppercase", color: tk.bandText }}>{team.name}</span>}
                  <span style={{ font: "400 11px/1 var(--mono)", color: tk.muted }}>{team.people.length}</span>
                </span>
                {tally}
                <span style={{ flex: 1, minWidth: 12, height: 1, background: tk.hair }} />
                {offCallout}
              </div>
              {team.people.map((p, i) => <Row key={i} person={p} idx={i + 1} last={ti === T.TEAMS.length - 1 && i === team.people.length - 1} />)}
            </div>
          );
        })}
      </section>
    </div>
  );
}

window.CommandView = CommandView;
window.TSD_THEMES = TSD_THEMES;
