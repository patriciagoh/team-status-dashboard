/* Mock roster — fictional, on-brand demo data (mirrors the tool's --demo mode).
   No real people. Exposed as window.TSD. */
(function () {
  // calm -> urgent ordering is intentional (drives the effort spectrum)
  const CATEGORIES = {
    planned:   { key: "planned",   label: "Planned",   dot: "var(--dot-planned)",   order: 0, signal: "calm",    blurb: "On the roadmap / current cycle" },
    adhoc:     { key: "adhoc",     label: "Ad-hoc",    dot: "var(--dot-adhoc)",     order: 1, signal: "calm",    blurb: "No-ticket request, picked up directly" },
    lent:      { key: "lent",      label: "Lent-out",  dot: "var(--dot-lent)",      order: 2, signal: "neutral", blurb: "Helping another team this cycle" },
    support:   { key: "support",   label: "Support",   dot: "var(--dot-support)",   order: 3, signal: "neutral", blurb: "Customer escalation / on rotation" },
    unplanned: { key: "unplanned", label: "Unplanned", dot: "var(--dot-unplanned)", order: 4, signal: "attn",    blurb: "Off-plan work that appeared this cycle" },
    incident:  { key: "incident",  label: "Incident",  dot: "var(--dot-incident)",  order: 5, signal: "urgent",  blurb: "Active incident / outage response" },
  };

  // p() helper: person record
  function p(name, initials, role, cat, conf, what, ticket, since, detail) {
    return { name, initials, role, cat, conf, what, ticket, since, detail };
  }

  const TEAMS = [
    {
      name: "Platform",
      lead: "Maya R.",
      people: [
        p("Maya R.", "MR", "EM", "planned", "high", "Multi-region failover runbook + drills", "PLAT-412",
          null, { tickets: ["PLAT-412 Failover runbook", "PLAT-409 Drill scheduling"], note: "Cycle 24 commitment." }),
        p("Devin O.", "DO", "Sr. Eng", "incident", "high", "DB connection pool exhaustion — prod", "INC-2208",
          "moved off PLAT-401 → incident", { tickets: ["INC-2208 Pool exhaustion (sev2)", "PLAT-401 Query planner (paused)"], note: "Paged 08:14. Sev2, mitigated, RCA pending." }),
        p("Priya N.", "PN", "Eng", "planned", "high", "GraphQL schema federation rollout", "PLAT-388",
          null, { tickets: ["PLAT-388 Federation gateway", "PLAT-390 Schema lint CI"], note: "On track, review Thu." }),
        p("Tomas B.", "TB", "Sr. Eng", "unplanned", "low", "Likely the OOM crashes — recent commits to memcache", "PLAT-431",
          "new this snapshot", { tickets: ["PLAT-431 Memcache OOM? (inferred)"], note: "Inferred from commit activity; not on the board. Tomas can correct this." }),
        p("Wen L.", "WL", "Eng", "planned", "high", "Tracing spans for the ingest path", "PLAT-377",
          null, { tickets: ["PLAT-377 OTel ingest spans"], note: "Steady." }),
        p("Ade K.", "AK", "Staff", "support", "high", "Enterprise customer latency escalation", "SUP-1190",
          "moved off PLAT-360 → support", { tickets: ["SUP-1190 Acme latency", "PLAT-360 Caching layer (paused)"], note: "On support rotation through Fri." }),
        p("Greta S.", "GS", "Eng", "planned", "high", "Config service read-replica cutover", "PLAT-402",
          null, { tickets: ["PLAT-402 Read-replica cutover"], note: "Cutover staged for next cycle." }),
      ],
    },
    {
      name: "Payments",
      lead: "Hassan I.",
      people: [
        p("Hassan I.", "HI", "EM", "planned", "high", "Dispute-handling redesign — discovery", "PAY-301",
          null, { tickets: ["PAY-301 Disputes discovery"], note: "Discovery, specs by EOW." }),
        p("Lucia M.", "LM", "Sr. Eng", "incident", "high", "Payout webhook backlog — retries stuck", "INC-2210",
          "moved off PAY-288 → incident", { tickets: ["INC-2210 Webhook retries (sev3)", "PAY-288 Refund flow (paused)"], note: "Paged 09:31. Backlog draining." }),
        p("Owen P.", "OP", "Eng", "planned", "high", "3DS2 step-up flow", "PAY-294",
          null, { tickets: ["PAY-294 3DS2 step-up"], note: "In review." }),
        p("Sara T.", "ST", "Eng", "support", "high", "Chargeback false-positive escalation", "SUP-1188",
          null, { tickets: ["SUP-1188 Chargeback FP"], note: "On rotation." }),
        p("Niko V.", "NV", "Sr. Eng", "planned", "high", "Ledger reconciliation perf", "PAY-276",
          null, { tickets: ["PAY-276 Ledger recon perf"], note: "Steady." }),
        p("Bea C.", "BC", "Eng", "unplanned", "high", "Hotfix: rounding error on JPY invoices", "PAY-310",
          "new this snapshot", { tickets: ["PAY-310 JPY rounding hotfix"], note: "Self-reported; off-plan but urgent." }),
        p("Felix A.", "FA", "Eng", "lent", "high", "Lent to Growth — checkout experiment", "GRO-145",
          "moved off PAY-281 → lent-out", { tickets: ["GRO-145 Checkout A/B (Growth)", "PAY-281 (returns next cycle)"], note: "Lent to Growth for the cycle." }),
      ],
    },
    {
      name: "Growth",
      lead: "Renata D.",
      people: [
        p("Renata D.", "RD", "EM", "planned", "high", "Activation funnel instrumentation", "GRO-140",
          null, { tickets: ["GRO-140 Funnel events"], note: "On plan." }),
        p("Ivan Z.", "IZ", "Eng", "planned", "high", "Onboarding checklist redesign", "GRO-138",
          null, { tickets: ["GRO-138 Checklist v2"], note: "In build." }),
        p("Mei H.", "MH", "Sr. Eng", "adhoc", "low", "Possibly the board exec dashboard ask", null,
          "new this snapshot", { tickets: ["No ticket — Slack #growth-leads thread"], note: "Picked up from Slack; no ticket yet. Low confidence." }),
        p("Cole W.", "CW", "Eng", "planned", "high", "Referral reward ledger", "GRO-142",
          null, { tickets: ["GRO-142 Referral ledger"], note: "Steady." }),
        p("Anya P.", "AP", "Eng", "unplanned", "high", "Pricing-page experiment pulled forward", "GRO-149",
          "new this snapshot", { tickets: ["GRO-149 Pricing A/B"], note: "Pulled forward by leadership ask." }),
        p("Diego R.", "DR", "Eng", "planned", "high", "Lifecycle email service", "GRO-133",
          null, { tickets: ["GRO-133 Lifecycle emails"], note: "On track." }),
      ],
    },
    {
      name: "Mobile",
      lead: "Yuki N.",
      people: [
        p("Yuki N.", "YN", "EM", "planned", "high", "App-size budget + startup trace", "MOB-220",
          null, { tickets: ["MOB-220 Startup trace"], note: "On plan." }),
        p("Sam E.", "SE", "Sr. Eng", "planned", "high", "Offline-first sync engine", "MOB-211",
          null, { tickets: ["MOB-211 Offline sync"], note: "Big rock, on track." }),
        p("Lila F.", "LF", "Eng", "support", "low", "Maybe the crash spike triage — Sentry assigned", "MOB-231",
          "new this snapshot", { tickets: ["MOB-231 Crash triage (inferred)"], note: "Inferred from Sentry assignment. Lila can correct." }),
        p("Omar G.", "OG", "Eng", "planned", "high", "Biometric re-auth flow", "MOB-204",
          null, { tickets: ["MOB-204 Biometric re-auth"], note: "In review." }),
        p("Petra K.", "PK", "Eng", "adhoc", "high", "App Store screenshots + release notes", null,
          null, { tickets: ["No ticket — release chore"], note: "Release week chore." }),
        p("Theo M.", "TM", "Eng", "planned", "high", "Push notification preferences", "MOB-218",
          null, { tickets: ["MOB-218 Push prefs"], note: "Steady." }),
      ],
    },
  ];

  const SNAPSHOT = {
    day: "Tuesday, June 3, 2026",
    time: "9:02 AM ET",
    prev: "yesterday, 2:00 PM",
    next: "2:00 PM ET",
    slackConnected: true,
  };

  // flatten + counts
  const ALL = [];
  TEAMS.forEach((t) => t.people.forEach((pe) => ALL.push(Object.assign({ team: t.name }, pe))));
  const counts = {};
  Object.keys(CATEGORIES).forEach((k) => (counts[k] = 0));
  ALL.forEach((pe) => (counts[pe.cat] = (counts[pe.cat] || 0) + 1));
  const changed = ALL.filter((pe) => pe.since);
  const offPlan = ALL.filter((pe) => ["incident", "unplanned"].includes(pe.cat));
  const firefighting = ALL.filter((pe) => pe.cat === "incident");

  window.TSD = {
    CATEGORIES,
    CAT_ORDER: Object.values(CATEGORIES).sort((a, b) => a.order - b.order).map((c) => c.key),
    TEAMS,
    ALL,
    counts,
    total: ALL.length,
    changed,
    offPlan,
    firefighting,
    SNAPSHOT,
  };
})();
