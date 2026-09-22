/* ============ Pages: Inbox · Team · Media · Billing · Competitors ============ */
"use strict";

/* ---------------- multi-line chart ---------------- */
function renderMultiLine(container, { series, labels }, { fmt = fmtNum } = {}) {
  const W = 760, H = 250, PL = 48, PR = 12, PT = 14, PB = 26;
  if (!series.length || !series[0].values.length) {
    container.innerHTML = `<div class="empty" style="padding:30px"><p class="muted">Add a competitor to see the comparison.</p></div>`;
    return;
  }
  const n = series[0].values.length;
  const max = Math.max(...series.flatMap(s => s.values)) * 1.1 || 1;
  const X = i => PL + (i / (n - 1)) * (W - PL - PR);
  const Y = v => PT + (1 - v / max) * (H - PT - PB);
  let grid = "";
  for (let g = 0; g <= 3; g++) {
    const y = PT + (g / 3) * (H - PT - PB);
    grid += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="rgba(255,255,255,.05)"/>
             <text x="${PL - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#6b7284">${fmt(max * (1 - g / 3))}</text>`;
  }
  const paths = series.map(s =>
    `<path d="${smoothPath(s.values.map((v, i) => [X(i), Y(v)]))}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join("");
  const ticks = [0, Math.floor((n - 1) / 2), n - 1]
    .map(i => `<text x="${X(i)}" y="${H - 7}" text-anchor="middle" font-size="10.5" fill="#6b7284">${esc(labels[i] || "")}</text>`).join("");
  const legend = series.map(s => `<span class="lg"><span class="sw" style="background:${s.color}"></span>${esc(s.label)}</span>`).join("");
  container.innerHTML = `
    <div class="legend" style="margin-bottom:10px">${legend}</div>
    <div class="chart-box">
      <svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block">
        ${grid}${paths}
        <line class="guide" y1="${PT}" y2="${H - PB}" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 3" style="display:none"/>
        ${ticks}
      </svg>
      <div class="chart-tip"></div>
    </div>`;
  const svg = container.querySelector("svg");
  const guide = container.querySelector(".guide");
  const tip = container.querySelector(".chart-tip");
  svg.addEventListener("mousemove", e => {
    const r = svg.getBoundingClientRect();
    let idx = Math.round((((e.clientX - r.left) / r.width) * W - PL) / (W - PL - PR) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    guide.style.display = "";
    guide.setAttribute("x1", X(idx)); guide.setAttribute("x2", X(idx));
    tip.style.display = "block";
    tip.innerHTML = series.map(s => `<b style="color:${s.color}">${fmt(s.values[idx])}</b> <span>${esc(s.label)}</span>`).join("<br>") +
      `<br><span>${esc(labels[idx] || "")}</span>`;
    tip.style.left = (X(idx) / W) * 100 + "%";
    tip.style.top = "18%";
  });
  svg.addEventListener("mouseleave", () => { guide.style.display = "none"; tip.style.display = "none"; });
}

function avatarColor(s) {
  const palette = ["#3b82f6", "#22d3ee", "#f59e0b", "#34d399", "#fbbf24", "#60a5fa"];
  let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
function fmtBytes(b) {
  if (b >= 1e6) return (b / 1e6).toFixed(1) + " MB";
  if (b >= 1e3) return Math.round(b / 1e3) + " KB";
  return b + " B";
}

/* ============================================================ INBOX */
const SENT_META = {
  positive: { cls: "sent-positive", label: "😊 Positive" },
  negative: { cls: "sent-negative", label: "⚠️ Needs care" },
  neutral: { cls: "sent-neutral", label: "😐 Neutral" },
  question: { cls: "sent-question", label: "❓ Question" },
};
const TYPE_META = { comment: ["gray", "Comment"], mention: ["purple", "Mention"], dm: ["blue", "Direct message"] };
let inboxState = { items: [], selectedId: null, filter: "all" };

ROUTES.inbox = {
  title: "Inbox",
  subtitle: "Comments, mentions and DMs — every channel, one queue.",
  async render(page) {
    refreshCurrentList = () => ROUTES.inbox.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <div class="tabs" id="inbox-tabs"></div>
        <span class="spacer"></span>
        <span class="muted" id="inbox-summary"></span>
      </div>
      <div class="inbox-layout">
        <div class="card" style="padding:8px"><div class="conv-list" id="conv-list">${skeletonTable(5)}</div></div>
        <div class="card conv-detail" id="conv-detail"><div class="skel skel-block" style="height:260px"></div></div>
      </div>`;
    try {
      inboxState.items = await api("/api/inbox");
    } catch (e) { toast(e.message, { type: "error" }); return; }
    if (!inboxState.selectedId && inboxState.items.length) inboxState.selectedId = inboxState.items[0].id;
    renderInboxTabs(); renderConvList(); renderConvDetail();
  },
};

function inboxFiltered() {
  const f = inboxState.filter;
  return inboxState.items.filter(c => {
    if (f === "all") return c.status !== "archived";
    if (f === "unread") return c.unread && !["archived", "resolved"].includes(c.status);
    if (f === "archived") return c.status === "archived";
    if (["comment", "mention", "dm"].includes(f)) return c.type === f && c.status !== "archived";
    return true;
  });
}

function renderInboxTabs() {
  const it = inboxState.items;
  const counts = {
    all: it.filter(c => c.status !== "archived").length,
    unread: it.filter(c => c.unread && !["archived", "resolved"].includes(c.status)).length,
    comment: it.filter(c => c.type === "comment" && c.status !== "archived").length,
    mention: it.filter(c => c.type === "mention" && c.status !== "archived").length,
    dm: it.filter(c => c.type === "dm" && c.status !== "archived").length,
    archived: it.filter(c => c.status === "archived").length,
  };
  const labels = { all: "All", unread: "Unread", comment: "Comments", mention: "Mentions", dm: "DMs", archived: "Archived" };
  const tabs = document.getElementById("inbox-tabs");
  if (!tabs) return;
  tabs.innerHTML = Object.keys(labels).map(k =>
    `<button class="tab ${inboxState.filter === k ? "active" : ""}" data-f="${k}">${labels[k]}<span class="n">${counts[k]}</span></button>`).join("");
  tabs.querySelectorAll("[data-f]").forEach(b => b.onclick = () => {
    inboxState.filter = b.dataset.f;
    const list = inboxFiltered();
    inboxState.selectedId = list.length ? list[0].id : null;
    renderInboxTabs(); renderConvList(); renderConvDetail();
  });
  const s = document.getElementById("inbox-summary");
  if (s) s.textContent = counts.unread ? `${counts.unread} unread message${counts.unread === 1 ? "" : "s"}` : "Inbox zero 🎉";
}

function renderConvList() {
  const box = document.getElementById("conv-list");
  if (!box) return;
  const list = inboxFiltered();
  if (!list.length) {
    box.innerHTML = emptyState({ icon: "comment", title: "Nothing here", message: "No messages in this view. New comments, mentions and DMs will land here." });
    return;
  }
  box.innerHTML = list.map(c => `
    <div class="conv-item ${c.id === inboxState.selectedId ? "active" : ""} ${c.unread ? "unread" : ""}" data-id="${c.id}">
      ${platIcon(c.platform, 13)}
      <div class="c-main">
        <div class="c-top"><b>${esc(c.author)}</b><span class="c-time">${timeAgo(c.created_at)}</span></div>
        <div class="c-snippet">${esc(c.content)}</div>
      </div>
      ${c.unread ? `<span class="unread-dot"></span>` : ""}
    </div>`).join("");
  box.querySelectorAll(".conv-item").forEach(el => el.onclick = () => {
    inboxState.selectedId = Number(el.dataset.id);
    const c = inboxState.items.find(x => x.id === inboxState.selectedId);
    if (c && c.unread) {
      c.unread = false; // optimistic
      api(`/api/inbox/${c.id}`, { method: "PATCH", body: { unread: false } }).catch(() => {});
      api("/api/inbox/unread").then(d => updateInboxBadge(d.count)).catch(() => {});
    }
    renderInboxTabs(); renderConvList(); renderConvDetail();
  });
}

function renderConvDetail() {
  const box = document.getElementById("conv-detail");
  if (!box) return;
  const c = inboxState.items.find(x => x.id === inboxState.selectedId);
  if (!c) {
    box.innerHTML = emptyState({ icon: "inbox", title: "Select a conversation", message: "Pick a message from the list to read and reply." });
    return;
  }
  const sent = SENT_META[c.sentiment] || SENT_META.neutral;
  const [tcls, tlabel] = TYPE_META[c.type] || TYPE_META.comment;
  const color = avatarColor(c.author_handle);
  box.innerHTML = `
    <div class="cd-head">
      <span class="cd-ava" style="background:${color}">${esc(initials(c.author))}</span>
      <div style="flex:1;min-width:0">
        <b style="font-size:14.5px">${esc(c.author)}</b>
        <div class="muted" style="font-size:12px">${esc(c.author_handle)} · ${PLATFORMS[c.platform]?.name || c.platform} · ${timeAgo(c.created_at)}</div>
      </div>
      <span class="badge ${tcls}">${tlabel}</span>
      <span class="sent-badge ${sent.cls}">${sent.label}</span>
    </div>
    ${c.post_ref ? `<div class="msg-bubble" style="border-left:3px solid var(--accent)"><div class="mb-meta">${icon("file", 12)} In reply to your post</div>${esc(c.post_ref)}</div>` : ""}
    <div class="msg-bubble">${esc(c.content)}</div>
    ${(c.replies || []).map(r => `
      <div class="msg-bubble reply">
        <div class="mb-meta"><b>${esc(r.author)}</b> · ${timeAgo(r.at)} ${platIcon(c.platform, 10)}</div>
        ${esc(r.text)}
      </div>`).join("")}
    <div id="cd-suggest"></div>
    ${c.status !== "archived" ? `
    <div class="composer mt-16">
      <div id="qr-row" class="qr-row"></div>
      <textarea class="input" id="cd-text" placeholder="Write a reply as ${esc(state.user.workspace)}…"></textarea>
      <div style="display:flex;flex-direction:column;gap:7px">
        <button class="btn sm" id="cd-ai">${icon("sparkles", 13)} AI reply</button>
        <button class="btn primary sm" id="cd-send" data-perm="reply">${icon("send", 13)} Send</button>
      </div>
    </div>` : `<p class="muted mt-16" style="font-size:12.5px">This conversation is archived.</p>`}
    <div class="divider"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn sm" id="cd-resolve">${icon("check", 13)} ${c.status === "resolved" ? "Reopen" : "Resolve"}</button>
      <button class="btn sm" id="cd-archive">${icon("inbox", 13)} ${c.status === "archived" ? "Unarchive" : "Archive"}</button>
      <button class="btn ghost sm" id="cd-unread">${icon("eye", 13)} Mark unread</button>
      <span class="spacer" style="flex:1"></span>
      <span class="badge ${c.status === "new" ? "purple" : c.status === "replied" ? "blue" : c.status === "resolved" ? "green" : "gray"}">${c.status}</span>
    </div>`;

  const send = async () => {
    const ta = document.getElementById("cd-text");
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) { toast("Write something first", { type: "info" }); return; }
    const btn = document.getElementById("cd-send");
    buttonLoading(btn, true, "Sending…");
    try {
      const updated = await api(`/api/inbox/${c.id}/reply`, { method: "POST", body: { content: text } });
      Object.assign(c, updated);
      toast("Reply sent");
      renderInboxTabs(); renderConvList(); renderConvDetail();
    } catch (e) { toast(e.message, { type: "error" }); buttonLoading(btn, false); }
  };
  const sendBtn = document.getElementById("cd-send");
  if (sendBtn) sendBtn.onclick = send;
  loadQuickReplies();
  const ta = document.getElementById("cd-text");
  if (ta) ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); });

  const aiBtn = document.getElementById("cd-ai");
  if (aiBtn) aiBtn.onclick = async () => {
    buttonLoading(aiBtn, true, "Thinking…");
    const sg = document.getElementById("cd-suggest");
    sg.innerHTML = `<div class="suggest-box"><div class="thinking"><div class="t-line"><span class="spin"></span>Drafting a reply in your brand voice…</div></div></div>`;
    try {
      const r = await api(`/api/inbox/${c.id}/ai-reply`, { method: "POST" });
      sg.innerHTML = `<div class="suggest-box">
        <div class="mb-8" style="font-size:11.5px;font-weight:700;color:#93c5fd;display:flex;gap:6px;align-items:center">${icon("sparkles", 12)} AI suggestions — click to use</div>
        ${r.suggestions.map(s => `<div class="sg">${esc(s)}</div>`).join("")}
      </div>`;
      sg.querySelectorAll(".sg").forEach(el => el.onclick = () => {
        const t = document.getElementById("cd-text");
        if (t) { t.value = el.textContent; t.focus(); }
        sg.innerHTML = "";
      });
    } catch (e) { sg.innerHTML = ""; toast(e.message, { type: "error" }); }
    buttonLoading(aiBtn, false);
  };

  const patchStatus = async (field, value, label) => {
    const prev = { [field]: c[field] };
    c[field] = value; // optimistic
    if (field === "status") { renderInboxTabs(); renderConvList(); renderConvDetail(); }
    else renderConvList();
    toast(label, { type: "info", action: { label: "Undo", onClick: () => {
      Object.assign(c, prev);
      api(`/api/inbox/${c.id}`, { method: "PATCH", body: prev }).catch(() => {});
      renderInboxTabs(); renderConvList(); renderConvDetail();
    }}});
    try { await api(`/api/inbox/${c.id}`, { method: "PATCH", body: { [field]: value } }); }
    catch (e) { Object.assign(c, prev); toast(e.message, { type: "error" }); renderInboxTabs(); renderConvList(); renderConvDetail(); }
    api("/api/inbox/unread").then(d => updateInboxBadge(d.count)).catch(() => {});
  };
  document.getElementById("cd-resolve").onclick = () =>
    patchStatus("status", c.status === "resolved" ? "new" : "resolved", c.status === "resolved" ? "Conversation reopened" : "Marked resolved ✓");
  document.getElementById("cd-archive").onclick = () =>
    patchStatus("status", c.status === "archived" ? "new" : "archived", c.status === "archived" ? "Conversation restored" : "Archived");
  document.getElementById("cd-unread").onclick = () => {
    patchStatus("unread", true, "Marked as unread");
  };
}

/* ============================================================ TEAM */
const ROLE_META = { admin: ["role-admin", "Admin"], editor: ["role-editor", "Editor"], viewer: ["role-viewer", "Viewer"] };

ROUTES.team = {
  title: "Team",
  subtitle: "People who can create, approve and publish in this workspace.",
  async render(page) {
    refreshCurrentList = () => ROUTES.team.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="team-count"></span>
        <span class="spacer"></span>
        <button class="btn primary sm" id="team-invite" data-perm="team">${icon("plus", 14)} Invite teammate</button>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="list-item" style="border:none;padding:4px 0">
          <span class="avatar" style="background:${state.user.avatar_color};width:38px;height:38px">${esc(initials(state.user.name))}</span>
          <div class="li-main"><b>${esc(state.user.name)} <span class="role-badge role-admin" style="margin-left:6px">Owner</span></b><span>${esc(state.user.email)}</span></div>
          <div class="li-side"><span class="badge green"><span class="dot"></span>Active</span></div>
        </div>
      </div>
      <div class="card" style="padding:8px 16px"><div id="team-table">${skeletonTable(4)}</div></div>`;
    document.getElementById("team-invite").onclick = () => openInviteModal();
    let members;
    try { members = await api("/api/team"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderTeam(members);
  },
};

function renderTeam(members) {
  const box = document.getElementById("team-table");
  if (!box) return;
  document.getElementById("team-count").textContent =
    `${members.filter(m => m.status === "active").length} active · ${members.filter(m => m.status === "invited").length} pending invite`;
  if (!members.length) {
    box.innerHTML = emptyState({ icon: "users", title: "No teammates yet", message: "Invite editors to draft content, or admins to manage accounts and billing.", actionLabel: "Invite someone", actionId: "team-empty-invite" });
    document.getElementById("team-empty-invite").onclick = () => openInviteModal();
    return;
  }
  box.innerHTML = `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
      <tbody>
      ${members.map(m => {
        const stBadge = m.status === "active" ? `<span class="badge green"><span class="dot"></span>Active</span>`
          : m.status === "invited" ? `<span class="badge yellow"><span class="dot"></span>Invite pending</span>`
          : `<span class="badge gray"><span class="dot"></span>Deactivated</span>`;
        return `<tr data-id="${m.id}">
          <td data-label="Member"><div style="display:flex;gap:11px;align-items:center">
            <span class="avatar" style="background:${m.avatar_color}">${esc(initials(m.name))}</span>
            <div class="cell-main"><b>${esc(m.name)}</b><div class="sub">${esc(m.email)}</div></div>
          </div></td>
          <td data-label="Role"><select class="input role-select" data-role>
            ${["admin", "editor", "viewer"].map(r => `<option value="${r}" ${m.role === r ? "selected" : ""}>${ROLE_META[r][1]}</option>`).join("")}
          </select></td>
          <td data-label="Status">${stBadge}</td>
          <td data-label="Joined"><span class="metric-cell">${fmtDate(m.joined_at)}</span></td>
          <td><div class="row-actions">
            ${m.status === "invited" ? `<button class="btn ghost sm" data-act="resend">Resend</button>` : ""}
            <button class="icon-btn danger" data-act="del" title="Remove from team">${icon("trash", 15)}</button>
          </div></td>
        </tr>`;
      }).join("")}
      </tbody></table></div>`;
  box.querySelectorAll("tr[data-id]").forEach(tr => {
    const m = members.find(x => x.id === Number(tr.dataset.id));
    tr.querySelector("[data-role]").onchange = async e => {
      const role = e.target.value;
      const prev = m.role;
      m.role = role; // optimistic
      try {
        await api(`/api/team/${m.id}`, { method: "PATCH", body: { role } });
        toast(`${m.name.split(" ")[0]} is now ${role === "admin" ? "an" : "an"} ${role}`.replace("an an", "an").replace("a editor", "an editor"), { type: "info" });
      } catch (err) { m.role = prev; e.target.value = prev; toast(err.message, { type: "error" }); }
    };
    const resend = tr.querySelector('[data-act="resend"]');
    if (resend) resend.onclick = async () => {
      buttonLoading(resend, true, "Sending…");
      try {
        await api(`/api/team/${m.id}`, { method: "PATCH", body: { status: "invited" } });
        toast(`Invite re-sent to ${m.email}`);
      } catch (e) { toast(e.message, { type: "error" }); }
      buttonLoading(resend, false, "Resend");
    };
    tr.querySelector('[data-act="del"]').onclick = async () => {
      const ok = await confirmModal({ title: "Remove teammate", message: `Remove ${m.name} from the workspace? Their drafts stay, but they lose access immediately.`, confirmLabel: "Remove" });
      if (!ok) return;
      tr.style.transition = "opacity .2s"; tr.style.opacity = "0";
      setTimeout(() => tr.remove(), 180);
      const idx = members.indexOf(m); members.splice(idx, 1);
      toast(`${m.name} removed`, { type: "info", action: { label: "Undo", onClick: async () => {
        try {
          const nm = await api("/api/team", { method: "POST", body: { name: m.name, email: m.email, role: m.role } });
          nm.status = m.status;
          members.splice(idx, 0, nm); renderTeam(members); toast("Teammate restored");
        } catch (e) { toast("Couldn't restore", { type: "error" }); }
      }}});
      api(`/api/team/${m.id}`, { method: "DELETE" }).catch(() => { members.splice(idx, 0, m); renderTeam(members); });
    };
  });
}

function openInviteModal() {
  const m = openModal({
    title: "Invite a teammate",
    body: `
      <div class="field"><label>Full name</label><input class="input" id="inv-name" placeholder="Jamie Rivera"></div>
      <div class="field"><label>Email</label><input class="input" id="inv-email" type="email" placeholder="jamie@company.com"></div>
      <div class="field"><label>Role</label>
        <select class="input" id="inv-role">
          <option value="editor">Editor — can draft & schedule posts</option>
          <option value="admin">Admin — full workspace control</option>
          <option value="viewer">Viewer — read-only access</option>
        </select>
      </div>
      <div class="form-error" id="inv-error"></div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="inv-send">${icon("send", 13)} Send invite</button>`,
  });
  m.el.querySelector("[data-cancel]").onclick = m.close;
  m.el.querySelector("#inv-send").onclick = async () => {
    const errEl = m.el.querySelector("#inv-error");
    errEl.classList.remove("show");
    const btn = m.el.querySelector("#inv-send");
    buttonLoading(btn, true, "Sending…");
    try {
      await api("/api/team", { method: "POST", body: {
        name: m.el.querySelector("#inv-name").value,
        email: m.el.querySelector("#inv-email").value,
        role: m.el.querySelector("#inv-role").value,
      }});
      m.close(); toast("Invite sent ✉️"); refreshCurrentList();
    } catch (e) { errEl.textContent = e.message; errEl.classList.add("show"); buttonLoading(btn, false); }
  };
}

/* ============================================================ MEDIA */
ROUTES.media = {
  title: "Media Library",
  subtitle: "Every asset your team ships with, in one place.",
  async render(page) {
    refreshCurrentList = () => ROUTES.media.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="media-count"></span>
        <span class="spacer"></span>
        <button class="btn sm" id="media-design">${icon("image", 14)} New design asset</button>
        <button class="btn primary sm" id="media-upload-btn" data-perm="create">${icon("plus", 14)} Upload</button>
        <input type="file" id="media-file" accept="image/*" style="display:none">
      </div>
      <div class="upload-zone mb-8" id="media-drop" style="margin-bottom:16px">
        ${icon("image", 20)} &nbsp;Drop images here or click <b>Upload</b> — PNG / JPG / SVG up to 2&nbsp;MB
      </div>
      <div id="media-grid">${skeletonCards(4, 200)}</div>`;
    const fileInput = document.getElementById("media-file");
    document.getElementById("media-upload-btn").onclick = () => fileInput.click();
    document.getElementById("media-drop").onclick = () => fileInput.click();
    document.getElementById("media-design").onclick = () => openDesignModal();
    fileInput.onchange = async () => {
      const f = fileInput.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { toast("File too large — 2 MB max in this demo", { type: "error" }); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api("/api/media", { method: "POST", body: { name: f.name, kind: "image", data: reader.result, size: f.size, tags: ["upload"] } });
          toast(`Uploaded ${f.name}`);
          refreshCurrentList();
        } catch (e) { toast(e.message, { type: "error" }); }
      };
      reader.readAsDataURL(f);
      fileInput.value = "";
    };
    let assets;
    try { assets = await api("/api/media"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderMedia(assets);
  },
};

function renderMedia(assets) {
  const grid = document.getElementById("media-grid");
  if (!grid) return;
  const total = assets.reduce((s, a) => s + a.size, 0);
  document.getElementById("media-count").textContent = `${assets.length} assets · ${fmtBytes(total)} used`;
  if (!assets.length) {
    grid.innerHTML = `<div class="card">${emptyState({
      icon: "image", title: "Your library is empty",
      message: "Upload brand images, export designs, or generate a placeholder asset to get started.",
      actionLabel: "Generate an asset", actionId: "media-empty-new" })}</div>`;
    document.getElementById("media-empty-new").onclick = () => openDesignModal();
    return;
  }
  grid.innerHTML = `<div class="grid cols-4">${assets.map(a => `
    <div class="card media-card fade-in" data-id="${a.id}">
      <div class="m-actions">
        <button class="icon-btn" data-act="edit" title="Edit">${icon("edit", 14)}</button>
        <button class="icon-btn danger" data-act="del" title="Delete">${icon("trash", 14)}</button>
      </div>
      <div class="m-thumb">
        ${a.data ? `<img src="${a.data}" alt="${esc(a.name)}">` : `<div style="text-align:center;color:var(--muted)">${icon(a.kind === "video" ? "play" : "file", 30)}<div style="font-size:11px;margin-top:6px">${a.kind === "video" ? "Video" : "File"}</div></div>`}
      </div>
      <div class="m-body">
        <b title="${esc(a.name)}">${esc(a.name)}</b>
        <div class="m-meta">${a.kind.toUpperCase()} · ${fmtBytes(a.size)} · ${timeAgo(a.created_at)}</div>
        <div class="m-tags">${(a.tags || []).map(t => `<span>#${esc(t)}</span>`).join("")}</div>
      </div>
    </div>`).join("")}</div>`;
  grid.querySelectorAll(".media-card").forEach(card => {
    const a = assets.find(x => x.id === Number(card.dataset.id));
    card.querySelector('[data-act="edit"]').onclick = () => openMediaEditModal(a);
    card.querySelector('[data-act="del"]').onclick = async () => {
      card.style.transition = "opacity .2s, transform .2s"; card.style.opacity = "0"; card.style.transform = "scale(.96)";
      setTimeout(() => card.remove(), 180);
      const idx = assets.indexOf(a); assets.splice(idx, 1);
      document.getElementById("media-count").textContent = `${assets.length} assets`;
      toast("Asset deleted", { type: "info", action: { label: "Undo", onClick: async () => {
        try {
          const na = await api("/api/media", { method: "POST", body: { name: a.name, kind: a.kind, data: a.data, size: a.size, tags: a.tags } });
          assets.splice(idx, 0, na); renderMedia(assets); toast("Asset restored");
        } catch (e) { toast("Couldn't restore", { type: "error" }); }
      }}});
      api(`/api/media/${a.id}`, { method: "DELETE" }).catch(() => { assets.splice(idx, 0, a); renderMedia(assets); });
    };
  });
}

function openMediaEditModal(a) {
  const m = openModal({
    title: "Edit asset",
    body: `
      <div class="field"><label>File name</label><input class="input" id="me-name" value="${esc(a.name)}"></div>
      <div class="field"><label>Tags <span class="faint">(comma separated)</span></label><input class="input" id="me-tags" value="${esc((a.tags || []).join(", "))}"></div>
      <div class="form-error" id="me-error"></div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="me-save">Save</button>`,
  });
  m.el.querySelector("[data-cancel]").onclick = m.close;
  m.el.querySelector("#me-save").onclick = async () => {
    const btn = m.el.querySelector("#me-save");
    buttonLoading(btn, true, "Saving…");
    try {
      await api(`/api/media/${a.id}`, { method: "PATCH", body: {
        name: m.el.querySelector("#me-name").value.trim() || a.name,
        tags: m.el.querySelector("#me-tags").value.split(",").map(t => t.trim()).filter(Boolean),
      }});
      m.close(); toast("Asset updated"); refreshCurrentList();
    } catch (e) { const el = m.el.querySelector("#me-error"); el.textContent = e.message; el.classList.add("show"); buttonLoading(btn, false); }
  };
}

const DESIGN_PALETTES = [["#3b82f6", "#06b6d4"], ["#0ea5e9", "#22d3ee"], ["#f59e0b", "#fbbf24"], ["#10b981", "#6ee7b7"], ["#ef4444", "#f97316"], ["#334155", "#64748b"]];
const DESIGN_EMOJI = ["🚀", "✨", "🎨", "📈", "🔥", "💡", "🎯", "🧠"];

function openDesignModal() {
  const m = openModal({
    title: "Generate a design asset",
    body: `
      <div class="field"><label>Asset name</label><input class="input" id="dg-name" placeholder="e.g. spring-sale-hero.png"></div>
      <div class="field"><label>Palette</label>
        <div class="chip-row" id="dg-pal">${DESIGN_PALETTES.map((p, i) => `<span class="chip ${i === 0 ? "active" : ""}" data-p="${i}" style="padding:7px 10px"><span style="width:22px;height:14px;border-radius:4px;background:linear-gradient(120deg,${p[0]},${p[1]});display:inline-block"></span></span>`).join("")}</div>
      </div>
      <div class="field"><label>Icon</label>
        <div class="chip-row" id="dg-emoji">${DESIGN_EMOJI.map((e, i) => `<span class="chip ${i === 0 ? "active" : ""}" data-e="${e}" style="font-size:16px">${e}</span>`).join("")}</div>
      </div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="dg-go">${icon("sparkles", 13)} Generate</button>`,
  });
  let pal = 0, emoji = DESIGN_EMOJI[0];
  m.el.querySelectorAll("#dg-pal .chip").forEach(c => c.onclick = () => { m.el.querySelectorAll("#dg-pal .chip").forEach(x => x.classList.remove("active")); c.classList.add("active"); pal = Number(c.dataset.p); });
  m.el.querySelectorAll("#dg-emoji .chip").forEach(c => c.onclick = () => { m.el.querySelectorAll("#dg-emoji .chip").forEach(x => x.classList.remove("active")); c.classList.add("active"); emoji = c.dataset.e; });
  m.el.querySelector("[data-cancel]").onclick = m.close;
  m.el.querySelector("#dg-go").onclick = async () => {
    const name = m.el.querySelector("#dg-name").value.trim() || `design-${Date.now() % 10000}.svg`;
    const [c1, c2] = DESIGN_PALETTES[pal];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='640' height='400' rx='0' fill='url(#g)'/><text x='320' y='205' font-size='96' text-anchor='middle'>${emoji}</text><text x='320' y='290' font-family='sans-serif' font-size='24' font-weight='bold' fill='rgba(255,255,255,.9)' text-anchor='middle'>${esc(name.replace(/\.[a-z]+$/i, ""))}</text></svg>`;
    const btn = m.el.querySelector("#dg-go");
    buttonLoading(btn, true, "Generating…");
    try {
      await api("/api/media", { method: "POST", body: { name, kind: "image", data: "data:image/svg+xml," + encodeURIComponent(svg), size: svg.length, tags: ["design", "generated"] } });
      m.close(); toast("Design asset generated 🎨"); refreshCurrentList();
    } catch (e) { toast(e.message, { type: "error" }); buttonLoading(btn, false); }
  };
}

/* ============================================================ BILLING */
const PLAN_FEATURES = {
  Starter: ["60 AI credits / month", "3 connected accounts", "15 scheduled posts", "Basic analytics", "Email support"],
  Pro: ["500 AI credits / month", "6 connected accounts", "Unlimited scheduling", "Full analytics + reports", "Unified inbox & team roles", "Priority support"],
  Scale: ["2,000 AI credits / month", "Unlimited accounts", "Competitor tracking", "Approvals workflow", "API access", "Dedicated success manager"],
};

ROUTES.billing = {
  title: "Billing",
  subtitle: "Plans, usage and payment history.",
  async render(page) {
    refreshCurrentList = () => {};
    page.innerHTML = `
      <div id="bill-body">
        <div class="grid cols-3" style="margin-bottom:16px">${Array(3).fill('<div class="card"><div class="skel skel-line" style="width:45%"></div><div class="skel" style="height:40px;width:55%;margin-top:12px"></div><div class="skel skel-block" style="height:90px;margin-top:12px"></div></div>').join("")}</div>
        <div class="card">${skeletonTable(4)}</div>
      </div>`;
    let b;
    try { b = await api("/api/billing"); } catch (e) { toast(e.message, { type: "error" }); return; }
    drawBilling(b);
  },
};

function drawBilling(b) {
  const body = document.getElementById("bill-body");
  if (!body) return;
  const plans = Object.entries(b.plans);
  body.innerHTML = `
    <div class="grid cols-3" style="margin-bottom:16px">
      ${plans.map(([name, p]) => `
        <div class="card plan-card ${b.plan === name ? "current" : ""}">
          ${b.plan === name ? `<span class="badge purple current-pill">Current plan</span>` : ""}
          <div class="p-name">${name}</div>
          <div class="p-price">$${p.price}<span> /month</span></div>
          <div class="p-tag">${p.tagline}</div>
          <ul>${PLAN_FEATURES[name].map(f => `<li>${icon("check", 13)} ${f}</li>`).join("")}</ul>
          <button class="btn ${b.plan === name ? "" : "primary"} block" data-perm="billing" data-plan="${name}" ${b.plan === name ? "disabled" : ""}>
            ${b.plan === name ? "Your current plan" : "Switch to " + name}
          </button>
        </div>`).join("")}
    </div>
    <div class="settings-grid">
      <div class="stack">
        <div class="card">
          <h3>AI credit usage</h3>
          <div class="card-sub">Resets monthly · ${b.plan} plan includes ${b.credits.limit} credits</div>
          <div class="usage-bar">
            <div class="u-top"><span>Used this cycle</span><b>${b.credits.used} / ${b.credits.limit}</b></div>
            <div class="progress"><div class="bar" style="width:${Math.min(100, (b.credits.used / b.credits.limit) * 100)}%;background:var(--grad)"></div></div>
          </div>
          <p class="muted" style="font-size:12px">Post generations cost 10 credits, AI replies cost 2.</p>
        </div>
        <div class="card">
          <h3>Payment method</h3>
          <div class="card-sub">Charged on the 14th of each month</div>
          <div class="list-item" style="border:none;padding:6px 0">
            <span class="li-ico" style="background:var(--panel-2);color:var(--muted);font-weight:800;font-size:10px;letter-spacing:.05em">VISA</span>
            <div class="li-main"><b>Visa ending in 4242</b><span>Expires 08/2028 · billing@${esc(state.user.email.split("@")[1] || "company.com")}</span></div>
            <button class="btn ghost sm" id="bill-card-edit">Update</button>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>Invoices</h3>
        <div class="card-sub">Everything you've been billed for.</div>
        ${b.invoices.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Invoice</th><th>Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>${b.invoices.map(i => `
            <tr>
              <td data-label="Invoice"><div class="cell-main"><b>${esc(i.description)}</b><div class="sub">${esc(i.number)}</div></div></td>
              <td data-label="Date"><span class="metric-cell">${fmtDate(i.date)}</span></td>
              <td data-label="Amount"><b>$${i.amount.toFixed(2)}</b></td>
              <td data-label="Status"><span class="badge ${i.status === "paid" ? "green" : "yellow"}">${i.status}</span></td>
              <td><button class="icon-btn" data-pdf="${i.id}" title="Download PDF">${icon("external", 14)}</button></td>
            </tr>`).join("")}
          </tbody></table></div>`
        : emptyState({ icon: "file", title: "No invoices yet", message: "Your billing history will appear here after your first charge." })}
      </div>
    </div>`;
  body.querySelectorAll("[data-plan]").forEach(btn => btn.onclick = async () => {
    const plan = btn.dataset.plan;
    const ok = await confirmModal({
      title: `Switch to ${plan}?`,
      message: `Your workspace moves to the ${plan} plan ($${b.plans[plan].price}/mo) immediately, prorated for this cycle. Credits reset to the ${plan} allowance next cycle.`,
      confirmLabel: `Switch to ${plan}`, danger: false,
    });
    if (!ok) return;
    buttonLoading(btn, true, "Processing…");
    try {
      state.user = await api("/api/billing/switch", { method: "POST", body: { plan } });
      toast(`Welcome to ${plan} 🎉`);
      setTimeout(() => renderRoute(), 600);
    } catch (e) { toast(e.message, { type: "error" }); buttonLoading(btn, false); }
  });
  body.querySelectorAll("[data-pdf]").forEach(btn => btn.onclick = () => toast("In production this downloads the PDF invoice", { type: "info" }));
  const ce = document.getElementById("bill-card-edit");
  if (ce) ce.onclick = () => toast("Card management would open the Stripe portal here", { type: "info" });
}

/* ============================================================ COMPETITORS */
/* ---------------- quick replies ---------------- */
async function loadQuickReplies() {
  const row = document.getElementById("qr-row");
  if (!row) return;
  let snippets = [];
  try { snippets = await api("/api/quick-replies"); } catch (e) { return; }
  row.innerHTML = `<span class="faint" style="font-size:11px;align-self:center">${icon("zap", 11)} Quick replies:</span>
    ${snippets.map(s => `<span class="chip" data-qr="${s.id}" title="${esc(s.body)}">${esc(s.title)}</span>`).join("")}
    <span class="chip" id="qr-manage" style="border-style:dashed">${icon("sliders", 11)} Manage</span>`;
  row.querySelectorAll("[data-qr]").forEach(chip => chip.onclick = () => {
    const s = snippets.find(x => x.id === +chip.dataset.qr);
    const t = document.getElementById("cd-text");
    if (t && s) { t.value = s.body; t.focus(); }
  });
  const mg = document.getElementById("qr-manage");
  if (mg) mg.onclick = () => openQuickReplyModal();
}

function openQuickReplyModal() {
  const m = openModal({
    title: "Manage quick replies",
    body: `<div id="qr-list">${skeletonTable(3)}</div>
      <div class="divider" style="margin:14px 0"></div>
      <div class="field"><label>New snippet — name</label><input class="input" id="qr-title" placeholder="e.g. Pricing question"></div>
      <div class="field"><label>Text</label><textarea class="input" id="qr-body" rows="3" placeholder="The canned reply text…"></textarea></div>`,
    foot: `<button class="btn" data-close>Done</button><button class="btn primary" id="qr-add">${icon("plus", 14)} Add snippet</button>`,
  });
  const refresh = async () => {
    const box = m.el.querySelector("#qr-list");
    let snippets = [];
    try { snippets = await api("/api/quick-replies"); } catch (e) {}
    box.innerHTML = snippets.length ? snippets.map(s => `
      <div class="list-item">
        <div class="li-main"><b>${esc(s.title)}</b><span style="white-space:normal">${esc(s.body.slice(0, 90))}${s.body.length > 90 ? "…" : ""}</span></div>
        <button class="icon-btn danger" data-qdel="${s.id}" title="Delete">${icon("trash", 14)}</button>
      </div>`).join("")
      : `<p class="muted" style="font-size:12.5px">No snippets yet — add one below.</p>`;
    box.querySelectorAll("[data-qdel]").forEach(btn => btn.onclick = async () => {
      await api(`/api/quick-replies/${btn.dataset.qdel}`, { method: "DELETE" });
      toast("Snippet deleted", { type: "info" });
      refresh(); loadQuickReplies();
    });
  };
  refresh();
  m.el.querySelector("#qr-add").onclick = async () => {
    const title = m.el.querySelector("#qr-title").value.trim();
    const body = m.el.querySelector("#qr-body").value.trim();
    if (!title || !body) { toast("Fill in both fields", { type: "info" }); return; }
    buttonLoading(m.el.querySelector("#qr-add"), true);
    try {
      await api("/api/quick-replies", { method: "POST", body: { title, body } });
      m.el.querySelector("#qr-title").value = "";
      m.el.querySelector("#qr-body").value = "";
      toast("Snippet added");
      refresh(); loadQuickReplies();
    } catch (e) { toast(e.message, { type: "error" }); }
    buttonLoading(m.el.querySelector("#qr-add"), false);
  };
}

ROUTES.competitors = {
  title: "Competitors",
  subtitle: "Benchmark your growth against the brands you watch.",
  async render(page) {
    refreshCurrentList = () => ROUTES.competitors.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="comp-count"></span>
        <span class="spacer"></span>
        <button class="btn primary sm" id="comp-add" data-perm="create">${icon("plus", 14)} Track a competitor</button>
      </div>
      <div class="card" style="margin-bottom:16px">
        <h3>Follower growth — you vs. them</h3>
        <div class="card-sub">Last 30 days</div>
        <div id="comp-chart"><div class="skel skel-block" style="height:230px"></div></div>
      </div>
      <div class="grid cols-3" id="comp-cards">${skeletonCards(3, 150)}</div>`;
    document.getElementById("comp-add").onclick = () => openCompetitorModal();
    let comps, mine;
    try {
      [comps, mine] = await Promise.all([api("/api/competitors"), api("/api/analytics?range=30")]);
    } catch (e) { toast(e.message, { type: "error" }); return; }
    drawCompetitors(comps, mine);
  },
};

function drawCompetitors(comps, mine) {
  const chart = document.getElementById("comp-chart");
  const cards = document.getElementById("comp-cards");
  if (!chart || !cards) return;
  document.getElementById("comp-count").textContent = comps.length ? `Tracking ${comps.length} competitor${comps.length === 1 ? "" : "s"}` : "";
  const labels = mine.series.map(x => new Date(x.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  const series = [{ label: state.user.workspace + " (you)", color: "#3b82f6", values: mine.series.map(x => x.followers) }];
  comps.forEach(c => series.push({ label: c.name, color: c.color, values: c.series }));
  renderMultiLine(chart, { series, labels });
  if (!comps.length) {
    cards.innerHTML = `<div class="card" style="grid-column:1/-1">${emptyState({
      icon: "trendUp", title: "No competitors tracked",
      message: "Add a rival brand and Lumina scans their public profile, then charts growth side-by-side with yours.",
      actionLabel: "Track your first competitor", actionId: "comp-empty-add" })}</div>`;
    document.getElementById("comp-empty-add").onclick = () => openCompetitorModal();
    return;
  }
  const totalAudience = mine.summary.followers + comps.reduce((s, c) => s + c.followers, 0);
  const sov = [
    { name: state.user.workspace + " (you)", value: mine.summary.followers, color: "#3b82f6" },
    ...comps.map(c => ({ name: c.name, value: c.followers, color: c.color })),
  ].sort((a, b) => b.value - a.value);
  cards.innerHTML = `
    <div class="card">
      <h3>Share of audience</h3>
      <div class="card-sub">Followers across tracked brands</div>
      ${sov.map(s => `
        <div class="sov-row">
          <span class="sov-name">${esc(s.name)}</span>
          <div class="progress"><div class="bar" style="width:${(s.value / totalAudience) * 100}%;background:${s.color}"></div></div>
          <b>${Math.round((s.value / totalAudience) * 100)}%</b>
        </div>`).join("")}
    </div>
    ${comps.map(c => `
      <div class="card comp-card fade-in" style="--comp-color:${c.color}" data-id="${c.id}">
        <div class="comp-head">
          <span class="comp-ico" style="background:${c.color}">${esc(initials(c.name))}</span>
          <div style="flex:1;min-width:0">
            <b style="font-size:14px;display:block">${esc(c.name)}</b>
            <span class="muted" style="font-size:12px">${esc(c.handle)} · ${PLATFORMS[c.platform]?.name || c.platform}</span>
          </div>
          <button class="icon-btn" data-act="battle" title="Run battle report (5 credits)">${icon("zap", 15)}</button>
          <button class="icon-btn danger" data-act="del" title="Stop tracking">${icon("trash", 15)}</button>
        </div>
        <div class="comp-stats">
          <div><b>${fmtNum(c.followers)}</b><span>Followers</span></div>
          <div><b class="${c.growth >= 0 ? "delta-up" : "delta-down"}">${c.growth >= 0 ? "+" : ""}${c.growth}%</b><span>30-day growth</span></div>
          <div><b>${c.engagement}%</b><span>Engagement</span></div>
        </div>
      </div>`).join("")}`;
  cards.querySelectorAll(".comp-card").forEach(card => {
    const c = comps.find(x => x.id === Number(card.dataset.id));
    card.querySelector('[data-act="battle"]').onclick = () => openBattleModal(c);
    card.querySelector('[data-act="del"]').onclick = async () => {
      const ok = await confirmModal({ title: "Stop tracking", message: `Stop tracking ${c.name}? Their historical data is removed from your charts.`, confirmLabel: "Stop tracking" });
      if (!ok) return;
      card.style.transition = "opacity .2s"; card.style.opacity = "0";
      setTimeout(() => card.remove(), 180);
      comps.splice(comps.indexOf(c), 1);
      toast(`Stopped tracking ${c.name}`, { type: "info" });
      api(`/api/competitors/${c.id}`, { method: "DELETE" }).catch(() => refreshCurrentList());
      setTimeout(() => drawCompetitors(comps, mine), 250);
    };
  });
}

function openBattleModal(c) {
  const m = openModal({
    title: `Battle report — you vs ${esc(c.name)}`,
    wide: true,
    body: `<div id="battle-body">
      <div class="thinking" style="padding:30px 0"><div class="t-line"><span class="spin"></span>
      Scanning ${esc(c.name)}'s public footprint and crunching 30 days of head-to-head data…</div></div>
    </div>`,
    foot: `<button class="btn" data-close>Close</button>`,
  });
  api(`/api/competitors/${c.id}/battle`, { method: "POST" }).then(b => {
    const box = m.el.querySelector("#battle-body");
    if (!box) return;
    const fmtV = (v, f) => f === "pct" ? v + "%" : fmtNum(v);
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <span class="badge ${b.leading ? "green" : "red"}" style="font-size:13px;padding:7px 13px">
          ${b.leading ? icon("trendUp", 13) + " You're leading" : icon("alert", 13) + " You're behind"} — ${b.score} metrics</span>
        <span class="faint" style="font-size:12px">5 credits used · ${b.credits_left} left</span>
      </div>
      ${b.rows.map(r => {
        const total = Math.max(r.you, r.them) || 1;
        return `
        <div style="margin-bottom:13px">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px">
            <span class="muted">${r.metric}</span>
            <span><b style="color:${r.winner === "you" ? "#34d399" : "var(--text)"}">${fmtV(r.you, r.fmt)}</b>
            <span class="faint"> you · them </span><b style="color:${r.winner === "them" ? "#f87171" : "var(--text)"}">${fmtV(r.them, r.fmt)}</b></span>
          </div>
          <div style="display:flex;gap:4px;height:8px">
            <div style="width:${(r.you / total) * 100}%;border-radius:4px;background:var(--grad)"></div>
            <div style="width:${(r.them / total) * 100}%;border-radius:4px;background:${c.color || "#64748b"};opacity:.55"></div>
          </div>
        </div>`;
      }).join("")}
      <div class="msg-bubble" style="margin-top:16px"><div class="mb-meta">${icon("sparkles", 12)} Verdict</div>${esc(b.verdict)}</div>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
        ${b.advice.map(a => `<div class="badge gray" style="font-size:12px;padding:8px 12px;font-weight:400;text-align:left;white-space:normal;flex:1;min-width:200px">💡 ${esc(a)}</div>`).join("")}
      </div>`;
    if (typeof updateCreditsPill === "function") {
      state.user.ai_credits_used = (state.user.credits_limit || 0) - b.credits_left;
      updateCreditsPill();
    }
  }).catch(e => {
    const box = m.el.querySelector("#battle-body");
    if (box) box.innerHTML = `<div class="empty">${icon("alert", 22)}<b>Couldn't run the battle</b><p class="muted">${esc(e.message)}</p></div>`;
  });
}

function openCompetitorModal() {
  const m = openModal({
    title: "Track a competitor",
    body: `
      <div class="field"><label>Brand name</label><input class="input" id="cp-name" placeholder="e.g. PixelForge"></div>
      <div class="field"><label>Handle</label><input class="input" id="cp-handle" placeholder="@theirbrand"></div>
      <div class="field"><label>Platform</label>
        <select class="input" id="cp-platform">${Object.entries(PLATFORMS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("")}</select>
      </div>
      <div class="form-error" id="cp-error"></div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="cp-go">${icon("search", 13)} Scan profile</button>`,
  });
  m.el.querySelector("[data-cancel]").onclick = m.close;
  m.el.querySelector("#cp-go").onclick = async () => {
    const errEl = m.el.querySelector("#cp-error");
    errEl.classList.remove("show");
    const btn = m.el.querySelector("#cp-go");
    buttonLoading(btn, true, "Scanning…");
    try {
      await api("/api/competitors", { method: "POST", body: {
        name: m.el.querySelector("#cp-name").value,
        handle: m.el.querySelector("#cp-handle").value,
        platform: m.el.querySelector("#cp-platform").value,
      }});
      m.close(); toast("Competitor added — chart updated"); refreshCurrentList();
    } catch (e) { errEl.textContent = e.message; errEl.classList.add("show"); buttonLoading(btn, false); }
  };
}
