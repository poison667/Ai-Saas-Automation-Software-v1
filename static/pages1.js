/* ============ Pages: Dashboard · AI Generator · Posts · Calendar ============ */
"use strict";

/* ---------------- chart helpers ---------------- */
function sparkline(values, w = 120, h = 36, color = "#8b5cf6") {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`).join(" ");
  return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function smoothPath(pts) {
  if (pts.length < 3) return "M" + pts.map(p => p.join(" ")).join(" L ");
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function renderAreaChart(container, data, { color = "#8b5cf6", label = "Value", fmt = fmtNum } = {}) {
  const W = 760, H = 240, PL = 44, PR = 12, PT = 14, PB = 26;
  if (!data || data.length < 2) {
    container.innerHTML = `<div class="empty" style="padding:30px"><p class="muted">Not enough data yet.</p></div>`;
    return;
  }
  const values = data.map(d => d.value);
  const max = Math.max(...values) * 1.12 || 1;
  const X = i => PL + (i / (data.length - 1)) * (W - PL - PR);
  const Y = v => PT + (1 - v / max) * (H - PT - PB);
  const pts = values.map((v, i) => [X(i), Y(v)]);
  const line = smoothPath(pts);
  const area = line + ` L ${X(data.length - 1)} ${H - PB} L ${X(0)} ${H - PB} Z`;
  const gid = "g" + Math.random().toString(36).slice(2, 8);
  let grid = "";
  for (let g = 0; g <= 3; g++) {
    const y = PT + (g / 3) * (H - PT - PB);
    const val = max * (1 - g / 3);
    grid += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="rgba(255,255,255,.05)"/>
             <text x="${PL - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#6b7284">${fmt(val)}</text>`;
  }
  const ticks = [0, Math.floor((data.length - 1) / 2), data.length - 1]
    .map(i => `<text x="${X(i)}" y="${H - 7}" text-anchor="middle" font-size="10.5" fill="#6b7284">${esc(data[i].label)}</text>`).join("");
  container.innerHTML = `
    <div class="chart-box">
      <svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${color}" stop-opacity=".32"/>
          <stop offset="1" stop-color="${color}" stop-opacity="0"/>
        </linearGradient></defs>
        ${grid}
        <path d="${area}" fill="url(#${gid})"/>
        <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <circle class="hover-dot" r="4.5" fill="${color}" stroke="#0a0c12" stroke-width="2" style="display:none"/>
        ${ticks}
      </svg>
      <div class="chart-tip"></div>
    </div>`;
  const svg = container.querySelector("svg");
  const dot = container.querySelector(".hover-dot");
  const tip = container.querySelector(".chart-tip");
  svg.addEventListener("mousemove", e => {
    const r = svg.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    const vx = frac * W;
    let idx = Math.round(((vx - PL) / (W - PL - PR)) * (data.length - 1));
    idx = Math.max(0, Math.min(data.length - 1, idx));
    dot.style.display = "";
    dot.setAttribute("cx", X(idx)); dot.setAttribute("cy", Y(values[idx]));
    tip.style.display = "block";
    tip.innerHTML = `<b>${fmt(values[idx])}</b><span>${esc(data[idx].label)} · ${esc(label)}</span>`;
    tip.style.left = (X(idx) / W) * 100 + "%";
    tip.style.top = (Y(values[idx]) / H) * 100 + "%";
  });
  svg.addEventListener("mouseleave", () => { dot.style.display = "none"; tip.style.display = "none"; });
}

function renderDonut(container, segments, { centerLabel = "" } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) { container.innerHTML = `<div class="empty" style="padding:30px"><p class="muted">No data yet.</p></div>`; return; }
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  const rings = segments.map(s => {
    const frac = s.value / total;
    const el = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${s.color}" stroke-width="16"
      stroke-dasharray="${frac * C - 2} ${C - frac * C + 2}" stroke-dashoffset="${-offset * C}"
      transform="rotate(-90 70 70)" stroke-linecap="butt"/>`;
    offset += frac;
    return el;
  }).join("");
  const legend = segments.map(s => {
    const swatch = `<span class="sw" style="background:${s.color}"></span>`;
    if (s.platform) return `<div class="dl">${swatch}${platIcon(s.platform, 11)} ${PLATFORMS[s.platform]?.name || esc(s.label)}<b>${fmtNum(s.value)}</b></div>`;
    return `<div class="dl">${swatch}<span style="margin-left:2px">${esc(s.label)}</span><b>${s.pct != null ? s.pct + "%" : fmtNum(s.value)}</b></div>`;
  }).join("");
  container.innerHTML = `
    <div class="donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140" style="flex-shrink:0">
        ${rings}
        <text x="70" y="66" text-anchor="middle" font-size="19" font-weight="800" fill="#e9ebf3">${fmtNum(total)}</text>
        <text x="70" y="84" text-anchor="middle" font-size="10" fill="#6b7284">${esc(centerLabel)}</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>`;
}

function renderBars(container, items, { fmt = fmtNum, suffix = "" } = {}) {
  if (!items.length) { container.innerHTML = `<div class="empty" style="padding:30px"><p class="muted">No data yet.</p></div>`; return; }
  const max = Math.max(...items.map(i => i.value)) || 1;
  container.innerHTML = `<div style="display:flex;align-items:flex-end;gap:${items.length > 8 ? 6 : 14}px;height:150px;padding-top:8px">
    ${items.map(it => `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0" title="${esc(it.label)}: ${fmt(it.value)}${suffix}">
        <div style="font-size:10.5px;color:var(--muted);font-weight:700">${fmt(it.value)}${suffix}</div>
        <div style="width:100%;max-width:44px;height:${Math.max(5, (it.value / max) * 100)}%;background:${it.color || "var(--grad)"};border-radius:7px 7px 3px 3px;min-height:5px"></div>
        <div style="font-size:10px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(it.label)}</div>
      </div>`).join("")}
  </div>`;
}

/* ============================================================ DASHBOARD */
ROUTES.dashboard = {
  title: "Dashboard",
  subtitle: "Here's what's happening across your channels.",
  async render(page) {
    refreshCurrentList = () => {};
    let onb = null;
    try { onb = await api("/api/onboarding"); } catch (e) {}
    const onbHTML = onb && onb.done < onb.total ? `
      <div class="card fade-in" style="margin-bottom:16px;border-color:rgba(139,92,246,.4)">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div style="flex:1;min-width:220px">
            <h3 style="display:flex;align-items:center;gap:8px">${icon("zap", 15)} Set up your workspace <span class="badge purple">${onb.done}/${onb.total}</span></h3>
            <div class="progress" style="margin-top:9px"><div class="bar" style="width:${(onb.done / onb.total) * 100}%;background:var(--grad)"></div></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${onb.steps.map(s => s.done
              ? `<span class="chip" style="opacity:.55;text-decoration:line-through;cursor:default">${icon("check", 12)} ${s.label}</span>`
              : `<span class="chip" style="cursor:pointer" data-step="${s.link}">${s.label} →</span>`).join("")}
          </div>
        </div>
      </div>` : "";
    page.innerHTML = `
      ${onbHTML}
      <div class="grid cols-4" id="dash-stats">${Array(4).fill('<div class="card"><div class="skel skel-line" style="width:50%"></div><div class="skel" style="height:30px;width:60%;margin-top:10px"></div></div>').join("")}</div>
      <div class="dash-layout">
        <div class="stack">
          <div class="card"><h3>Reach — last 30 days</h3><div class="card-sub">Total people who saw your content</div><div id="dash-chart"><div class="skel skel-block" style="height:220px"></div></div></div>
          <div class="grid cols-2">
            <div class="card"><h3>Audience by platform</h3><div class="card-sub">Connected followers</div><div id="dash-donut"><div class="skel skel-block"></div></div></div>
            <div class="card"><h3>Recent activity</h3><div class="card-sub">Latest events in your workspace</div><div id="dash-activity">${skeletonTable(4)}</div></div>
          </div>
        </div>
        <div class="stack">
          <div class="card"><h3>Upcoming posts</h3><div class="card-sub">Next out the door</div><div id="dash-upcoming">${skeletonTable(3)}</div></div>
          <div class="card"><h3 style="display:flex;align-items:center;gap:8px">Monthly goals <span style="flex:1"></span><button class="btn sm" id="goals-edit">${icon("edit", 12)} Set goals</button></h3><div class="card-sub">Month to date vs your targets</div><div id="dash-goals"><div class="skel skel-block" style="height:90px"></div></div></div>
          <div class="card"><h3>Posting rhythm</h3><div class="card-sub">Published days — last 12 weeks</div><div id="dash-heat"><div class="skel skel-block" style="height:90px"></div></div></div>
          <div class="card"><h3>Top performers</h3><div class="card-sub">Published posts, ranked</div><div id="dash-top">${skeletonTable(3)}</div></div>
        </div>
      </div>`;
    let d;
    try { d = await api("/api/dashboard"); } catch (e) { toast(e.message, { type: "error" }); return; }
    page.querySelectorAll("[data-step]").forEach(ch => ch.onclick = () => { location.hash = "#/" + ch.dataset.step; });

    const s = d.stats;
    const reachVals = d.series.map(x => x.reach);
    const engVals = d.series.map(x => x.engagement);
    const stats = [
      { label: "Total followers", value: fmtNum(s.followers), ico: "users", bg: "rgba(139,92,246,.14)", color: "#c4b5fd", spark: d.series.map(x => x.followers), sc: "#8b5cf6", sub: `${s.connected_accounts} accounts connected` },
      { label: "Reach (30d)", value: fmtNum(s.reach30), ico: "eye", bg: "rgba(96,165,250,.13)", color: "#93c5fd", spark: reachVals, sc: "#60a5fa", sub: `${fmtNum(s.reach30 / 30)}/day average` },
      { label: "Engagement rate", value: s.engagement + "%", ico: "heart", bg: "rgba(244,114,182,.13)", color: "#f9a8d4", spark: engVals, sc: "#f472b6", sub: "likes + comments + shares" },
      { label: "Scheduled posts", value: s.scheduled, ico: "clock", bg: "rgba(251,191,36,.12)", color: "#fcd34d", sub: `${s.active_campaigns} active campaign${s.active_campaigns === 1 ? "" : "s"}` },
    ];
    document.getElementById("dash-stats").innerHTML = stats.map(st => `
      <div class="card stat-card fade-in">
        <div class="stat-top">
          <span class="stat-label">${icon(st.ico, 15)} ${st.label}</span>
          ${st.spark ? sparkline(st.spark, 90, 30, st.sc) : ""}
        </div>
        <div class="stat-value">${st.value}</div>
        <div class="muted" style="font-size:12px;margin-top:3px">${st.sub || ""}</div>
      </div>`).join("");

    renderAreaChart(document.getElementById("dash-chart"),
      d.series.map(x => ({ label: new Date(x.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: x.reach })),
      { label: "reach" });

    const segs = Object.entries(d.platform_split).map(([p, v]) => ({ platform: p, value: v, color: PLATFORMS[p]?.color || "#666" }));
    renderDonut(document.getElementById("dash-donut"), segs.sort((a, b) => b.value - a.value), { centerLabel: "followers" });

    const actIco = { post: "send", ai: "sparkles", account: "users", campaign: "target", milestone: "zap", report: "file", welcome: "sparkles" };
    document.getElementById("dash-activity").innerHTML = d.activity.length
      ? d.activity.slice(0, 6).map(a => `
        <div class="list-item">
          <span class="li-ico" style="background:rgba(139,92,246,.12);color:#c4b5fd">${icon(actIco[a.type] || "zap", 15)}</span>
          <div class="li-main"><b style="white-space:normal">${esc(a.message)}</b></div>
          <div class="li-side"><span style="font-size:11px;color:var(--faint)">${timeAgo(a.created_at)}</span></div>
        </div>`).join("")
      : emptyState({ icon: "zap", title: "No activity yet", message: "Actions you take will show up here." });

    document.getElementById("dash-upcoming").innerHTML = d.upcoming.length
      ? d.upcoming.map(p => `
        <div class="list-item" style="cursor:pointer" data-open-post="${p.id}">
          <span class="li-ico" style="background:rgba(96,165,250,.12);color:#93c5fd">${icon("clock", 15)}</span>
          <div class="li-main"><b>${esc(p.content.slice(0, 54))}${p.content.length > 54 ? "…" : ""}</b><span>${fmtDT(p.scheduled_at)} · ${platRow(p.platforms, 10)}</span></div>
        </div>`).join("") + `<button class="btn ghost sm mt-16" onclick="location.hash='#/calendar'">Open calendar →</button>`
      : emptyState({ icon: "calendar", title: "Nothing scheduled", message: "Schedule a post and it will appear here.", actionLabel: "New post", actionId: "dash-new-post" });

    document.getElementById("dash-top").innerHTML = d.top_posts.length
      ? d.top_posts.map((p, i) => `
        <div class="list-item">
          <span class="li-ico" style="background:var(--panel-2);color:var(--muted);font-weight:800;font-size:13px">${i + 1}</span>
          <div class="li-main"><b>${esc(p.content.slice(0, 48))}…</b><span>${platRow(p.platforms, 10)}</span></div>
          <div class="li-side"><b style="font-size:13px">${fmtNum(p.likes + p.shares)}</b><br><span style="font-size:11px;color:var(--faint)">interactions</span></div>
        </div>`).join("")
      : emptyState({ icon: "chart", title: "No published posts", message: "Publish your first post to see rankings." });

    const np = document.getElementById("dash-new-post");
    if (np) np.onclick = () => openPostModal(null, {});

    // monthly goals
    renderGoals(d);
    document.getElementById("goals-edit").onclick = () => openGoalsModal(d.goals || {});

    // posting heatmap
    api("/api/heatmap").then(h => renderHeatmap(h)).catch(() => {});

    page.querySelectorAll("[data-open-post]").forEach(el => {
      el.onclick = () => location.hash = "#/posts";
    });
  },
};

/* ---------------- monthly goals ---------------- */
function renderGoals(d) {
  const box = document.getElementById("dash-goals");
  if (!box) return;
  const g = d.goals || {};
  if (!g.reach && !g.posts && !g.engagement) {
    box.innerHTML = `<p class="muted" style="font-size:12.5px">No targets set yet. Define monthly reach, post and engagement goals to track momentum here.</p>`;
    return;
  }
  const m = d.month || { reach: 0, posts: 0, engagement: 0 };
  const rows = [];
  if (g.reach) rows.push({ label: "Reach", cur: m.reach, tgt: g.reach, fmt: fmtNum });
  if (g.posts) rows.push({ label: "Posts published", cur: m.posts, tgt: g.posts, fmt: x => x });
  if (g.engagement) rows.push({ label: "Engagement rate", cur: m.engagement, tgt: g.engagement, fmt: x => x + "%" });
  box.innerHTML = rows.map(r => {
    const pct = Math.min(100, Math.round((r.cur / r.tgt) * 100));
    const done = pct >= 100;
    return `
      <div style="margin-bottom:11px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
          <span class="muted">${r.label}</span>
          <span style="font-weight:600;color:${done ? "#34d399" : "var(--text)"}">${done ? icon("check", 11) + " " : ""}${r.fmt(r.cur)} / ${r.fmt(r.tgt)}</span>
        </div>
        <div class="progress"><div class="bar" style="width:${Math.max(2, pct)}%;background:${done ? "linear-gradient(135deg,#34d399,#22d3ee)" : "var(--grad)"}"></div></div>
      </div>`;
  }).join("");
}

function openGoalsModal(goals) {
  const m = openModal({
    title: "Monthly goals",
    body: `
      <p class="faint" style="font-size:12px;margin-bottom:12px">Leave a field at 0 to stop tracking that goal.</p>
      <div class="field"><label>Reach target (this month)</label><input class="input" id="goal-reach" type="number" min="0" value="${goals.reach || 0}"></div>
      <div class="field"><label>Posts to publish</label><input class="input" id="goal-posts" type="number" min="0" value="${goals.posts || 0}"></div>
      <div class="field"><label>Engagement rate target (%)</label><input class="input" id="goal-eng" type="number" min="0" step="0.1" value="${goals.engagement || 0}"></div>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="goals-save">${icon("check", 14)} Save goals</button>`,
  });
  m.el.querySelector("#goals-save").onclick = async () => {
    const g = {
      reach: +m.el.querySelector("#goal-reach").value || 0,
      posts: +m.el.querySelector("#goal-posts").value || 0,
      engagement: +m.el.querySelector("#goal-eng").value || 0,
    };
    buttonLoading(m.el.querySelector("#goals-save"), true);
    try {
      await api("/api/me", { method: "PATCH", body: { prefs: { goals: g } } });
      if (state.user) { state.user.prefs = state.user.prefs || {}; state.user.prefs.goals = g; }
      m.close();
      toast("Goals saved 🎯");
      refreshCurrentList ? ROUTES.dashboard.render(document.getElementById("page")) : null;
    } catch (e) { toast(e.message, { type: "error" }); buttonLoading(m.el.querySelector("#goals-save"), false); }
  };
}

/* ---------------- posting heatmap ---------------- */
function renderHeatmap(h) {
  const box = document.getElementById("dash-heat");
  if (!box) return;
  const days = Object.entries(h.days); // ["2026-07-01", n] ascending
  const shade = n => n === 0 ? "var(--panel-3)" : n === 1 ? "rgba(139,92,246,.35)" : n === 2 ? "rgba(139,92,246,.6)" : n === 3 ? "rgba(139,92,246,.85)" : "#d946ef";
  const cells = days.map(([date, n]) =>
    `<div title="${date}: ${n} post${n === 1 ? "" : "s"}" style="width:11px;height:11px;border-radius:2.5px;background:${shade(n)}"></div>`).join("");
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span class="badge purple">${icon("zap", 11)} ${h.streak}-day streak</span>
      <span class="faint" style="font-size:11px">${days.reduce((a, [, n]) => a + n, 0)} posts in 12 weeks</span>
    </div>
    <div style="display:grid;grid-template-rows:repeat(7,11px);grid-auto-flow:column;grid-auto-columns:11px;gap:3px;overflow-x:auto;padding-bottom:4px">${cells}</div>
    <div style="display:flex;align-items:center;gap:5px;margin-top:9px;font-size:10.5px;color:var(--faint)">
      Less ${[0, 1, 2, 3, 4].map(n => `<span style="width:9px;height:9px;border-radius:2px;background:${shade(n)}"></span>`).join("")} More
    </div>`;
}

/* ============================================================ AI GENERATOR */
const GEN_STATUSES = ["Analyzing your topic…", "Matching tone and platform voice…", "Drafting hooks and CTAs…", "Selecting hashtag mix…"];
let genState = { tone: "casual", platforms: ["instagram"], length: "medium", lastResult: null, typing: null };

ROUTES.generator = {
  title: "AI Generator",
  subtitle: "Generate on-brand posts in seconds, then ship them anywhere.",
  async render(page) {
    refreshCurrentList = () => {};
    const topic = state.params.get("topic") || "";
    page.innerHTML = `
      <div class="gen-layout">
        <div class="stack">
          <div class="card">
            <h3>Brief the AI</h3>
            <div class="card-sub">The more specific, the better the draft.</div>
            <div class="field">
              <label>Topic or goal</label>
              <textarea class="input" id="gen-topic" rows="2" placeholder="e.g. Launch of our new mobile app with offline mode">${esc(topic)}</textarea>
            </div>
            <div class="field">
              <label>Tone</label>
              <div class="chip-row" id="gen-tone">
                ${["casual", "professional", "witty", "inspiring", "bold"].map(t => `<span class="chip ${t === genState.tone ? "active" : ""}" data-tone="${t}">${t[0].toUpperCase() + t.slice(1)}</span>`).join("")}
              </div>
            </div>
            <div class="field">
              <label>Platforms</label>
              <div class="chip-row" id="gen-plats">
                ${Object.entries(PLATFORMS).map(([k, v]) => `<span class="chip ${genState.platforms.includes(k) ? "active" : ""}" data-plat="${k}">${platIcon(k, 12)} ${v.name}</span>`).join("")}
              </div>
            </div>
            <div class="field">
              <label>Length</label>
              <div class="seg" id="gen-len">
                ${["short", "medium", "long"].map(l => `<button class="${l === genState.length ? "active" : ""}" data-len="${l}">${l[0].toUpperCase() + l.slice(1)}</button>`).join("")}
              </div>
            </div>
            <button class="btn primary lg block" id="gen-go" data-perm="generate">${icon("sparkles", 16)} Generate post</button>
            <p class="faint text-c" style="font-size:11.5px;margin-top:9px">Uses 10 AI credits per generation</p>
          </div>
          <div class="card">
            <h3 style="display:flex;align-items:center;gap:8px">${icon("sparkles", 15)} Brand voice studio</h3>
            <div class="card-sub">Applied to every AI draft and rewrite automatically.</div>
            <div class="field"><label>Signature (appended to posts)</label><input class="input" id="bv-sig" placeholder="e.g. — The Lumina Team"></div>
            <div class="field"><label>Words to avoid (comma-separated)</label><input class="input" id="bv-avoid" placeholder="e.g. game-changer, synergy"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin:6px 0 13px">
              <label style="font-size:12.5px;font-weight:600">Allow emojis in AI output</label>
              <label class="switch"><input type="checkbox" id="bv-emoji" checked><span class="track"></span></label>
            </div>
            <button class="btn block" id="bv-save">${icon("check", 14)} Save brand voice</button>
          </div>
        </div>
        <div class="stack">
          <div class="card gen-output">
            <h3>Draft</h3>
            <div class="card-sub">Editable — make it yours before posting.</div>
            <div class="go-body" id="gen-out">${genEmpty()}</div>
            <div id="gen-meta"></div>
            <div style="display:flex;gap:9px;margin-top:15px;flex-wrap:wrap">
              <button class="btn sm" id="gen-copy" disabled>${icon("copy", 13)} Copy</button>
              <button class="btn sm" id="gen-regen" disabled>${icon("refresh", 13)} Regenerate</button>
              <span style="flex:1"></span>
              <button class="btn sm" id="gen-draft" disabled>${icon("file", 13)} Save as draft</button>
              <button class="btn primary sm" id="gen-schedule" disabled>${icon("calendar", 13)} Schedule…</button>
            </div>
          </div>
          <div class="card">
            <h3>Recent generations</h3>
            <div class="card-sub">Click one to reload it into the editor.</div>
            <div id="gen-history">${skeletonTable(3)}</div>
          </div>
        </div>
      </div>`;

    function genEmpty() {
      return `<div class="empty" style="padding:36px 16px">
        <div class="empty-ico">${icon("sparkles", 28)}</div>
        <h3>Your draft will appear here</h3>
        <p>Give the AI a topic, pick a tone and platforms, then hit Generate.</p>
      </div>`;
    }
    const setButtons = on => ["gen-copy", "gen-regen", "gen-draft", "gen-schedule"].forEach(id => document.getElementById(id).disabled = !on);

    // brand voice load/save
    const bv = (state.user.prefs && state.user.prefs.brandVoice) || {};
    document.getElementById("bv-sig").value = bv.signature || "";
    document.getElementById("bv-avoid").value = (bv.avoid || []).join(", ");
    document.getElementById("bv-emoji").checked = bv.emoji !== false;
    document.getElementById("bv-save").onclick = async () => {
      const voice = {
        signature: document.getElementById("bv-sig").value.trim(),
        avoid: document.getElementById("bv-avoid").value.split(",").map(s => s.trim()).filter(Boolean),
        emoji: document.getElementById("bv-emoji").checked,
      };
      const btn = document.getElementById("bv-save");
      buttonLoading(btn, true, "Saving…");
      try {
        await api("/api/me", { method: "PATCH", body: { prefs: { brandVoice: voice } } });
        state.user.prefs = state.user.prefs || {};
        state.user.prefs.brandVoice = voice;
        toast("Brand voice saved — AI drafts now follow it ✨");
      } catch (e) { toast(e.message, { type: "error" }); }
      buttonLoading(btn, false);
    };

    document.querySelectorAll("#gen-tone .chip").forEach(c => c.onclick = () => {
      document.querySelectorAll("#gen-tone .chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active"); genState.tone = c.dataset.tone;
    });
    document.querySelectorAll("#gen-plats .chip").forEach(c => c.onclick = () => c.classList.toggle("active"));
    document.querySelectorAll("#gen-len button").forEach(b => b.onclick = () => {
      document.querySelectorAll("#gen-len button").forEach(x => x.classList.remove("active"));
      b.classList.add("active"); genState.length = b.dataset.len;
    });

    const out = document.getElementById("gen-out");
    const meta = document.getElementById("gen-meta");

    function showResult(r, instant = false) {
      genState.lastResult = r;
      setButtons(true);
      const hashtags = (r.hashtags || []).map(h => `<span class="hash-chip">${esc(h)}</span>`).join("");
      meta.innerHTML = `
        <div class="gen-meta">
          <span class="gm">${icon("zap", 12)} AI confidence <b>${typeof r.confidence === "number" ? r.confidence + "%" : "—"}</b></span>
          <span class="gm">${icon("clock", 12)} Best time <b>${esc(r.best_time)}</b></span>
          ${r.credits_left != null ? `<span class="gm">${icon("sparkles", 12)} <b>${r.credits_left}</b> credits left</span>` : ""}
        </div>
        <div style="margin-top:10px">${hashtags}</div>`;
      const full = r.content;
      if (genState.typing) clearInterval(genState.typing);
      if (instant) { out.textContent = full; return; }
      let i = 0;
      out.innerHTML = `<span class="txt"></span><span class="cursor"></span>`;
      const txt = out.querySelector(".txt");
      genState.typing = setInterval(() => {
        if (!document.body.contains(out)) { clearInterval(genState.typing); genState.typing = null; return; }
        i += 3 + Math.floor(Math.random() * 4);
        txt.textContent = full.slice(0, i);
        out.scrollTop = out.scrollHeight;
        if (i >= full.length) { clearInterval(genState.typing); genState.typing = null; out.textContent = full; }
      }, 14);
    }

    async function generate() {
      const topicVal = document.getElementById("gen-topic").value.trim();
      if (!topicVal) { toast("Give the AI a topic first", { type: "info" }); document.getElementById("gen-topic").focus(); return; }
      const plats = [...document.querySelectorAll("#gen-plats .chip.active")].map(c => c.dataset.plat);
      if (!plats.length) { toast("Pick at least one platform", { type: "info" }); return; }
      const btn = document.getElementById("gen-go");
      buttonLoading(btn, true, "Generating…");
      setButtons(false);
      meta.innerHTML = "";
      out.innerHTML = `<div class="thinking">${GEN_STATUSES.map(s => `<div class="t-line" style="opacity:0;animation:fadeIn .4s forwards"><span class="spin"></span>${s}</div>`).join("")}</div>`;
      out.querySelectorAll(".t-line").forEach((l, i) => (l.style.animationDelay = i * 0.45 + "s"));
      try {
        const r = await api("/api/ai/generate", { method: "POST", body: { topic: topicVal, tone: genState.tone, platforms: plats, length: genState.length } });
        showResult(r);
        toast("Draft generated — looking sharp ✨");
        if (state.user) { state.user.ai_credits_used += r.credits_used; }
        loadHistory();
      } catch (err) {
        out.innerHTML = genEmpty();
        toast(err.message, { type: "error" });
      } finally {
        buttonLoading(btn, false);
      }
    }
    document.getElementById("gen-go").onclick = generate;
    document.getElementById("gen-regen").onclick = generate;

    document.getElementById("gen-copy").onclick = async () => {
      const r = genState.lastResult; if (!r) return;
      const text = r.content + "\n\n" + (r.hashtags || []).join(" ");
      try { await navigator.clipboard.writeText(text); } catch (e) {
        const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      }
      toast("Copied to clipboard");
    };
    document.getElementById("gen-draft").onclick = async () => {
      const r = genState.lastResult; if (!r) return;
      const plats = [...document.querySelectorAll("#gen-plats .chip.active")].map(c => c.dataset.plat);
      try {
        await api("/api/posts", { method: "POST", body: { content: r.content + "\n\n" + (r.hashtags || []).join(" "), platforms: plats.length ? plats : ["instagram"], status: "draft" } });
        toast("Saved to Posts as a draft");
      } catch (e) { toast(e.message, { type: "error" }); }
    };
    document.getElementById("gen-schedule").onclick = () => {
      const r = genState.lastResult; if (!r) return;
      const plats = [...document.querySelectorAll("#gen-plats .chip.active")].map(c => c.dataset.plat);
      openPostModal(null, { content: r.content + "\n\n" + (r.hashtags || []).join(" "), platforms: plats.length ? plats : ["instagram"], status: "scheduled" });
    };

    async function loadHistory() {
      const box = document.getElementById("gen-history");
      try {
        const gens = await api("/api/generations");
        box.innerHTML = gens.length ? gens.map(g => `
          <div class="list-item" style="cursor:pointer" data-gen="${g.id}">
            <span class="li-ico" style="background:rgba(217,70,239,.12);color:#f0abfc">${icon("sparkles", 15)}</span>
            <div class="li-main"><b>${esc(g.topic)}</b><span>${esc(g.tone)} · ${platRow(g.platforms, 10)}</span></div>
            <div class="li-side"><span style="font-size:11px;color:var(--faint)">${timeAgo(g.created_at)}</span></div>
          </div>`).join("")
          : `<p class="muted" style="font-size:13px;padding:8px 0">Nothing yet — your generated drafts will appear here.</p>`;
        box.querySelectorAll("[data-gen]").forEach(el => el.onclick = () => {
          const g = gens.find(x => x.id === Number(el.dataset.gen));
          if (g) showResult({ content: g.content, hashtags: g.hashtags, best_time: "—", confidence: "—" }, true);
        });
      } catch (e) { box.innerHTML = `<p class="muted">Couldn't load history.</p>`; }
    }
    loadHistory();
    if (topic) generate();
  },
};

/* ============================================================ POSTS */
const STATUS_META = {
  draft: { cls: "gray", label: "Draft" },
  scheduled: { cls: "blue", label: "Scheduled" },
  published: { cls: "green", label: "Published" },
  pending: { cls: "yellow", label: "Awaiting approval" },
  failed: { cls: "red", label: "Failed" },
};
function statusBadge(s) {
  const m = STATUS_META[s] || STATUS_META.draft;
  return `<span class="badge ${m.cls}"><span class="dot"></span>${m.label}</span>`;
}

let postsState = { filter: "all", query: "", data: [] };

ROUTES.posts = {
  title: "Posts",
  subtitle: "Draft, schedule and track everything in one place.",
  async render(page) {
    refreshCurrentList = () => ROUTES.posts.render(page0());
    page.innerHTML = `
      <div class="page-head">
        <div class="tabs" id="posts-tabs"></div>
        <span class="spacer"></span>
        <div class="search-box">${icon("search", 15)}<input class="input" id="posts-search" placeholder="Search posts…" value="${esc(postsState.query)}"></div>
        <button class="btn primary sm" id="posts-new" data-perm="create">${icon("plus", 14)} New post</button>
      </div>
      <div class="card" style="padding:8px 16px"><div id="posts-table">${skeletonTable(6)}</div></div>`;
    document.getElementById("posts-new").onclick = () => openPostModal(null, {});
    const search = document.getElementById("posts-search");
    search.addEventListener("input", debounce(() => { postsState.query = search.value; loadPosts(); }, 300));
    await loadPosts();

    function page0() { return document.getElementById("page"); }
  },
};

async function loadPosts() {
  const box = document.getElementById("posts-table");
  if (!box) return;
  try {
    postsState.data = await api("/api/posts");
  } catch (e) {
    box.innerHTML = emptyState({ icon: "alert", title: "Couldn't load posts", message: e.message });
    return;
  }
  renderPostsTabs();
  renderPostsTable();
}

function renderPostsTabs() {
  const counts = { all: postsState.data.length, draft: 0, scheduled: 0, published: 0 };
  postsState.data.forEach(p => { if (counts[p.status] != null) counts[p.status]++; });
  const tabs = document.getElementById("posts-tabs");
  if (!tabs) return;
  tabs.innerHTML = ["all", "draft", "scheduled", "published"].map(f =>
    `<button class="tab ${postsState.filter === f ? "active" : ""}" data-filter="${f}">${f[0].toUpperCase() + f.slice(1)}<span class="n">${counts[f]}</span></button>`).join("");
  tabs.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { postsState.filter = b.dataset.filter; renderPostsTabs(); renderPostsTable(); });
}

function renderPostsTable() {
  const box = document.getElementById("posts-table");
  if (!box) return;
  const q = postsState.query.toLowerCase();
  let rows = postsState.data.filter(p => postsState.filter === "all" || p.status === postsState.filter);
  if (q) rows = rows.filter(p => p.content.toLowerCase().includes(q));
  if (!rows.length) {
    const msg = q ? `No posts match “${postsState.query}”.` : {
      all: "Create your first post and it will show up here.",
      draft: "No drafts yet — generate one with the AI or start from scratch.",
      scheduled: "Nothing in the queue. Schedule a post to fill this space.",
      published: "No published posts yet. Your live content will appear here.",
    }[postsState.filter];
    box.innerHTML = emptyState({ icon: "inbox", title: q ? "No results" : "No posts here", message: msg, actionLabel: q ? null : "New post", actionId: q ? null : "empty-new-post" });
    const b = document.getElementById("empty-new-post");
    if (b) b.onclick = () => openPostModal(null, {});
    return;
  }
  box.innerHTML = `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Post</th><th>Status</th><th>When</th><th>Engagement</th><th></th></tr></thead>
      <tbody>
      ${rows.map(p => {
        const when = p.status === "scheduled" ? fmtDT(p.scheduled_at)
          : p.status === "published" ? fmtDT(p.published_at)
          : p.status === "pending" ? `By ${esc(p.author || "teammate")} · ${timeAgo(p.updated_at)}`
          : "Edited " + timeAgo(p.updated_at);
        const eng = p.status === "published"
          ? `${icon("heart", 12)} ${fmtNum(p.likes)} &nbsp; ${icon("comment", 12)} ${fmtNum(p.comments)} &nbsp; ${icon("eye", 12)} ${fmtNum(p.reach)}`
          : `<span class="faint">—</span>`;
        return `<tr data-id="${p.id}">
          <td data-label="Post"><div class="cell-main"><div class="post-snippet"><div class="txt">${esc(p.content)}</div></div><div class="sub" style="margin-top:6px">${platRow(p.platforms, 11)}</div>
          ${p.review_note ? `<div class="sub" style="margin-top:6px;color:var(--yellow);font-size:11.5px">${icon("comment", 11)} Feedback: ${esc(p.review_note)}</div>` : ""}</div></td>
          <td data-label="Status">${statusBadge(p.status)}</td>
          <td data-label="When"><span class="metric-cell">${when}</span></td>
          <td data-label="Engagement"><span class="metric-cell">${eng}</span></td>
          <td><div class="row-actions">
            ${p.status === "pending" ? `<button class="btn ghost sm" data-act="review">Review</button>` : ""}
            ${["draft", "scheduled"].includes(p.status) ? `<button class="icon-btn" data-act="publish" title="Publish now">${icon("send", 15)}</button>` : ""}
            <button class="icon-btn" data-act="hist" title="Version history">${icon("clock", 15)}</button>
            <button class="icon-btn" data-act="edit" title="Edit">${icon("edit", 15)}</button>
            <button class="icon-btn" data-act="dupe" title="Duplicate">${icon("copy", 15)}</button>
            <button class="icon-btn danger" data-act="del" title="Delete">${icon("trash", 15)}</button>
          </div></td>
        </tr>`;
      }).join("")}
      </tbody></table></div>`;
  box.querySelectorAll("tr[data-id]").forEach(tr => {
    const p = postsState.data.find(x => x.id === Number(tr.dataset.id));
    tr.querySelector('[data-act="edit"]').onclick = () => openPostModal(p, {});
    tr.querySelector('[data-act="del"]').onclick = () => deletePostOptimistic(p, tr);
    const rev = tr.querySelector('[data-act="review"]');
    if (rev) rev.onclick = () => { location.hash = "#/approvals"; };
    tr.querySelector('[data-act="hist"]').onclick = () => openVersionsModal(p);
    tr.querySelector('[data-act="dupe"]').onclick = async () => {
      try {
        await api("/api/posts", { method: "POST", body: { content: p.content, platforms: p.platforms, status: "draft" } });
        toast("Duplicated as a draft");
        loadPosts();
      } catch (e) { toast(e.message, { type: "error" }); }
    };
    const pub = tr.querySelector('[data-act="publish"]');
    if (pub) pub.onclick = () => openPublishAssistant(p);
  });
}

function deletePostOptimistic(p, tr) {
  tr.style.transition = "opacity .2s"; tr.style.opacity = "0";
  setTimeout(() => tr.remove(), 180);
  postsState.data = postsState.data.filter(x => x.id !== p.id);
  setTimeout(renderPostsTabs, 200);
  toast("Post deleted", { type: "info", action: { label: "Undo", onClick: async () => {
    try {
      const np = await api("/api/posts", { method: "POST", body: { content: p.content, platforms: p.platforms, status: p.status === "published" ? "draft" : p.status, scheduled_at: p.scheduled_at } });
      postsState.data.push(np);
      toast("Post restored");
      loadPosts();
    } catch (e) { toast("Couldn't restore post", { type: "error" }); }
  }}});
  api(`/api/posts/${p.id}`, { method: "DELETE" }).catch(() => { toast("Delete failed — restored", { type: "error" }); postsState.data.push(p); loadPosts(); });
}

function openVersionsModal(p) {
  const m = openModal({
    title: "Version history",
    wide: true,
    body: `<p class="muted" style="font-size:12.5px;margin-bottom:12px">Every edit snapshots the previous version. Restore any of them.</p><div id="vh-list">${skeletonTable(3)}</div>`,
    foot: `<button class="btn" data-close>Close</button>`,
  });
  (async () => {
    let versions = [];
    try { versions = await api(`/api/posts/${p.id}/versions`); } catch (e) { toast(e.message, { type: "error" }); }
    const box = m.el.querySelector("#vh-list");
    if (!versions.length) {
      box.innerHTML = emptyState({ icon: "clock", title: "No versions yet", message: "Edit this post and each previous version will be saved here automatically." });
      return;
    }
    box.innerHTML = versions.map(v => `
      <div class="msg-bubble" style="margin-bottom:11px">
        <div class="mb-meta"><b>${esc(v.edited_by)}</b> · edited ${timeAgo(v.created_at)} ${platRow(v.platforms, 10)}
          <span style="margin-left:auto"><button class="btn sm" data-restore="${v.id}">${icon("refresh", 12)} Restore</button></span>
        </div>
        ${esc(v.content)}
      </div>`).join("");
    box.querySelectorAll("[data-restore]").forEach(btn => btn.onclick = async () => {
      buttonLoading(btn, true, "Restoring…");
      try {
        await api(`/api/posts/${p.id}/versions/${btn.dataset.restore}/restore`, { method: "POST" });
        m.close();
        toast("Version restored");
        loadPosts();
      } catch (e) { toast(e.message, { type: "error" }); buttonLoading(btn, false); }
    });
  })();
}

async function publishNow(p, tr) {
  const badgeCell = tr.children[1];
  const prev = badgeCell.innerHTML;
  badgeCell.innerHTML = `<span class="badge green"><span class="dot"></span>Publishing…</span>`;
  try {
    const np = await api(`/api/posts/${p.id}`, { method: "PATCH", body: { status: "published" } });
    Object.assign(p, np);
    toast("Published 🎉 It's live on " + p.platforms.map(x => PLATFORMS[x]?.name).join(", "));
    loadPosts();
  } catch (e) {
    badgeCell.innerHTML = prev;
    toast(e.message, { type: "error" });
  }
}

/* ============================================================ CALENDAR */
let calState = { anchor: new Date(), selected: new Date().toISOString().slice(0, 10), posts: [] };

ROUTES.calendar = {
  title: "Calendar",
  subtitle: "Everything scheduled, at a glance.",
  async render(page) {
    refreshCurrentList = () => {};
    page.innerHTML = `
      <div class="cal-layout">
        <div class="card">
          <div class="cal-head">
            <h3 id="cal-title">…</h3>
            <div style="display:flex;gap:6px">
              <button class="icon-btn" id="cal-prev">${icon("chevronLeft", 17)}</button>
              <button class="btn sm" id="cal-today">Today</button>
              <button class="icon-btn" id="cal-next">${icon("chevronRight", 17)}</button>
            </div>
          </div>
          <div id="cal-body"><div class="skel skel-block" style="height:380px"></div></div>
        </div>
        <div class="card" id="cal-side"><div class="skel skel-block" style="height:200px"></div></div>
      </div>`;
    document.getElementById("cal-prev").onclick = () => { calState.anchor = new Date(calState.anchor.getFullYear(), calState.anchor.getMonth() - 1, 1); drawCal(); };
    document.getElementById("cal-next").onclick = () => { calState.anchor = new Date(calState.anchor.getFullYear(), calState.anchor.getMonth() + 1, 1); drawCal(); };
    document.getElementById("cal-today").onclick = () => { calState.anchor = new Date(); calState.selected = new Date().toISOString().slice(0, 10); drawCal(); };
    refreshCurrentList = async () => {
      try { calState.posts = await api("/api/calendar"); drawCal(); } catch (e) {}
    };
    try {
      calState.posts = await api("/api/calendar");
    } catch (e) {
      calState.posts = [];
      toast(e.message, { type: "error" });
    }
    drawCal();
  },
};

function drawCal() {
  const title = document.getElementById("cal-title");
  const body = document.getElementById("cal-body");
  if (!body) return;
  const a = calState.anchor;
  const y = a.getFullYear(), m = a.getMonth();
  title.textContent = a.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const byDay = {};
  calState.posts.forEach(p => { (byDay[p.day] = byDay[p.day] || []).push(p); });
  // conflict detection: same platform within ±45 min
  const conflictIds = new Set();
  Object.values(byDay).forEach(list => {
    const sched = list.filter(p => p.status === "scheduled" && p.scheduled_at);
    for (let i = 0; i < sched.length; i++) for (let j = i + 1; j < sched.length; j++) {
      const t1 = new Date(sched[i].scheduled_at).getTime(), t2 = new Date(sched[j].scheduled_at).getTime();
      if (Math.abs(t1 - t2) <= 45 * 60000 && sched[i].platforms.some(x => sched[j].platforms.includes(x))) {
        conflictIds.add(sched[i].id); conflictIds.add(sched[j].id);
      }
    }
  });
  let cells = "";
  const dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  cells += dows.map(d => `<div class="cal-dow">${d}</div>`).join("");
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1;
    const d = new Date(y, m, dayNum);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const inMonth = d.getMonth() === m;
    const items = byDay[iso] || [];
    const pills = items.slice(0, 2).map(p =>
      `<span class="cal-pill ${p.status} ${conflictIds.has(p.id) ? "clash" : ""}" title="${conflictIds.has(p.id) ? "Schedule conflict — same platform within 45 min" : ""}">${conflictIds.has(p.id) ? "⚠ " : ""}${p.status === "scheduled" ? fmtTime(p.scheduled_at) + " " : ""}${esc(p.content.slice(0, 16))}…</span>`).join("");
    const more = items.length > 2 ? `<span class="faint" style="font-size:10px;padding-left:2px">+${items.length - 2} more</span>` : "";
    cells += `<div class="cal-day ${inMonth ? "" : "other"} ${iso === todayStr ? "today" : ""} ${iso === calState.selected ? "selected" : ""}" data-day="${iso}">
      <span class="dnum">${d.getDate()}</span>${pills}${more}</div>`;
  }
  body.innerHTML = `<div class="cal-grid">${cells}</div>`;
  body.querySelectorAll(".cal-day").forEach(el => el.onclick = () => { calState.selected = el.dataset.day; drawCal(); });
  drawCalSide(byDay, conflictIds);
}

function drawCalSide(byDay, conflictIds) {
  const side = document.getElementById("cal-side");
  if (!side) return;
  const iso = calState.selected;
  const d = new Date(iso + "T12:00:00");
  const items = (byDay && byDay[iso]) || calState.posts.filter(p => p.day === iso);
  const clashes = items.filter(p => conflictIds && conflictIds.has(p.id));
  side.innerHTML = `
    <h3>${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
    <div class="card-sub">${items.length} post${items.length === 1 ? "" : "s"} this day</div>
    ${clashes.length ? `<div class="conflict-box" style="margin-bottom:10px">${icon("alert", 14)} <b>${clashes.length} conflict${clashes.length === 1 ? "" : "s"}:</b> posts hitting the same platform within 45&nbsp;min may cannibalize each other's reach.</div>` : ""}
    ${items.length ? items.map(p => `
      <div class="list-item">
        <span class="li-ico" style="background:${p.status === "published" ? "rgba(52,211,153,.12)" : "rgba(96,165,250,.12)"};color:${p.status === "published" ? "var(--green)" : "var(--blue)"}">
          ${icon(p.status === "published" ? "check" : "clock", 15)}
        </span>
        <div class="li-main"><b>${esc(p.content.slice(0, 60))}${p.content.length > 60 ? "…" : ""}</b>
        <span>${fmtTime(p.scheduled_at || p.published_at)} · ${platRow(p.platforms, 10)}</span></div>
      </div>`).join("")
    : `<div class="empty" style="padding:22px 8px">
        <div class="empty-ico" style="width:56px;height:56px;border-radius:16px">${icon("calendar", 22)}</div>
        <h3 style="font-size:14px">Nothing planned</h3><p style="font-size:12.5px">This day is wide open.</p>
      </div>`}
    <button class="btn primary sm block mt-16" id="cal-new" data-perm="schedule">${icon("plus", 14)} Schedule for this day</button>`;
  document.getElementById("cal-new").onclick = () => openPostModal(null, { scheduled_at: iso + "T09:00", status: "scheduled" });
}
