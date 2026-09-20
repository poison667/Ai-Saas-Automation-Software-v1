/* ============ Page: Trends ============ */
"use strict";

function sparkSVG(series, w = 110, h = 30) {
  const min = Math.min(...series), max = Math.max(...series);
  const span = (max - min) || 1;
  const pts = series.map((v, i) =>
    `${((i / (series.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`);
  const up = series[series.length - 1] >= series[0];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">
    <polyline points="${pts.join(" ")}" fill="none" stroke="${up ? "#22d3ee" : "#f87171"}" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;
}

function compactVol(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}

let trendPlatform = "instagram";

ROUTES.trends = {
  title: "Trends",
  subtitle: "What's gaining traction right now — refreshed daily.",
  async render(page) {
    refreshCurrentList = () => ROUTES.trends.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="seg" id="trend-plats" style="margin-bottom:14px">
        ${Object.entries(PLATFORMS).map(([k, v], i) =>
          `<button type="button" data-tp="${k}" class="${i === 0 ? "active" : ""}">${platIcon(k, 13)} ${v.name}</button>`).join("")}
      </div>
      <div id="trend-body">${skeletonTable(6)}</div>`;
    let current = Object.keys(PLATFORMS)[0];
    const load = async plat => {
      current = plat;
      trendPlatform = plat;
      document.querySelectorAll("#trend-plats button").forEach(b => b.classList.toggle("active", b.dataset.tp === plat));
      const box = document.getElementById("trend-body");
      box.innerHTML = skeletonTable(6);
      let d;
      try { d = await api("/api/trends?platform=" + encodeURIComponent(plat)); }
      catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      renderTrends(box, d);
    };
    document.querySelectorAll("#trend-plats button").forEach(b => b.onclick = () => load(b.dataset.tp));
    load(current);
  },
};

function renderTrends(box, d) {
  box.innerHTML = `
    <div class="card fade-in" style="padding:0;overflow:hidden">
      <table class="table">
        <thead><tr>
          <th style="width:36px">#</th><th>Hashtag</th><th style="width:130px">14-day trend</th>
          <th style="width:90px">Volume</th><th style="width:90px">Growth</th><th style="width:80px">Score</th><th style="width:150px"></th>
        </tr></thead>
        <tbody>
          ${d.trends.map((t, i) => `
          <tr>
            <td class="faint">${i + 1}</td>
            <td><b style="color:var(--cyan)">#${t.tag}</b>
              <span class="badge ${t.sentiment === "positive" ? "green" : t.sentiment === "negative" ? "red" : "gray"}" style="margin-left:8px">${t.sentiment}</span></td>
            <td>${sparkSVG(t.series)}</td>
            <td>${compactVol(t.volume)}</td>
            <td style="color:${t.growth >= 0 ? "#34d399" : "#f87171"};font-weight:600">${t.growth >= 0 ? "▲" : "▼"} ${Math.abs(t.growth)}%</td>
            <td><b>${t.score}</b></td>
            <td>
              <button class="icon-btn" data-act="copy" data-tag="${t.tag}" title="Copy hashtag">${icon("copy", 14)}</button>
              <button class="btn sm" data-act="use" data-tag="${t.tag}">${icon("send", 12)} Use</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <p class="faint mt-16" style="font-size:12px">${icon("clock", 12)} Simulated trend data, deterministic per platform per day. “Use” drops the hashtag into a new post.</p>`;
  box.querySelectorAll('[data-act="copy"]').forEach(btn => btn.onclick = async () => {
    const tag = "#" + btn.dataset.tag;
    try { await navigator.clipboard.writeText(tag); } catch (e) {}
    toast(`Copied ${tag}`);
  });
  box.querySelectorAll('[data-act="use"]').forEach(btn => btn.onclick = () => {
    openPostModal(null, { content: "#" + btn.dataset.tag + " ", platforms: [trendPlatform] });
  });
}
