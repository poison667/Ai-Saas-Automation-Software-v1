/* ============ Lumina core: utils, api, icons, components, shell, router ============ */
"use strict";

const state = {
  user: null,
  route: "dashboard",
  params: new URLSearchParams(),
  postsCache: null,
  sidebarOpen: false,
};

/* ---------------- utils ---------------- */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtNum(n) {
  if (n == null) return "0";
  n = Number(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n * 10) / 10);
}
function fmtMoney(n) { return "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtDT(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " +
         d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 604800) return Math.floor(s / 86400) + "d ago";
  return fmtDate(iso);
}
function initials(name) {
  return (name || "?").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------------- api ---------------- */
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    if (res.status === 401 && state.user) { state.user = null; boot(); throw new Error("Session expired"); }
    const err = new Error((data && data.detail) || "Something went wrong");
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------- icons (feather-style) ---------------- */
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  sparkles: '<path d="M12 3l1.9 4.9L19 9.8l-5.1 1.9L12 17l-1.9-5.3L5 9.8l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  bell: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
  comment: '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  trendUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  trendDown: '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  edit: '<path d="M17 3a2.83 2.83 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  external: '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>',
  link: '<path d="M10 13a5 5 0 007.54.5l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.5l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
  flask: '<path d="M9 3v6.5L4.2 18a2 2 0 001.8 3h12a2 2 0 001.8-3L15 9.5V3"/><line x1="8" y1="3" x2="16" y2="3"/><line x1="7" y1="15" x2="17" y2="15"/>',
  gitBranch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/>',
  helpCircle: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  user: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
};
function icon(name, size = 18, cls = "") {
  const p = ICON_PATHS[name] || "";
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

/* ---------------- platform meta ---------------- */
const PLATFORMS = {
  instagram: { name: "Instagram", color: "#E1306C", icon: '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none"/>' },
  x: { name: "X / Twitter", color: "#3f4657", icon: '<path d="M4 4l16 16M20 4L4 20" stroke-width="2.6"/>' },
  facebook: { name: "Facebook", color: "#1877F2", icon: '<path d="M14 3h-2.5A3.5 3.5 0 008 6.5V10H5.5v3.5H8V21h3.5v-7.5h2.6l.6-3.5h-3.2V7c0-.6.4-1 1-1H14z"/>' },
  linkedin: { name: "LinkedIn", color: "#0A66C2", icon: '<rect x="2.5" y="2.5" width="19" height="19" rx="3"/><path d="M7 10.5V17M7 7v.1M11.5 17v-3.8a2.3 2.3 0 014.5 0V17"/>' },
  tiktok: { name: "TikTok", color: "#0d94a3", icon: '<path d="M14.5 3.5c.4 2.4 1.9 3.9 4.3 4.2v3c-1.7 0-3.1-.5-4.3-1.4v5.9a5.4 5.4 0 11-5.4-5.4c.3 0 .7 0 1 .1v3.1a2.3 2.3 0 101.4 2.2V3.5z"/>' },
  youtube: { name: "YouTube", color: "#FF0000", icon: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><polygon points="10 9 15.5 12 10 15" fill="currentColor" stroke="none"/>' },
};
function platIcon(p, size = 14) {
  const m = PLATFORMS[p];
  if (!m) return "";
  return `<span class="plat-ico" style="width:${size + 8}px;height:${size + 8}px;background:${m.color}"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg></span>`;
}
function platRow(list, size = 13) {
  return `<span class="plat-row">${(list || []).map(p => platIcon(p, size)).join("")}</span>`;
}

/* ---------------- toasts ---------------- */
function toast(msg, { type = "success", action } = {}) {
  const wrap = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const ico = type === "success" ? "check" : type === "error" ? "alert" : "zap";
  el.innerHTML = `<span class="t-ico">${icon(ico, 14)}</span><span>${esc(msg)}</span>${action ? `<button class="t-action">${esc(action.label)}</button>` : ""}`;
  wrap.appendChild(el);
  const kill = () => { el.classList.add("out"); setTimeout(() => el.remove(), 260); };
  if (action) el.querySelector(".t-action").onclick = () => { kill(); action.onClick(); };
  setTimeout(kill, action ? 6000 : 3800);
  while (wrap.children.length > 4) wrap.firstChild.remove();
}

/* ---------------- modal ---------------- */
function openModal({ title, body, foot, wide = false, onClose }) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close>${icon("x", 17)}</button></div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
      </div>
    </div>`;
  const backdrop = root.firstElementChild;
  const close = () => { root.innerHTML = ""; document.removeEventListener("keydown", onKey); if (onClose) onClose(); };
  const onKey = e => { if (e.key === "Escape") close(); };
  backdrop.addEventListener("mousedown", e => { if (e.target === backdrop) close(); });
  backdrop.querySelector("[data-close]").onclick = close;
  document.addEventListener("keydown", onKey);
  setTimeout(() => { const f = backdrop.querySelector("input, textarea, select"); if (f) f.focus(); }, 40);
  return { el: backdrop, close };
}
function confirmModal({ title, message, confirmLabel = "Delete", danger = true }) {
  return new Promise(resolve => {
    const m = openModal({
      title,
      body: `<p class="muted" style="font-size:13.5px">${esc(message)}</p>`,
      foot: `<button class="btn" data-cancel>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-ok>${esc(confirmLabel)}</button>`,
      onClose: () => resolve(false),
    });
    m.el.querySelector("[data-cancel]").onclick = () => { m.close(); resolve(false); };
    m.el.querySelector("[data-ok]").onclick = () => { m.close(); resolve(true); };
  });
}
async function downloadExport(path, fallbackName) {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="?([^";]+)/);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = m ? m[1] : fallbackName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function buttonLoading(btn, loading, label) {
  if (!btn) return;
  if (loading) { btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${label ? esc(label) : ""}`; }
  else { btn.disabled = false; if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig; }
}

/* ---------------- skeletons & empty states ---------------- */
function skeletonTable(rows = 5) {
  let r = "";
  for (let i = 0; i < rows; i++) {
    r += `<div style="display:flex;gap:14px;align-items:center;padding:14px 4px;border-bottom:1px solid var(--border)">
      <div class="skel" style="width:34px;height:34px;border-radius:10px;flex-shrink:0"></div>
      <div style="flex:1"><div class="skel skel-line" style="width:${55 - i * 6}%"></div><div class="skel skel-line" style="width:${30 - i * 3}%;margin:0"></div></div>
      <div class="skel" style="width:64px;height:22px;border-radius:99px"></div>
    </div>`;
  }
  return `<div class="fade-in">${r}</div>`;
}
function skeletonCards(n = 3, h = 150) {
  let r = "";
  for (let i = 0; i < n; i++) r += `<div class="skel skel-block" style="height:${h}px;border-radius:14px"></div>`;
  return `<div class="grid cols-3">${r}</div>`;
}
function emptyState({ icon: ic = "inbox", title, message, actionLabel, actionId }) {
  return `<div class="empty fade-in">
    <div class="empty-ico">${icon(ic, 30)}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(message)}</p>
    ${actionLabel ? `<button class="btn primary" id="${actionId}">${icon("plus", 15)} ${esc(actionLabel)}</button>` : ""}
  </div>`;
}

/* ---------------- dropdown helper ---------------- */
function bindDropdowns(scope = document) {
  scope.querySelectorAll(".dd").forEach(dd => {
    const trigger = dd.querySelector("[data-dd-trigger]");
    const menu = dd.querySelector(".dd-menu");
    if (!trigger || !menu || trigger.dataset.bound) return;
    trigger.dataset.bound = "1";
    trigger.addEventListener("click", e => {
      e.stopPropagation();
      const wasOpen = menu.style.display === "block";
      closeAllDropdowns();
      menu.style.display = wasOpen ? "none" : "block";
    });
  });
}
function closeAllDropdowns() {
  document.querySelectorAll(".dd-menu").forEach(m => (m.style.display = "none"));
}
document.addEventListener("click", () => closeAllDropdowns());

/* ---------------- auth screen ---------------- */
function showAuth() {
  document.getElementById("app").innerHTML = `
  <div class="auth-wrap">
    <div class="auth-hero">
      <div class="brand"><span class="logo">${icon("sparkles", 17)}</span> Lumina</div>
      <div>
        <h1>Your entire social presence,<br><span class="grad-text">run by AI.</span></h1>
        <p class="sub">Generate on-brand content, schedule everywhere at once, and watch your analytics climb — from one calm dashboard.</p>
        <div class="hero-features">
          <div class="hero-feature"><span class="ico">${icon("sparkles", 16)}</span><div><b>AI Content Studio</b><span>Hooks, captions & hashtag sets tuned per platform and tone.</span></div></div>
          <div class="hero-feature"><span class="ico">${icon("calendar", 16)}</span><div><b>Unified scheduling</b><span>One calendar for Instagram, X, LinkedIn, TikTok & more.</span></div></div>
          <div class="hero-feature"><span class="ico">${icon("chart", 16)}</span><div><b>Analytics that decide</b><span>Reach, engagement and attribution with week-over-week deltas.</span></div></div>
        </div>
      </div>
      <div class="hero-stats">
        <div><b>12,400+</b><span>teams shipping daily</span></div>
        <div><b>3.2M</b><span>posts generated</span></div>
        <div><b>4.9/5</b><span>average rating</span></div>
      </div>
    </div>
    <div class="auth-side">
      <div class="auth-card">
        <h2 id="auth-title">Welcome back</h2>
        <p class="hint" id="auth-hint">Log in to your workspace.</p>
        <div class="auth-tabs">
          <button id="tab-login" class="active">Log in</button>
          <button id="tab-register">Create account</button>
        </div>
        <div class="form-error" id="auth-error"></div>
        <form id="auth-form">
          <div class="field" id="name-field" style="display:none">
            <label>Full name</label>
            <input class="input" id="auth-name" placeholder="Jane Cooper" autocomplete="name">
          </div>
          <div class="field">
            <label>Email</label>
            <input class="input" id="auth-email" type="email" placeholder="you@company.com" autocomplete="email">
          </div>
          <div class="field">
            <label>Password</label>
            <input class="input" id="auth-password" type="password" placeholder="••••••••" autocomplete="current-password">
          </div>
          <button class="btn primary lg block" id="auth-submit" type="submit">${icon("logout", 15)} Log in</button>
        </form>
        <div class="demo-banner">
          <b>Just exploring?</b> Try the fully-loaded demo workspace.<br>
          <button class="link-btn" id="demo-btn" style="margin-top:6px">→ Log in as Ava (demo@lumina.social)</button>
        </div>
      </div>
    </div>
  </div>`;

  let mode = "login";
  const tabL = document.getElementById("tab-login");
  const tabR = document.getElementById("tab-register");
  const setMode = m => {
    mode = m;
    tabL.classList.toggle("active", m === "login");
    tabR.classList.toggle("active", m === "register");
    document.getElementById("name-field").style.display = m === "register" ? "" : "none";
    document.getElementById("auth-title").textContent = m === "login" ? "Welcome back" : "Create your workspace";
    document.getElementById("auth-hint").textContent = m === "login" ? "Log in to your workspace." : "Start free — no credit card needed.";
    const sub = document.getElementById("auth-submit");
    sub.innerHTML = m === "login" ? `${icon("logout", 15)} Log in` : `${icon("sparkles", 15)} Create account`;
    hideAuthError();
  };
  const showAuthError = msg => { const e = document.getElementById("auth-error"); e.textContent = msg; e.classList.add("show"); };
  const hideAuthError = () => document.getElementById("auth-error").classList.remove("show");
  tabL.onclick = () => setMode("login");
  tabR.onclick = () => setMode("register");

  document.getElementById("auth-form").onsubmit = async e => {
    e.preventDefault();
    hideAuthError();
    const body = {
      email: document.getElementById("auth-email").value,
      password: document.getElementById("auth-password").value,
    };
    if (mode === "register") body.name = document.getElementById("auth-name").value;
    const btn = document.getElementById("auth-submit");
    buttonLoading(btn, true, mode === "login" ? "Logging in…" : "Creating…");
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body });
      state.user = await api("/api/auth/me");
      toast(mode === "login" ? `Welcome back, ${state.user.name.split(" ")[0]}!` : "Workspace created — welcome to Lumina!");
      boot(true);
    } catch (err) {
      showAuthError(err.message);
      buttonLoading(btn, false);
    }
  };
  document.getElementById("demo-btn").onclick = async () => {
    const btn = document.getElementById("demo-btn");
    btn.textContent = "Opening demo workspace…";
    try {
      await api("/api/auth/login", { method: "POST", body: { email: "demo@lumina.social", password: "demo1234" } });
      state.user = await api("/api/auth/me");
      toast("Loaded the demo workspace — everything is pre-seeded. Explore!");
      boot(true);
    } catch (err) {
      showAuthError(err.message);
      btn.textContent = "→ Log in as Ava (demo@lumina.social)";
    }
  };
}

/* ---------------- shell ---------------- */
const NAV = [
  { section: "Overview" },
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "analytics", label: "Analytics", icon: "chart" },
  { id: "audience", label: "Audience", icon: "globe" },
  { id: "inbox", label: "Inbox", icon: "comment", badge: "inbox" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "reports", label: "Reports", icon: "file" },
  { id: "revenue", label: "Revenue", icon: "dollar" },
  { id: "mediakit", label: "Media Kit", icon: "award" },
  { id: "services", label: "Services Studio", icon: "briefcase" },
  { section: "Create" },
  { id: "generator", label: "AI Generator", icon: "sparkles" },
  { id: "ideas", label: "Content Ideas", icon: "zap" },
  { id: "trends", label: "Trends", icon: "trendUp" },
  { id: "profile", label: "Profile Studio", icon: "user" },
  { id: "studio", label: "Thread & Carousel", icon: "file" },
  { id: "launch", label: "Launch Kit", icon: "rocket" },
  { id: "posts", label: "Posts", icon: "inbox" },
  { id: "approvals", label: "Approvals", icon: "check", badge: "approvals" },
  { id: "experiments", label: "Experiments", icon: "flask" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "media", label: "Media Library", icon: "image" },
  { section: "Manage" },
  { id: "accounts", label: "Accounts", icon: "users" },
  { id: "campaigns", label: "Campaigns", icon: "target" },
  { id: "competitors", label: "Competitors", icon: "trendUp" },
  { id: "listening", label: "Social Listening", icon: "search" },
  { id: "integrations", label: "Integrations", icon: "link" },
  { id: "templates", label: "AI Templates", icon: "bookmark" },
  { section: "Workspace" },
  { id: "team", label: "Team", icon: "users" },
  { id: "billing", label: "Billing", icon: "file" },
  { id: "settings", label: "Settings", icon: "sliders" },
];

function shellHTML(title, subtitle) {
  const u = state.user;
  const creditsLeft = (u.credits_limit || 0) - (u.ai_credits_used || 0);
  const nav = NAV.map(n => n.section
    ? `<div class="nav-section">${n.section}</div>`
    : `<div class="nav-item ${state.route === n.id ? "active" : ""}" data-nav="${n.id}">${icon(n.icon, 17)} ${n.label}${n.badge ? `<span class="count" id="nav-${n.badge}-count" style="display:none"></span>` : ""}</div>`).join("");
  return `
  <div class="shell">
    <div class="overlay" id="nav-overlay"></div>
    <aside class="sidebar ${state.sidebarOpen ? "open" : ""}" id="sidebar">
      <div class="brand"><span class="logo">${icon("sparkles", 16)}</span> Lumina</div>
      <nav style="flex:1;overflow-y:auto">${nav}</nav>
      <div class="sidebar-footer">
        <button class="btn block" id="install-app-btn" style="display:none;margin-bottom:10px">${icon("external", 14)} Install Lumina</button>
        <div class="upgrade-card">
          <b>✨ ${esc(u.plan)} plan</b>
          <p>${creditsLeft} AI credits left this month</p>
          <div class="progress"><div class="bar" style="width:${Math.max(3, Math.min(100, (u.ai_credits_used / u.credits_limit) * 100))}%;background:var(--grad)"></div></div>
        </div>
        <div class="user-row">
          <span class="avatar" style="background:${u.avatar_color}">${esc(initials(u.name))}</span>
          <div class="meta"><b>${esc(u.name)}</b><span>${esc(u.email)}</span></div>
          <button class="icon-btn" id="logout-btn" title="Log out">${icon("logout", 15)}</button>
        </div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn hamburger" id="hamburger">${icon("menu", 19)}</button>
        <div><h1>${esc(title)}</h1>${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ""}</div>
        <div class="topbar-right">
          <select id="role-preview" class="role-select" title="Preview as role">
            <option value="owner">👑 Owner</option>
            <option value="manager">🧭 Manager</option>
            <option value="editor">✍️ Editor</option>
            <option value="viewer">👁 Viewer</option>
          </select>
          <button class="icon-btn" id="tour-btn" title="Take the product tour">${icon("helpCircle", 17)}</button>
          <button class="icon-btn" id="palette-open" title="Search (Ctrl+K)">${icon("search", 17)}</button>
          <button class="icon-btn" id="theme-toggle" title="Toggle theme">${icon("sun", 17)}</button>
          <span class="credits-pill">${icon("zap", 13)} ${creditsLeft} credits</span>
          <button class="btn primary sm" id="quick-new-post" data-perm="create">${icon("plus", 14)} New post</button>
          <div class="dd">
            <button class="icon-btn" data-dd-trigger id="bell-btn" style="position:relative">${icon("bell", 18)}<span class="bell-dot" id="bell-dot" style="display:none"></span></button>
            <div class="dd-menu" style="width:340px" id="notif-menu"></div>
          </div>
          <div class="dd">
            <button data-dd-trigger style="background:none;border:none;cursor:pointer;display:flex"><span class="avatar" style="background:${u.avatar_color};width:34px;height:34px">${esc(initials(u.name))}</span></button>
            <div class="dd-menu">
              <div class="dd-head">${esc(u.name)}<span class="badge purple">${esc(u.plan)}</span></div>
              <button class="dd-item" data-nav="settings">${icon("sliders", 15)} Settings</button>
              <div class="dd-sep"></div>
              <button class="dd-item danger" id="dd-logout">${icon("logout", 15)} Log out</button>
            </div>
          </div>
        </div>
      </header>
      <div class="role-banner" id="role-banner" style="display:none">${icon("eye", 15)} Previewing as <b id="role-banner-label">${ROLE_LABEL[state.rolePreview || "owner"]}</b> — read-only or limited actions. Change via the role selector above.</div>
      <main class="content" id="page"></main>
    </div>
  </div>`;
}

const ACT_ICO = { post: "send", ai: "sparkles", account: "users", campaign: "target", milestone: "zap", report: "file", welcome: "sparkles" };

function setBellDot(count) {
  const dot = document.getElementById("bell-dot");
  if (dot) dot.style.display = count > 0 ? "" : "none";
}

async function loadNotifications() {
  const menu = document.getElementById("notif-menu");
  if (!menu) return;
  menu.innerHTML = `<div style="padding:16px">${skeletonTable(3)}</div>`;
  try {
    const d = await api("/api/notifications");
    setBellDot(d.unread);
    const items = d.items.slice(0, 6).map(a => `
      <div class="notif-item">
        <span class="n-ico" style="background:rgba(139,92,246,.13);color:#c4b5fd">${icon(ACT_ICO[a.type] || "zap", 14)}</span>
        <div><p>${esc(a.message)}</p><div class="n-time">${timeAgo(a.created_at)}</div></div>
      </div>`).join("") || `<div class="notif-item"><p class="muted">No notifications yet.</p></div>`;
    menu.innerHTML = `
      <div class="dd-head">Notifications ${d.unread ? `<span class="badge purple">${d.unread} new</span>` : ""}</div>
      ${items}
      <div class="dd-sep"></div>
      <div style="display:flex;justify-content:space-between;padding:2px 8px 4px">
        <button class="link-btn" id="notif-mark-read" style="font-size:12px">Mark all read</button>
        <button class="link-btn" id="notif-view-all" style="font-size:12px">View all →</button>
      </div>`;
    menu.querySelector("#notif-view-all").onclick = () => { closeAllDropdowns(); location.hash = "#/notifications"; };
    menu.querySelector("#notif-mark-read").onclick = async e => {
      e.stopPropagation();
      await api("/api/notifications/read", { method: "POST" }).catch(() => {});
      setBellDot(0);
      loadNotifications();
    };
  } catch (e) {
    menu.innerHTML = `<div class="notif-item"><p class="muted">Couldn't load notifications.</p></div>`;
  }
}

function updateInboxBadge(count) {
  const el = document.getElementById("nav-inbox-count");
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? "" : "none";
}
function updateApprovalsBadge(count) {
  const el = document.getElementById("nav-approvals-count");
  if (!el) return;
  el.textContent = count;
  el.style.display = count > 0 ? "" : "none";
}

function bindShell() {
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.onclick = () => { location.hash = "#/" + el.dataset.nav; state.sidebarOpen = false; };
  });
  api("/api/inbox/unread").then(d => updateInboxBadge(d.count)).catch(() => {});
  api("/api/posts/pending-count").then(d => updateApprovalsBadge(d.count)).catch(() => {});
  const pal = document.getElementById("palette-open");
  if (pal) pal.onclick = () => openPalette();
  const th = document.getElementById("theme-toggle");
  if (th) th.onclick = toggleTheme;
  applyTheme(preferredTheme());
  const rp = document.getElementById("role-preview");
  if (rp) {
    const saved = (state.user && state.user.prefs && state.user.prefs.viewAs) || "owner";
    state.rolePreview = saved;
    rp.value = saved;
    rp.onchange = () => setRolePreview(rp.value);
  }
  const tb = document.getElementById("tour-btn");
  if (tb) tb.onclick = () => startTour(0);
  setTimeout(applyRoleGuard, 0);
  const inst = document.getElementById("install-app-btn");
  if (inst) { inst.onclick = installApp; if (deferredInstallPrompt) inst.style.display = ""; }
  const doLogout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    state.user = null;
    boot();
  };
  const lb = document.getElementById("logout-btn"); if (lb) lb.onclick = doLogout;
  const ddl = document.getElementById("dd-logout"); if (ddl) ddl.onclick = doLogout;
  const hb = document.getElementById("hamburger");
  const ov = document.getElementById("nav-overlay");
  if (hb) hb.onclick = () => { state.sidebarOpen = !state.sidebarOpen; document.getElementById("sidebar").classList.toggle("open", state.sidebarOpen); ov.classList.toggle("show", state.sidebarOpen); };
  if (ov) ov.onclick = () => { state.sidebarOpen = false; document.getElementById("sidebar").classList.remove("open"); ov.classList.remove("show"); };
  const qnp = document.getElementById("quick-new-post");
  if (qnp) qnp.onclick = () => openPostModal(null, {});
  const bell = document.getElementById("bell-btn");
  if (bell) bell.addEventListener("click", () => { if (document.getElementById("notif-menu").style.display === "block") loadNotifications(); });
  bindDropdowns();
}

/* ---------------- router ---------------- */
const ROUTES = {};   // filled by pages1.js / pages2.js

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, "") || "dashboard";
  const [name, query] = h.split("?");
  return { name, params: new URLSearchParams(query || "") };
}

async function renderRoute() {
  const r = currentRoute();
  if (!ROUTES[r.name]) { location.hash = "#/dashboard"; return; }
  state.route = r.name;
  state.lastHash = location.hash;
  state.params = r.params;
  document.getElementById("app").innerHTML = shellHTML(ROUTES[r.name].title, ROUTES[r.name].subtitle);
  bindShell();
  loadNotifications();
  await ROUTES[r.name].render(document.getElementById("page"));
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => {
  if (state.user && location.hash !== state.lastHash) renderRoute();
});

async function boot(force) {
  if (!state.user) {
    try { state.user = await api("/api/auth/me"); } catch (e) { state.user = null; }
  }
  applyTheme(preferredTheme());
  if (!state.user) { showAuth(); return; }
  if (!location.hash) location.hash = "#/dashboard";
  await renderRoute();
}

/* ---------------- shared: post modal (used by many pages) ---------------- */
async function openPostModal(post, prefill = {}) {
  let campaigns = [];
  try { campaigns = await api("/api/campaigns"); } catch (e) {}
  const p = post || { content: prefill.content || "", platforms: prefill.platforms || ["instagram"], status: prefill.status || "draft", scheduled_at: prefill.scheduled_at || "", campaign_id: prefill.campaign_id || null };
  const dt = p.scheduled_at ? p.scheduled_at.slice(0, 16) : "";
  const m = openModal({
    title: post ? "Edit post" : "New post",
    wide: true,
    body: `
      <div class="seg" id="pm-tabs" style="margin-bottom:16px">
        <button type="button" data-ptab="compose" class="active">Compose</button>
        <button type="button" data-ptab="preview">Preview</button>
      </div>
      <div id="pm-compose">
      <div class="field">
        <label>Content</label>
        <textarea class="input" id="pm-content" rows="6" placeholder="What do you want to say?">${esc(p.content)}</textarea>
        <div class="char-count"><span id="pm-count">${p.content.length}</span> characters</div>
        <div class="chip-row" id="pm-rewrite" style="margin-top:8px">
          <span class="faint" style="font-size:11.5px;align-self:center">${icon("sparkles", 12)} AI rewrite (2 cr):</span>
          <span class="chip" data-rw="improve">✨ Improve</span>
          <span class="chip" data-rw="shorten">✂ Shorten</span>
          <span class="chip" data-rw="expand">⤢ Expand</span>
          <span class="chip" data-rw="hashtags"># Hashtags</span>
          <span class="chip" data-rw="emoji">😊 Emoji</span>
        </div>
      </div>
      <div class="field">
        <label>Platforms</label>
        <div class="chip-row" id="pm-platforms">
          ${Object.entries(PLATFORMS).map(([k, v]) => `<span class="chip ${p.platforms.includes(k) ? "active" : ""}" data-plat="${k}">${platIcon(k, 12)} ${v.name}</span>`).join("")}
        </div>
      </div>
      <div class="grid cols-2">
        <div class="field">
          <label>Status</label>
          <select class="input" id="pm-status">
            <option value="draft" ${p.status === "draft" ? "selected" : ""}>Save as draft</option>
            <option value="scheduled" ${p.status === "scheduled" ? "selected" : ""}>Schedule</option>
            <option value="published" ${p.status === "published" ? "selected" : ""}>Publish now</option>
            <option value="pending" ${p.status === "pending" ? "selected" : ""}>Submit for approval</option>
          </select>
        </div>
        <div class="field" id="pm-when-wrap" style="display:${p.status === "scheduled" ? "" : "none"}">
          <label>Schedule for</label>
          <input class="input" id="pm-when" type="datetime-local" value="${dt}">
        </div>
      </div>
      <div class="conflict-box" id="pm-conflict" style="display:none"></div>
      <div class="field">
        <label>Campaign <span class="faint">(optional)</span></label>
        <select class="input" id="pm-campaign">
          <option value="">No campaign</option>
          ${campaigns.map(c => `<option value="${c.id}" ${p.campaign_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="utm-box">
        <div class="utm-head" id="utm-toggle">${icon("link", 14)} Link tracking (UTM) <span class="faint">— optional</span><span style="margin-left:auto">${icon("chevronDown", 14)}</span></div>
        <div id="utm-body" style="display:none">
          <div class="field"><label>Destination URL</label><input class="input" id="utm-url" placeholder="https://yoursite.com/launch"></div>
          <div class="grid cols-3" style="gap:10px">
            <div class="field"><label>Source</label><input class="input" id="utm-src" value="lumina"></div>
            <div class="field"><label>Medium</label><select class="input" id="utm-med"><option>social</option><option>organic</option><option>email</option><option>cpc</option></select></div>
            <div class="field"><label>Campaign</label><input class="input" id="utm-cmp" placeholder="launch"></div>
          </div>
          <div class="char-count" id="utm-preview" style="text-align:left;color:var(--cyan)"></div>
          <button class="btn sm" id="utm-append" type="button">${icon("plus", 13)} Append tracked link to post</button>
        </div>
      </div>
      </div>
      <div id="pm-preview" style="display:none"></div>
      <div class="form-error" id="pm-error"></div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="pm-save">${post ? "Save changes" : "Create post"}</button>`,
  });
  const ta = m.el.querySelector("#pm-content");
  ta.addEventListener("input", () => { m.el.querySelector("#pm-count").textContent = ta.value.length; });

  // AI rewrite chips
  m.el.querySelectorAll("#pm-rewrite .chip[data-rw]").forEach(chip => {
    chip.onclick = async () => {
      if (!ta.value.trim()) { toast("Write something first", { type: "info" }); return; }
      const orig = chip.textContent;
      chip.classList.add("active"); chip.style.pointerEvents = "none"; chip.textContent = "Rewriting…";
      try {
        const res = await api("/api/ai/rewrite", { method: "POST", body: { content: ta.value, action: chip.dataset.rw } });
        ta.value = res.content;
        m.el.querySelector("#pm-count").textContent = ta.value.length;
        state.user.ai_credits_used = (state.user.credits_limit || 0) - res.credits_left;
        toast(`Rewritten — ${res.credits_left} credits left`);
        updateCreditsPill();
      } catch (e) { toast(e.message, { type: "error" }); }
      chip.textContent = orig; chip.classList.remove("active"); chip.style.pointerEvents = "";
    };
  });

  // UTM builder
  const utmHead = m.el.querySelector("#utm-toggle");
  const utmBody = m.el.querySelector("#utm-body");
  utmHead.onclick = () => { utmBody.style.display = utmBody.style.display === "none" ? "" : "none"; };
  const utmBuild = () => {
    const url = m.el.querySelector("#utm-url").value.trim();
    const prev = m.el.querySelector("#utm-preview");
    if (!url) { prev.textContent = ""; return ""; }
    const cmp = m.el.querySelector("#utm-cmp").value.trim() || "launch";
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    u.searchParams.set("utm_source", m.el.querySelector("#utm-src").value.trim() || "lumina");
    u.searchParams.set("utm_medium", m.el.querySelector("#utm-med").value);
    u.searchParams.set("utm_campaign", cmp);
    prev.textContent = u.toString();
    return u.toString();
  };
  ["#utm-url", "#utm-src", "#utm-cmp"].forEach(sel => m.el.querySelector(sel).addEventListener("input", utmBuild));
  m.el.querySelector("#utm-med").addEventListener("change", utmBuild);
  m.el.querySelector("#utm-append").onclick = () => {
    const link = utmBuild();
    if (!link) { toast("Add a destination URL first", { type: "info" }); return; }
    ta.value = ta.value.trim() ? ta.value.trim() + "\n\n" + link : link;
    m.el.querySelector("#pm-count").textContent = ta.value.length;
    toast("Tracked link appended");
  };
  m.el.querySelectorAll("#pm-platforms .chip").forEach(ch => ch.onclick = () => ch.classList.toggle("active"));
  const statusSel = m.el.querySelector("#pm-status");
  statusSel.onchange = () => {
    m.el.querySelector("#pm-when-wrap").style.display = statusSel.value === "scheduled" ? "" : "none";
    runConflictCheck();
  };

  // --- schedule conflict detection ---
  let conflictTimer = null;
  function selectedPlats() {
    return [...m.el.querySelectorAll("#pm-platforms .chip.active")].map(c => c.dataset.plat);
  }
  function runConflictCheck() {
    const box = m.el.querySelector("#pm-conflict");
    if (!box) return;
    const when = m.el.querySelector("#pm-when").value;
    if (statusSel.value !== "scheduled" || !when) { box.style.display = "none"; box.innerHTML = ""; return; }
    clearTimeout(conflictTimer);
    conflictTimer = setTimeout(async () => {
      try {
        const res = await api("/api/posts/check-conflict", { method: "POST", body: {
          scheduled_at: when + ":00", platforms: selectedPlats(), exclude_id: p.id || null,
        }});
        if (res.conflicts && res.conflicts.length) {
          box.style.display = "";
          box.innerHTML = `${icon("alert", 15)} <b>Heads up:</b> ${res.conflicts.length} scheduled post${res.conflicts.length === 1 ? "" : "s"} hit the same platform${res.conflicts[0].platforms.length === 1 ? "" : "s"} within ±45&nbsp;min:
            <ul style="margin:7px 0 0 4px">${res.conflicts.map(c => `<li>“${esc(c.content.slice(0, 46))}…” — ${c.platforms.map(x => platIcon(x, 10)).join(" ")} at ${esc((c.scheduled_at || "").slice(11, 16))}</li>`).join("")}</ul>
            <span class="faint" style="font-size:11px">You can still schedule — this is a warning, not a blocker.</span>`;
        } else { box.style.display = "none"; box.innerHTML = ""; }
      } catch (e) { box.style.display = "none"; }
    }, 350);
  }
  m.el.querySelector("#pm-when").addEventListener("input", runConflictCheck);
  m.el.querySelectorAll("#pm-platforms .chip").forEach(ch => {
    const orig = ch.onclick;
    ch.onclick = () => { orig(); runConflictCheck(); };
  });
  if (statusSel.value === "scheduled" && m.el.querySelector("#pm-when").value) runConflictCheck();

  // --- live platform preview ---
  const previewPane = m.el.querySelector("#pm-preview");
  let previewPlat = null;
  function drawPreview() {
    const content = ta.value.trim() || "Start typing your post to see a live preview…";
    const plats = [...m.el.querySelectorAll("#pm-platforms .chip.active")].map(c => c.dataset.plat);
    if (!plats.length) {
      previewPane.innerHTML = emptyState({ icon: "eye", title: "No platforms selected", message: "Pick at least one platform in the Compose tab to preview how your post will look." });
      return;
    }
    if (!previewPlat || !plats.includes(previewPlat)) previewPlat = plats[0];
    previewPane.innerHTML = `
      <div class="chip-row" style="margin-bottom:14px">
        ${plats.map(k => `<span class="chip ${k === previewPlat ? "active" : ""}" data-pv="${k}">${platIcon(k, 12)} ${PLATFORMS[k].name}</span>`).join("")}
      </div>
      <div style="display:flex;justify-content:center">${platformPreviewHTML(previewPlat, content)}</div>`;
    previewPane.querySelectorAll("[data-pv]").forEach(ch => ch.onclick = () => { previewPlat = ch.dataset.pv; drawPreview(); });
  }
  m.el.querySelectorAll("#pm-tabs button").forEach(b => b.onclick = () => {
    m.el.querySelectorAll("#pm-tabs button").forEach(x => x.classList.toggle("active", x === b));
    const isPreview = b.dataset.ptab === "preview";
    m.el.querySelector("#pm-compose").style.display = isPreview ? "none" : "";
    previewPane.style.display = isPreview ? "" : "none";
    if (isPreview) drawPreview();
  });
  ta.addEventListener("input", () => { if (previewPane.style.display !== "none") drawPreview(); });
  m.el.querySelectorAll("#pm-platforms .chip").forEach(ch => {
    const prev = ch.onclick;
    ch.onclick = () => { prev(); if (previewPane.style.display !== "none") drawPreview(); };
  });

  m.el.querySelector("[data-cancel]").onclick = m.close;
  m.el.querySelector("#pm-save").onclick = async () => {
    const content = ta.value.trim();
    const platforms = [...m.el.querySelectorAll("#pm-platforms .chip.active")].map(c => c.dataset.plat);
    const status = statusSel.value;
    const scheduled_at = m.el.querySelector("#pm-when").value ? m.el.querySelector("#pm-when").value + ":00" : null;
    const campaign_id = m.el.querySelector("#pm-campaign").value || null;
    const errEl = m.el.querySelector("#pm-error");
    errEl.classList.remove("show");
    if (!content) { errEl.textContent = "Post content can't be empty."; errEl.classList.add("show"); return; }
    if (!platforms.length) { errEl.textContent = "Pick at least one platform."; errEl.classList.add("show"); return; }
    if (status === "scheduled" && !scheduled_at) { errEl.textContent = "Pick a date and time to schedule."; errEl.classList.add("show"); return; }
    const btn = m.el.querySelector("#pm-save");
    buttonLoading(btn, true, "Saving…");
    try {
      const body = { content, platforms, status, scheduled_at, campaign_id: campaign_id ? Number(campaign_id) : null };
      const saved = post ? await api(`/api/posts/${post.id}`, { method: "PATCH", body }) : await api("/api/posts", { method: "POST", body });
      m.close();
      toast(post ? "Post updated" : status === "scheduled" ? `Scheduled for ${fmtDT(saved.scheduled_at)}` : status === "published" ? "Post published 🎉" : status === "pending" ? "Submitted for approval ✓" : "Draft saved");
      if (typeof refreshCurrentList === "function") refreshCurrentList();
    } catch (err) {
      errEl.textContent = err.message; errEl.classList.add("show");
      buttonLoading(btn, false);
    }
  };
}
// pages override this to re-render their list after modal saves
let refreshCurrentList = () => {};

/* ---------------- native-style post previews ---------------- */
function platformPreviewHTML(p, content) {
  const ws = state.user ? state.user.workspace : "Your brand";
  const name = esc(ws);
  const body = `<div style="white-space:pre-wrap">${esc(content)}</div>`;
  const ava = `<span style="width:36px;height:36px;border-radius:50%;background:var(--grad);display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex-shrink:0">${esc(initials(ws))}</span>`;
  if (p === "instagram") return `
    <div class="phone-card">
      <div style="display:flex;align-items:center;gap:9px;padding:10px 12px">${ava}
        <b style="font-size:12.5px">${name}</b><span style="margin-left:auto;color:var(--faint)">•••</span></div>
      <div style="aspect-ratio:1;background:linear-gradient(135deg,rgba(139,92,246,.4),rgba(217,70,239,.35));display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75)">${icon("image", 40)}</div>
      <div style="padding:10px 12px">
        <div style="display:flex;gap:14px;color:var(--text);margin-bottom:8px">${icon("heart", 20)}${icon("comment", 20)}${icon("send", 20)}</div>
        <div style="font-size:12.5px;line-height:1.55"><b>${name}</b> ${body}</div>
      </div>
    </div>`;
  if (p === "x") return `
    <div class="phone-card" style="max-width:420px">
      <div style="display:flex;gap:10px;padding:13px">
        ${ava}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px"><b>${name}</b> <span style="color:#7d97b5">${icon("check", 11)}</span> <span style="color:var(--faint)">@${esc(ws.toLowerCase().replace(/\s+/g, ""))} · now</span></div>
          <div style="font-size:13.5px;line-height:1.55;margin-top:4px">${body}</div>
          <div style="display:flex;gap:38px;color:var(--faint);margin-top:11px">${icon("comment", 15)}${icon("refresh", 15)}${icon("heart", 15)}${icon("chart", 15)}</div>
        </div>
      </div>
    </div>`;
  if (p === "linkedin") return `
    <div class="phone-card" style="max-width:440px">
      <div style="display:flex;gap:10px;padding:13px">
        ${ava}
        <div style="flex:1"><b style="font-size:13px;display:block">${name}</b>
          <span style="font-size:11px;color:var(--faint)">1,248 followers · 1h · 🌐</span></div>
        <span style="color:var(--faint)">•••</span>
      </div>
      <div style="padding:0 13px 12px;font-size:13px;line-height:1.6">${body}</div>
      <div style="border-top:1px solid var(--border);margin:0 13px;padding:9px 0;display:flex;gap:26px;color:var(--faint)">${icon("heart", 16)}${icon("comment", 16)}${icon("refresh", 16)}${icon("send", 16)}</div>
    </div>`;
  const pm = PLATFORMS[p] || { name: p, color: "#666" };
  return `
    <div class="phone-card" style="max-width:430px">
      <div style="display:flex;gap:10px;padding:13px;align-items:flex-start">
        ${ava}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px"><b style="font-size:13px">${name}</b>${platIcon(p, 11)}<span style="color:var(--faint);font-size:11px">· now</span></div>
          <div style="font-size:13.5px;line-height:1.6;margin-top:6px">${body}</div>
          <div style="display:flex;gap:26px;color:var(--faint);margin-top:11px">${icon("heart", 15)}${icon("comment", 15)}${icon("share", 15)}</div>
        </div>
      </div>
    </div>`;
}

/* ---------------- command palette (Ctrl/Cmd+K) ---------------- */
const PALETTE_ACTIONS = [
  { label: "New post", icon: "plus", hint: "Create", run: () => openPostModal(null, {}) },
  { label: "Generate AI draft", icon: "sparkles", hint: "Create", run: () => { location.hash = "#/generator"; } },
  { label: "Invite teammate", icon: "users", hint: "Workspace", run: () => { location.hash = "#/team"; } },
  { label: "Track a competitor", icon: "trendUp", hint: "Manage", run: () => { location.hash = "#/competitors"; } },
  { label: "Upload media", icon: "image", hint: "Create", run: () => { location.hash = "#/media"; } },
  { label: "Generate weekly report", icon: "file", hint: "Insights", run: () => { location.hash = "#/reports"; } },
  { label: "Review approvals", icon: "check", hint: "Create", run: () => { location.hash = "#/approvals"; } },
  { label: "Plan & billing", icon: "zap", hint: "Workspace", run: () => { location.hash = "#/billing"; } },
];

function openPalette() {
  if (document.getElementById("palette-root").innerHTML) return;
  const root = document.getElementById("palette-root");
  root.innerHTML = `
    <div class="palette-backdrop">
      <div class="palette">
        <div class="palette-input-row">${icon("search", 16)}<input id="palette-input" placeholder="Jump to a page, search posts, or run an action…" autocomplete="off"><kbd>esc</kbd></div>
        <div class="palette-list" id="palette-list"></div>
        <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span class="faint">Lumina command palette</span></div>
      </div>
    </div>`;
  const backdrop = root.firstElementChild;
  const input = document.getElementById("palette-input");
  const list = document.getElementById("palette-list");
  let items = [], sel = 0, posts = null;

  const pageItems = NAV.filter(n => n.id).map(n => ({
    label: n.label, icon: n.icon, hint: "Go to page", run: () => { location.hash = "#/" + n.id; },
  }));

  function close() { root.innerHTML = ""; document.removeEventListener("keydown", onKey, true); }
  function build(q) {
    q = q.trim().toLowerCase();
    items = [];
    if (!q) {
      items = pageItems.slice(0, 6).concat(PALETTE_ACTIONS.slice(0, 4));
    } else {
      items = items.concat(pageItems.filter(p => p.label.toLowerCase().includes(q)));
      items = items.concat(PALETTE_ACTIONS.filter(a => a.label.toLowerCase().includes(q)));
      if (posts) items = items.concat(posts
        .filter(p => p.content.toLowerCase().includes(q))
        .slice(0, 5)
        .map(p => ({ label: p.content.slice(0, 64) + (p.content.length > 64 ? "…" : ""), icon: "inbox", hint: "Post · " + p.status,
          run: () => { postsState.filter = "all"; postsState.query = p.content.split(/\s+/).slice(0, 3).join(" "); location.hash = "#/posts"; } })));
    }
    sel = 0;
    draw();
  }
  function draw() {
    list.innerHTML = items.length ? items.map((it, i) => `
      <div class="palette-item ${i === sel ? "sel" : ""}" data-i="${i}">
        <span class="p-ico">${icon(it.icon, 15)}</span>
        <span class="p-label">${esc(it.label)}</span>
        <span class="p-hint">${esc(it.hint)}</span>
      </div>`).join("")
      : `<div class="palette-empty">No matches — try a page name or a keyword from your posts.</div>`;
    list.querySelectorAll(".palette-item").forEach(el => {
      el.onmousemove = () => { sel = Number(el.dataset.i); list.querySelectorAll(".palette-item").forEach((x, j) => x.classList.toggle("sel", j === sel)); };
      el.onclick = () => { close(); items[Number(el.dataset.i)].run(); };
    });
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[sel]) { close(); items[sel].run(); } }
  }
  backdrop.addEventListener("mousedown", e => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", onKey, true);
  input.addEventListener("input", () => build(input.value));
  build("");
  input.focus();
  api("/api/posts").then(p => { posts = p; if (input.value.trim()) build(input.value); }).catch(() => {});
}
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (state.user) openPalette(); }
});

function updateCreditsPill() {
  if (!state.user) return;
  const el = document.querySelector(".credits-pill");
  if (el) {
    const left = (state.user.credits_limit || 0) - (state.user.ai_credits_used || 0);
    el.innerHTML = `${icon("zap", 13)} ${left} credits`;
  }
  const up = document.querySelector(".upgrade-card p");
  if (up) up.textContent = `${(state.user.credits_limit || 0) - (state.user.ai_credits_used || 0)} AI credits left this month`;
}

/* ---------------- role preview ---------------- */
const ROLE_PERMS = {
  owner:  ["create","edit","delete","approve","reject","publish","reply","team","billing","reset","connect","export","generate","schedule"],
  manager:["create","edit","delete","approve","reject","publish","reply","team","connect","export","generate","schedule"],
  editor: ["create","edit","reply","connect","export","generate","schedule"],
  viewer: [],
};
const ROLE_LABEL = { owner: "Owner", manager: "Manager", editor: "Editor", viewer: "Viewer" };
function currentRole() { return state.rolePreview || "owner"; }
function can(perm) { return (ROLE_PERMS[currentRole()] || []).includes(perm); }
function roleBlocked(el) {
  const perm = el.dataset.perm;
  if (!perm) return;
  const allowed = can(perm);
  if (allowed) {
    el.disabled = false; el.classList.remove("role-blocked");
    if (el.dataset.origTitle !== undefined) el.title = el.dataset.origTitle;
    return;
  }
  if (el.dataset.origTitle === undefined) el.dataset.origTitle = el.title || "";
  el.disabled = true; el.classList.add("role-blocked");
  el.title = `${ROLE_LABEL[currentRole()]} can’t ${perm} — switch role to change`;
}
function applyRoleGuard() {
  document.querySelectorAll("[data-perm]").forEach(roleBlocked);
  const banner = document.getElementById("role-banner");
  if (banner) {
    banner.style.display = currentRole() === "owner" ? "none" : "flex";
    const lbl = document.getElementById("role-banner-label");
    if (lbl) lbl.textContent = ROLE_LABEL[currentRole()];
  }
}
new MutationObserver(() => applyRoleGuard()).observe(document.documentElement, { subtree: true, childList: true });

function setRolePreview(r) {
  state.rolePreview = r;
  if (state.user) {
    state.user.prefs = state.user.prefs || {};
    state.user.prefs.viewAs = r;
    api("/api/me", { method: "PATCH", body: { prefs: { viewAs: r } } }).catch(() => {});
  }
  const sel = document.getElementById("role-preview");
  if (sel) sel.value = r;
  applyRoleGuard();
  if (r !== "owner") toast(`Previewing as ${ROLE_LABEL[r]} — some actions are locked`, { type: "info" });
}

/* ---------------- product tour ---------------- */
const TOUR_STEPS = [
  { nav: "dashboard", icon: "dashboard", title: "Your command center", body: "The Dashboard shows live stats, your publishing calendar at a glance, and recent activity. Everything important starts here." },
  { nav: "generator", icon: "sparkles", title: "AI Generator", body: "Describe what you want and Lumina drafts platform-ready copy in seconds. It uses AI credits from your plan." },
  { nav: "approvals", icon: "check", title: "Approvals", body: "Teammates submit posts for review. Approve to publish or schedule, or reject with feedback so they know what to fix." },
  { nav: "experiments", icon: "flask", title: "Experiments", body: "Run A/B tests on post copy. Lumina splits the audience, measures engagement, and promotes the winning variant automatically." },
  { nav: "listening", icon: "search", title: "Social Listening", body: "Track brand keywords across the social web. See volume, sentiment, and every mention in real time." },
  { nav: "integrations", icon: "link", title: "Integrations", body: "Connect Slack, Zapier, Canva and more. Webhooks push live events out to the rest of your stack." },
  { nav: "billing", icon: "file", title: "Billing", body: "Manage your plan, AI credits, and invoices. Upgrade any time — changes apply instantly." },
];
let tourState = null;
function startTour(i = 0) {
  if (i >= TOUR_STEPS.length) { endTour(true); return; }
  const step = TOUR_STEPS[i];
  tourState = i;
  location.hash = "#/" + step.nav;
  setTimeout(() => renderTourCard(step, i), 350);
}
function renderTourCard(step, i) {
  endTourDom();
  const isLast = i === TOUR_STEPS.length - 1;
  const card = document.createElement("div");
  card.className = "tour-card fade-in";
  card.innerHTML = `
    <div class="tour-head">${icon(step.icon, 18)} <b>${esc(step.title)}</b><span class="tour-count">${i + 1} / ${TOUR_STEPS.length}</span></div>
    <p>${esc(step.body)}</p>
    <div class="tour-actions">
      <button class="btn sm ghost" id="tour-skip">Skip</button>
      <span style="flex:1"></span>
      ${i > 0 ? `<button class="btn sm" id="tour-back">${icon("chevronLeft", 13)} Back</button>` : ""}
      <button class="btn sm primary" id="tour-next">${isLast ? "Finish ✓" : "Next " + icon("chevronRight", 13)}</button>
    </div>`;
  document.body.appendChild(card);
  card.querySelector("#tour-skip").onclick = () => endTour(true);
  const back = card.querySelector("#tour-back");
  if (back) back.onclick = () => startTour(i - 1);
  card.querySelector("#tour-next").onclick = () => startTour(i + 1);
  const navEl = document.querySelector(`.nav-item[data-nav="${step.nav}"]`);
  if (navEl) navEl.classList.add("tour-spotlight");
}
function endTourDom() {
  document.querySelectorAll(".tour-card").forEach(e => e.remove());
  document.querySelectorAll(".tour-spotlight").forEach(e => e.classList.remove("tour-spotlight"));
}
function endTour(finished) {
  endTourDom();
  if (finished && tourState === TOUR_STEPS.length - 1) toast("Tour complete — you're ready to go 🎉");
  tourState = null;
}

/* ---------------- theme ---------------- */
function preferredTheme() {
  if (state.user && state.user.prefs && state.user.prefs.theme) return state.user.prefs.theme;
  try { return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"; } catch (e) { return "dark"; }
}
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.innerHTML = icon(t === "light" ? "moon" : "sun", 17);
}
async function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
  if (state.user) {
    state.user.prefs = state.user.prefs || {};
    state.user.prefs.theme = next;
    api("/api/me", { method: "PATCH", body: { prefs: { theme: next } } }).catch(() => {});
  }
}

/* ---------------- PWA install ---------------- */
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById("install-app-btn");
  if (btn) btn.style.display = "";
});
async function installApp() {
  if (!deferredInstallPrompt) { toast("Use your browser's “Install Lumina” option in the address bar", { type: "info" }); return; }
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === "accepted") toast("Installing Lumina…");
  deferredInstallPrompt = null;
  const btn = document.getElementById("install-app-btn");
  if (btn) btn.style.display = "none";
}

/* ---------------- keyboard shortcuts ---------------- */
const GOTO_KEYS = { d: "dashboard", a: "analytics", i: "inbox", p: "posts", c: "calendar", g: "generator",
                    m: "media", t: "team", b: "billing", s: "settings", r: "reports", o: "competitors", l: "listening", n: "notifications", e: "ideas" };
let lastG = 0;

function openShortcuts() {
  const rows = [
    ["Ctrl / ⌘ + K", "Command palette — search & jump anywhere"],
    ["N", "New post"],
    ["G then D", "Go to Dashboard"], ["G then P", "Go to Posts"], ["G then I", "Go to Inbox"],
    ["G then C", "Go to Calendar"], ["G then G", "Go to AI Generator"], ["G then A", "Go to Analytics"],
    ["G then M", "Go to Media Library"], ["G then T", "Go to Team"], ["G then R", "Go to Reports"],
    ["?", "Show this shortcuts panel"], ["Esc", "Close dialogs"],
  ];
  openModal({
    title: "Keyboard shortcuts",
    body: `<div style="display:flex;flex-direction:column;gap:9px">
      ${rows.map(([k, v]) => `<div style="display:flex;align-items:center;gap:12px">
        <span style="min-width:120px"><kbd style="background:var(--bg-soft);border:1px solid var(--border-strong);border-bottom-width:2px;border-radius:6px;padding:2px 8px;font-size:11.5px;font-family:inherit;color:var(--text)">${k}</kbd></span>
        <span class="muted" style="font-size:13px">${v}</span></div>`).join("")}
    </div>`,
    foot: `<button class="btn primary" data-close>Got it</button>`,
  });
}

document.addEventListener("keydown", e => {
  if (!state.user) return;
  const tag = (e.target.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  // ignore when a modal is open (except Escape which modals handle)
  const modalOpen = !!document.querySelector(".modal-backdrop") || !!document.getElementById("palette-root").innerHTML;
  if (modalOpen) return;
  if (e.key === "?") { e.preventDefault(); openShortcuts(); return; }
  if (e.key.toLowerCase() === "n") { e.preventDefault(); openPostModal(null, {}); return; }
  const now = Date.now();
  if (e.key.toLowerCase() === "g") { lastG = now; return; }
  if (now - lastG < 1200) {
    const dest = GOTO_KEYS[e.key.toLowerCase()];
    lastG = 0;
    if (dest) { e.preventDefault(); location.hash = "#/" + dest; }
  }
});
