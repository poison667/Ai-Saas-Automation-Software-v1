/* ============ Lumina v3.1 — Real business core: Client CRM, Rate Calculator, Metrics Tracker, Follow-ups ============ */

const PLATFORM_OPTIONS = ["tiktok", "instagram", "youtube", "facebook", "x", "threads", "linkedin"];
const platOptions = sel => PLATFORM_OPTIONS.map(p => `<option value="${p}" ${sel === p ? "selected" : ""}>${p[0].toUpperCase() + p.slice(1)}</option>`).join("");

/* ================= CLIENT CRM ================= */

const CLIENT_STATUS_META = {
  lead: { label: "Lead", cls: "pill" },
  active: { label: "Active", cls: "pill ok" },
  paused: { label: "Paused", cls: "pill" },
  closed: { label: "Closed", cls: "pill" },
};

ROUTES.clients = {
  title: "Client CRM",
  subtitle: "Your real clients — contacts, status, notes. This is your business book.",
  async render(page) {
    const [{ items }, summary] = await Promise.all([api("/api/clients"), api("/api/clients/summary")]);
    page.innerHTML = `
      <div class="stack">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${Object.entries(summary.counts).map(([k, v]) => `<span class="${CLIENT_STATUS_META[k].cls}">${CLIENT_STATUS_META[k].label}: <b>${v}</b></span>`).join("")}
          </div>
          <button class="btn primary" id="cl-add">${icon("plus", 15)} Add client</button>
        </div>
        ${items.length === 0 ? `
        <div class="card" style="text-align:center;padding:44px">
          <div style="font-size:15px;font-weight:600">No clients yet</div>
          <div class="card-sub" style="margin:8px 0 16px">Add every brand, shop or person you work with — this becomes your client book.</div>
          <button class="btn primary" onclick="document.getElementById('cl-add').click()">${icon("plus", 15)} Add your first client</button>
        </div>` : `
        <div class="card" style="padding:0;overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="text-align:left;color:var(--muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em">
              <th style="padding:12px 16px">Client</th><th style="padding:12px">Contact</th><th style="padding:12px">Platform</th>
              <th style="padding:12px">Niche</th><th style="padding:12px">Status</th><th style="padding:12px;text-align:right"></th>
            </tr></thead>
            <tbody>
              ${items.map(c => `
                <tr style="border-top:1px solid var(--border)">
                  <td style="padding:12px 16px;font-weight:600">${esc(c.name)}${c.notes ? `<div style="font-weight:400;font-size:11.5px;color:var(--faint);margin-top:2px">${esc(c.notes.slice(0, 70))}${c.notes.length > 70 ? "…" : ""}</div>` : ""}</td>
                  <td style="padding:12px">${esc(c.contact || "—")}${c.email ? `<div style="font-size:11.5px;color:var(--muted)">${esc(c.email)}</div>` : ""}${c.phone ? `<div style="font-size:11.5px;color:var(--muted)">${esc(c.phone)}</div>` : ""}</td>
                  <td style="padding:12px;text-transform:capitalize">${esc(c.platform)}</td>
                  <td style="padding:12px">${esc(c.niche || "—")}</td>
                  <td style="padding:12px">
                    <select class="input cl-status" data-id="${c.id}" style="padding:6px 8px;font-size:12px;width:auto">
                      ${Object.keys(CLIENT_STATUS_META).map(s => `<option value="${s}" ${c.status === s ? "selected" : ""}>${CLIENT_STATUS_META[s].label}</option>`).join("")}
                    </select>
                  </td>
                  <td style="padding:12px;text-align:right;white-space:nowrap">
                    <button class="icon-btn cl-edit" data-id="${c.id}" title="Edit">${icon("edit", 15)}</button>
                    <button class="icon-btn cl-del" data-id="${c.id}" title="Delete">${icon("trash", 15)}</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`}
      </div>`;

    function clientModal(existing) {
      const c = existing || { name: "", contact: "", email: "", phone: "", platform: "instagram", niche: "", status: "lead", notes: "" };
      const m = openModal({
        title: existing ? "Edit client" : "Add client",
        body: `
          <div class="stack">
            <label class="field"><span>Client / brand name *</span><input id="cm-name" value="${esc(c.name)}"></label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <label class="field"><span>Contact person</span><input id="cm-contact" value="${esc(c.contact)}"></label>
              <label class="field"><span>Main platform</span><select id="cm-platform" class="input">${platOptions(c.platform)}</select></label>
              <label class="field"><span>Email</span><input id="cm-email" value="${esc(c.email)}"></label>
              <label class="field"><span>Phone / WhatsApp</span><input id="cm-phone" value="${esc(c.phone)}"></label>
            </div>
            <label class="field"><span>Niche / industry</span><input id="cm-niche" value="${esc(c.niche)}" placeholder="e.g. fitness apparel"></label>
            <label class="field"><span>Notes</span><textarea id="cm-notes" rows="3">${esc(c.notes)}</textarea></label>
          </div>`,
        foot: `<button class="btn" id="cm-cancel">Cancel</button><button class="btn primary" id="cm-save">${icon("check", 14)} Save client</button>`,
      });
      document.getElementById("cm-cancel").onclick = () => m.close();
      document.getElementById("cm-save").onclick = async () => {
        const body = {
          name: document.getElementById("cm-name").value,
          contact: document.getElementById("cm-contact").value,
          email: document.getElementById("cm-email").value,
          phone: document.getElementById("cm-phone").value,
          platform: document.getElementById("cm-platform").value,
          niche: document.getElementById("cm-niche").value,
          notes: document.getElementById("cm-notes").value,
        };
        try {
          if (existing) await api(`/api/clients/${existing.id}`, { method: "PATCH", body });
          else await api("/api/clients", { method: "POST", body });
          m.close();
          toast(existing ? "Client updated" : "Client added");
          ROUTES.clients.render(page);
        } catch (e) { toast(e.message || "Could not save", { type: "error" }); }
      };
    }
    page.querySelector("#cl-add").onclick = () => clientModal(null);
    page.querySelectorAll(".cl-edit").forEach(b => b.onclick = () => clientModal(items.find(x => x.id == b.dataset.id)));
    page.querySelectorAll(".cl-del").forEach(b => b.onclick = async () => {
      if (!confirm("Delete this client?")) return;
      await api(`/api/clients/${b.dataset.id}`, { method: "DELETE" });
      toast("Client deleted");
      ROUTES.clients.render(page);
    });
    page.querySelectorAll(".cl-status").forEach(s => s.onchange = async () => {
      await api(`/api/clients/${s.dataset.id}`, { method: "PATCH", body: { status: s.value } });
      toast("Status updated");
    });
  },
};

/* ================= RATE CALCULATOR ================= */

ROUTES.rates = {
  title: "Rate Calculator",
  subtitle: "Know exactly what to charge — real industry pricing math, not guesses.",
  async render(page) {
    page.innerHTML = `
      <div class="stack">
        <div style="display:grid;grid-template-columns:minmax(300px,1fr) minmax(320px,1.2fr);gap:14px">
          <div class="card stack">
            <h3>${icon("dollar", 16)} Price a deal</h3>
            <label class="field"><span>Platform</span>
              <select id="rc-platform" class="input">
                ${["tiktok", "instagram", "youtube", "facebook", "x"].map(p => `<option value="${p}">${p[0].toUpperCase() + p.slice(1)}</option>`).join("")}
              </select>
            </label>
            <label class="field"><span>Your followers</span><input type="number" id="rc-followers" min="100" placeholder="e.g. 25000"></label>
            <label class="field"><span>Your engagement rate % <small style="color:var(--faint)">(3% is average)</small></span>
              <input type="number" id="rc-eng" step="0.1" value="3" min="0.1" max="30"></label>
            <label class="field"><span>What the brand wants</span>
              <select id="rc-deliv" class="input">
                <option value="video">Short video / Reel / TikTok</option>
                <option value="post">Single post</option>
                <option value="carousel">Carousel</option>
                <option value="story">Story set (3–5 frames)</option>
                <option value="live">LIVE appearance</option>
                <option value="bundle">Bundle (post + video + stories)</option>
                <option value="ambassador">Monthly ambassador (4 posts)</option>
              </select>
            </label>
            <button class="btn primary" id="rc-go">${icon("dollar", 15)} Calculate my rate</button>
          </div>
          <div id="rc-out">
            <div class="card" style="text-align:center;padding:40px">
              <div style="font-size:14px;font-weight:600">Your quote appears here</div>
              <div class="card-sub" style="margin-top:8px;line-height:1.7">The math: your estimated views × industry CPM for that platform,<br>adjusted up or down by your real engagement rate. This is how agencies price deals.</div>
            </div>
          </div>
        </div>
        <div class="card">
          <h3>How to use this when a brand offers less</h3>
          <div class="card-sub" style="line-height:1.8">
            1. Quote the <b>middle number</b> first — never open at your floor.<br>
            2. If they come in low, use the <b>Negotiation Coach</b> (Media Kit page) — it writes the counter-offer for you.<br>
            3. Once you agree, create the deal in <b>Revenue</b> and send a real invoice from <b>Invoices</b>. That's the money loop.
          </div>
        </div>
      </div>`;
    page.querySelector("#rc-go").onclick = async () => {
      try {
        const r = await api("/api/rates/calculate", { method: "POST", body: {
          platform: page.querySelector("#rc-platform").value,
          followers: parseInt(page.querySelector("#rc-followers").value) || 0,
          engagement: parseFloat(page.querySelector("#rc-eng").value) || 3,
          deliverable: page.querySelector("#rc-deliv").value,
        }});
        page.querySelector("#rc-out").innerHTML = `
          <div class="card" style="text-align:center">
            <div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">${esc(r.deliverable_label)} · ${esc(r.platform)}</div>
            <div style="font-size:44px;font-weight:800;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;margin:8px 0">$${r.mid.toLocaleString()}</div>
            <div style="display:flex;justify-content:center;gap:18px;font-size:13px;color:var(--muted);margin-bottom:14px">
              <span>Floor <b style="color:var(--text)">$${r.low.toLocaleString()}</b></span>
              <span>Ceiling <b style="color:var(--text)">$${r.high.toLocaleString()}</b></span>
            </div>
            <div style="font-size:13px;background:var(--panel-2);border:1px solid var(--border);border-radius:12px;padding:12px;line-height:1.7">${esc(r.anchor_line)}</div>
            <div style="font-size:11.5px;color:var(--faint);margin-top:10px">${esc(r.basis)}</div>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
              <button class="btn" id="rc-copy">${icon("copy", 14)} Copy quote line</button>
              <a class="btn" href="#/invoices">${icon("file", 14)} Go bill it</a>
            </div>
          </div>`;
        page.querySelector("#rc-copy").onclick = () =>
          copyText(`For a ${r.deliverable_label.toLowerCase()} on ${r.platform} my rate is $${r.mid} (range $${r.low}–$${r.high}).`, "Quote");
      } catch (e) { toast(e.message || "Check your inputs", { type: "error" }); }
    };
  },
};

/* ================= METRICS TRACKER ================= */

ROUTES.tracker = {
  title: "Metrics Tracker",
  subtitle: "Log your REAL numbers — growth and earnings tracked from data you enter.",
  async render(page) {
    page.innerHTML = `
      <div class="stack">
        <div style="display:flex;gap:6px">
          <button class="btn primary tr-tab" data-t="growth">${icon("trendUp", 14)} Growth log</button>
          <button class="btn tr-tab" data-t="posts">${icon("chart", 14)} Post performance</button>
        </div>
        <div id="tr-body"></div>
      </div>`;
    const body = page.querySelector("#tr-body");
    let tab = "growth";
    function paintTabs() { page.querySelectorAll(".tr-tab").forEach(b => b.classList.toggle("primary", b.dataset.t === tab)); }

    async function renderGrowth() {
      const [{ items }, sum] = await Promise.all([api("/api/metrics"), api("/api/metrics/summary")]);
      body.innerHTML = `
        <div class="card">
          <h3>Log today's numbers</h3>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <select id="mg-plat" class="input" style="width:130px">${platOptions("tiktok")}</select>
            <input type="date" id="mg-date" class="input" style="width:150px" value="${new Date().toISOString().slice(0, 10)}">
            <input type="number" id="mg-fol" class="input" style="flex:1;min-width:120px" placeholder="Followers" min="0">
            <input type="number" id="mg-views" class="input" style="flex:1;min-width:120px" placeholder="Views (month)" min="0">
            <input type="number" id="mg-rev" class="input" style="flex:1;min-width:120px" placeholder="Revenue $" min="0" step="0.01">
            <button class="btn primary" id="mg-add">${icon("plus", 14)} Log</button>
          </div>
        </div>
        ${sum.platforms.length ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
          ${sum.platforms.map(p => {
            const spark = items.filter(m => m.platform === p.platform).slice(0, 30).reverse().map(m => m.followers);
            const d = p.follower_delta;
            return `
            <div class="card">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <b style="text-transform:capitalize">${esc(p.platform)}</b>
                ${d !== null ? `<span class="pill ${d >= 0 ? "ok" : ""}" style="${d < 0 ? "background:rgba(248,113,113,.12);color:var(--red);border-color:rgba(248,113,113,.3)" : ""}">${d >= 0 ? "+" : ""}${d.toLocaleString()} followers</span>` : `<span class="pill">${p.entries} log${p.entries > 1 ? "s" : ""}</span>`}
              </div>
              <div style="font-size:26px;font-weight:800;margin:6px 0">${p.latest.followers.toLocaleString()}</div>
              <div style="font-size:12px;color:var(--muted)">views: ${p.latest.views.toLocaleString()} · revenue: ${fmtMoney(p.latest.revenue)}</div>
              ${spark.length > 1 ? `<div style="margin-top:8px">${sparkline(spark, 200, 40, "#22d3ee")}</div>` : `<div style="font-size:11.5px;color:var(--faint);margin-top:8px">Log a second entry to see the growth curve →</div>`}
            </div>`;
          }).join("")}
        </div>
        <div class="card" style="padding:0;overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="text-align:left;color:var(--muted);font-size:11.5px;text-transform:uppercase"><th style="padding:12px 16px">Date</th><th style="padding:12px">Platform</th><th style="padding:12px">Followers</th><th style="padding:12px">Views</th><th style="padding:12px">Revenue</th><th></th></tr></thead>
            <tbody>${items.slice(0, 40).map(m => `
              <tr style="border-top:1px solid var(--border)">
                <td style="padding:10px 16px">${esc(m.entry_date)}</td>
                <td style="padding:10px;text-transform:capitalize">${esc(m.platform)}</td>
                <td style="padding:10px">${m.followers.toLocaleString()}</td>
                <td style="padding:10px">${m.views.toLocaleString()}</td>
                <td style="padding:10px">${fmtMoney(m.revenue)}</td>
                <td style="padding:10px;text-align:right"><button class="icon-btn mg-del" data-id="${m.id}">${icon("trash", 14)}</button></td>
              </tr>`).join("")}</tbody>
          </table>
        </div>` : `
        <div class="card" style="text-align:center;padding:40px">
          <div style="font-size:15px;font-weight:600">Start tracking your real growth</div>
          <div class="card-sub" style="margin-top:8px;line-height:1.7">Enter your numbers once a week. Lumina draws your true growth curve,<br>shows what's working, and totals your real earnings.</div>
        </div>`}`;
      body.querySelector("#mg-add").onclick = async () => {
        try {
          await api("/api/metrics", { method: "POST", body: {
            platform: body.querySelector("#mg-plat").value,
            entry_date: body.querySelector("#mg-date").value,
            followers: body.querySelector("#mg-fol").value,
            views: body.querySelector("#mg-views").value,
            revenue: body.querySelector("#mg-rev").value,
          }});
          toast("Numbers logged");
          renderGrowth();
        } catch (e) { toast(e.message || "Check your numbers", { type: "error" }); }
      };
      body.querySelectorAll(".mg-del").forEach(b => b.onclick = async () => {
        await api(`/api/metrics/${b.dataset.id}`, { method: "DELETE" });
        renderGrowth();
      });
    }

    async function renderPosts() {
      const [{ items }, sum] = await Promise.all([api("/api/post-stats"), api("/api/post-stats/summary")]);
      body.innerHTML = `
        <div class="card">
          <h3>Log a post's real results</h3>
          <div class="card-sub">After 48 hours, read the numbers off the app and enter them here — Lumina finds your winners.</div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <select id="ps-plat" class="input" style="width:120px">${platOptions("tiktok")}</select>
            <input id="ps-cap" class="input" style="flex:2;min-width:160px" placeholder="Post name / first line of caption">
            <input type="date" id="ps-date" class="input" style="width:150px" value="${new Date().toISOString().slice(0, 10)}">
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            ${["views", "likes", "comments", "saves", "shares"].map(k => `<input type="number" id="ps-${k}" class="input" style="flex:1;min-width:90px" placeholder="${k[0].toUpperCase() + k.slice(1)}" min="0">`).join("")}
            <button class="btn primary" id="ps-add">${icon("plus", 14)} Log post</button>
          </div>
        </div>
        ${items.length ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
          <div class="card"><div style="font-size:12px;color:var(--muted)">Posts tracked</div><div style="font-size:26px;font-weight:800">${sum.count}</div></div>
          <div class="card"><div style="font-size:12px;color:var(--muted)">Avg engagement</div><div style="font-size:26px;font-weight:800">${sum.avg_engagement}%</div></div>
          <div class="card"><div style="font-size:12px;color:var(--muted)">Total views</div><div style="font-size:26px;font-weight:800">${sum.total_views.toLocaleString()}</div></div>
          ${sum.best[0] ? `<div class="card" style="border-color:rgba(52,211,153,.4)"><div style="font-size:12px;color:var(--green)">🏆 Best performer</div><div style="font-weight:600;margin-top:4px">${esc(sum.best[0].caption.slice(0, 40))}</div><div style="font-size:12px;color:var(--muted)">${sum.best[0].engagement_rate}% engagement</div></div>` : ""}
        </div>
        <div class="card" style="padding:0;overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="text-align:left;color:var(--muted);font-size:11.5px;text-transform:uppercase"><th style="padding:12px 16px">Post</th><th style="padding:12px">Views</th><th style="padding:12px">Likes</th><th style="padding:12px">Saves</th><th style="padding:12px">Shares</th><th style="padding:12px">Engagement</th><th></th></tr></thead>
            <tbody>${items.map(s => `
              <tr style="border-top:1px solid var(--border)">
                <td style="padding:10px 16px;max-width:260px"><b>${esc(s.caption.slice(0, 48))}</b><div style="font-size:11px;color:var(--faint)">${esc(s.platform)} · ${esc(s.posted_at)}</div></td>
                <td style="padding:10px">${s.views.toLocaleString()}</td>
                <td style="padding:10px">${s.likes.toLocaleString()}</td>
                <td style="padding:10px">${s.saves.toLocaleString()}</td>
                <td style="padding:10px">${s.shares.toLocaleString()}</td>
                <td style="padding:10px"><span class="pill ${s.engagement_rate >= 5 ? "ok" : ""}">${s.engagement_rate}%</span></td>
                <td style="padding:10px;text-align:right"><button class="icon-btn ps-del" data-id="${s.id}">${icon("trash", 14)}</button></td>
              </tr>`).join("")}</tbody>
          </table>
        </div>` : `
        <div class="card" style="text-align:center;padding:40px">
          <div style="font-size:15px;font-weight:600">No posts logged yet</div>
          <div class="card-sub" style="margin-top:8px">Log 5 posts and you'll know exactly which content style earns you money.</div>
        </div>`}`;
      body.querySelector("#ps-add").onclick = async () => {
        try {
          await api("/api/post-stats", { method: "POST", body: {
            platform: body.querySelector("#ps-plat").value,
            caption: body.querySelector("#ps-cap").value,
            posted_at: body.querySelector("#ps-date").value,
            views: body.querySelector("#ps-views").value,
            likes: body.querySelector("#ps-likes").value,
            comments: body.querySelector("#ps-comments").value,
            saves: body.querySelector("#ps-saves").value,
            shares: body.querySelector("#ps-shares").value,
          }});
          toast("Post logged");
          renderPosts();
        } catch (e) { toast(e.message || "Check your numbers", { type: "error" }); }
      };
      body.querySelectorAll(".ps-del").forEach(b => b.onclick = async () => {
        await api(`/api/post-stats/${b.dataset.id}`, { method: "DELETE" });
        renderPosts();
      });
    }

    page.querySelectorAll(".tr-tab").forEach(b => b.onclick = () => { tab = b.dataset.t; paintTabs(); tab === "growth" ? renderGrowth() : renderPosts(); });
    paintTabs();
    renderGrowth();
  },
};

/* ================= FOLLOW-UPS & TASKS ================= */

ROUTES.tasks = {
  title: "Follow-ups & Tasks",
  subtitle: "Never drop the ball — money follows up on itself here.",
  async render(page) {
    const [{ items }, sum] = await Promise.all([api("/api/tasks"), api("/api/tasks/summary")]);
    const today = new Date().toISOString().slice(0, 10);
    page.innerHTML = `
      <div class="stack">
        ${sum.follow_ups.length ? `
        <div class="card" style="border-color:rgba(251,191,36,.4)">
          <h3>${icon("alert", 16)} Money follow-ups — do these first</h3>
          <div class="stack" style="margin-top:10px">
            ${sum.follow_ups.map(f => `
              <div style="display:flex;gap:10px;align-items:center;background:${f.type === "invoice-overdue" ? "rgba(248,113,113,.08)" : "rgba(251,191,36,.08)"};border:1px solid ${f.type === "invoice-overdue" ? "rgba(248,113,113,.3)" : "rgba(251,191,36,.3)"};border-radius:10px;padding:10px 14px;font-size:13px">
                ${icon(f.type === "invoice-overdue" ? "alert" : "clock", 15)}
                <span style="flex:1">${esc(f.text)}</span>
                <a class="btn sm" href="#/invoices">Open invoices</a>
              </div>`).join("")}
          </div>
        </div>` : `
        <div class="card" style="display:flex;gap:10px;align-items:center;border-color:rgba(52,211,153,.35)">
          ${icon("check", 18)} <span>No overdue money right now. Follow-ups for invoices appear here automatically when they're due.</span>
        </div>`}
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <h3>Your tasks</h3>
            <div style="display:flex;gap:8px">
              <span class="pill">Open: <b>${sum.open}</b></span>
              ${sum.overdue ? `<span class="pill" style="background:rgba(248,113,113,.12);color:var(--red);border-color:rgba(248,113,113,.3)">Overdue: <b>${sum.overdue}</b></span>` : ""}
              ${sum.due_soon ? `<span class="pill">Due this week: <b>${sum.due_soon}</b></span>` : ""}
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <input id="tk-title" class="input" style="flex:2;min-width:180px" placeholder="e.g. Send pitch to GymShark">
            <select id="tk-client" class="input" style="width:160px"><option value="">(no client)</option></select>
            <input type="date" id="tk-due" class="input" style="width:150px" value="${today}">
            <button class="btn primary" id="tk-add">${icon("plus", 14)} Add</button>
          </div>
        </div>
        ${items.length ? `
        <div class="card" style="padding:0">
          ${items.map(t => {
            const overdue = t.status === "open" && t.due < today;
            return `
            <div style="display:flex;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid var(--border);${t.status === "done" ? "opacity:.55" : ""}">
              <input type="checkbox" class="tk-done" data-id="${t.id}" ${t.status === "done" ? "checked" : ""} style="width:17px;height:17px;cursor:pointer">
              <div style="flex:1">
                <div style="font-size:13.5px;${t.status === "done" ? "text-decoration:line-through" : ""}">${esc(t.title)}</div>
                <div style="font-size:11.5px;color:${overdue ? "var(--red)" : "var(--faint)"}">${overdue ? "⚠ overdue — " : "due "}${esc(t.due)}${t.client ? " · " + esc(t.client) : ""}</div>
              </div>
              <button class="icon-btn tk-del" data-id="${t.id}">${icon("trash", 14)}</button>
            </div>`;
          }).join("")}
        </div>` : `
        <div class="card" style="text-align:center;padding:36px;color:var(--muted)">No tasks yet — add your first to-do above.</div>`}
      </div>`;

    api("/api/clients").then(({ items: clients }) => {
      const sel = page.querySelector("#tk-client");
      if (sel) clients.forEach(c => { const o = document.createElement("option"); o.value = c.name; o.textContent = c.name; sel.appendChild(o); });
    });
    page.querySelector("#tk-add").onclick = async () => {
      const title = page.querySelector("#tk-title").value.trim();
      if (!title) { toast("Give the task a name", { type: "error" }); return; }
      try {
        await api("/api/tasks", { method: "POST", body: {
          title, due: page.querySelector("#tk-due").value, client: page.querySelector("#tk-client").value,
        }});
        toast("Task added");
        ROUTES.tasks.render(page);
      } catch (e) { toast(e.message || "Could not add", { type: "error" }); }
    };
    page.querySelectorAll(".tk-done").forEach(c => c.onchange = async () => {
      await api(`/api/tasks/${c.dataset.id}`, { method: "PATCH", body: { status: c.checked ? "done" : "open" } });
      ROUTES.tasks.render(page);
    });
    page.querySelectorAll(".tk-del").forEach(b => b.onclick = async () => {
      await api(`/api/tasks/${b.dataset.id}`, { method: "DELETE" });
      ROUTES.tasks.render(page);
    });
  },
};
