/* ============ Pages: Approvals · Audience · Reports ============ */
"use strict";

/* ============================================================ APPROVALS */
ROUTES.approvals = {
  title: "Approvals",
  subtitle: "Review drafts your teammates submitted for publishing.",
  async render(page) {
    refreshCurrentList = () => ROUTES.approvals.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="appr-count"></span>
        <span class="spacer"></span>
        <span class="faint" style="font-size:12px">Tip: teammates choose “Submit for approval” when creating a post</span>
      </div>
      <div id="appr-list" class="stack">${skeletonTable(3)}</div>`;
    let posts;
    try { posts = await api("/api/posts?status=pending"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderApprovals(posts);
  },
};

function renderApprovals(posts) {
  const box = document.getElementById("appr-list");
  if (!box) return;
  const cnt = document.getElementById("appr-count");
  if (cnt) cnt.textContent = `${posts.length} post${posts.length === 1 ? "" : "s"} waiting for review`;
  updateApprovalsBadge(posts.length);
  if (!posts.length) {
    box.innerHTML = `<div class="card">${emptyState({
      icon: "check", title: "All caught up 🎉",
      message: "No posts are waiting for approval. When teammates submit drafts for review, they'll appear here." })}</div>`;
    return;
  }
  box.innerHTML = posts.map(p => `
    <div class="card fade-in" data-id="${p.id}" style="border-left:3px solid var(--yellow)">
      <div style="display:flex;gap:13px;align-items:flex-start;flex-wrap:wrap">
        <span class="avatar" style="background:${avatarColor(p.author || "?")}">${esc(initials(p.author || "?"))}</span>
        <div style="flex:1;min-width:220px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px">
            <b style="font-size:13.5px">${esc(p.author || "Teammate")}</b>
            <span class="faint" style="font-size:12px">submitted ${timeAgo(p.updated_at)}</span>
            ${p.scheduled_at ? `<span class="badge blue">${icon("clock", 11)} aims for ${fmtDT(p.scheduled_at)}</span>` : `<span class="badge gray">no date set</span>`}
            ${p.campaign_id ? `<span class="badge purple">Campaign</span>` : ""}
          </div>
          <div class="msg-bubble" style="margin:0 0 10px">${esc(p.content)}</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            ${platRow(p.platforms, 13)}
            <span class="spacer" style="flex:1"></span>
            <button class="btn ghost sm" data-act="edit">${icon("edit", 13)} Edit</button>
            <button class="btn danger sm" data-act="reject" data-perm="reject">${icon("x", 13)} Send back</button>
            <button class="btn primary sm" data-act="approve" data-perm="approve">${icon("check", 13)} Approve${p.scheduled_at ? " & schedule" : " & publish"}</button>
          </div>
        </div>
      </div>
    </div>`).join("");
  box.querySelectorAll(".card[data-id]").forEach(card => {
    const p = posts.find(x => x.id === Number(card.dataset.id));
    card.querySelector('[data-act="edit"]').onclick = () => openPostModal(p, {});
    card.querySelector('[data-act="approve"]').onclick = async e => {
      const btn = e.currentTarget;
      buttonLoading(btn, true, "Approving…");
      card.style.transition = "opacity .25s, transform .25s";
      try {
        const np = await api(`/api/posts/${p.id}/approve`, { method: "POST" });
        card.style.opacity = "0"; card.style.transform = "translateX(24px)";
        setTimeout(() => card.remove(), 220);
        posts.splice(posts.indexOf(p), 1);
        updateApprovalsBadge(posts.length);
        toast(np.status === "scheduled" ? `Approved — scheduled for ${fmtDT(np.scheduled_at)}` : "Approved & published 🎉");
        const c = document.getElementById("appr-count");
        if (c) c.textContent = `${posts.length} post${posts.length === 1 ? "" : "s"} waiting for review`;
        if (!posts.length) setTimeout(() => renderApprovals(posts), 300);
      } catch (err) { toast(err.message, { type: "error" }); buttonLoading(btn, false); }
    };
    card.querySelector('[data-act="reject"]').onclick = async () => {
      const m = openModal({
        title: "Send back to drafts",
        body: `
          <p class="muted" style="font-size:13px;margin-bottom:13px">Return ${esc(p.author || "your teammate")}'s post to drafts. Add a note so they know what to change.</p>
          <div class="field"><label>Feedback <span class="faint">(optional)</span></label>
            <textarea class="input" id="rj-note" rows="3" placeholder="e.g. Great hook — tighten the second paragraph and swap the CTA."></textarea>
          </div>`,
        foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="rj-go">Send back</button>`,
      });
      m.el.querySelector("[data-cancel]").onclick = m.close;
      m.el.querySelector("#rj-go").onclick = async () => {
        const btn = m.el.querySelector("#rj-go");
        buttonLoading(btn, true, "Sending…");
        try {
          await api(`/api/posts/${p.id}/reject`, { method: "POST", body: { note: m.el.querySelector("#rj-note").value } });
          m.close();
          card.style.transition = "opacity .25s"; card.style.opacity = "0";
          setTimeout(() => card.remove(), 220);
          posts.splice(posts.indexOf(p), 1);
          updateApprovalsBadge(posts.length);
          toast("Sent back to drafts with feedback", { type: "info" });
          if (!posts.length) setTimeout(() => renderApprovals(posts), 300);
        } catch (err) { toast(err.message, { type: "error" }); buttonLoading(btn, false); }
      };
    };
  });
}

/* ============================================================ AUDIENCE */
ROUTES.audience = {
  title: "Audience",
  subtitle: "Who follows you, where they are, and when they show up.",
  async render(page) {
    refreshCurrentList = () => {};
    page.innerHTML = `<div id="aud-body">
      <div class="grid cols-2" style="margin-bottom:16px">${Array(2).fill('<div class="card"><div class="skel skel-block" style="height:180px"></div></div>').join("")}</div>
      <div class="card"><div class="skel skel-block" style="height:220px"></div></div>
    </div>`;
    let d;
    try { d = await api("/api/audience"); } catch (e) { toast(e.message, { type: "error" }); return; }
    const body = document.getElementById("aud-body");
    if (!d.available) {
      body.innerHTML = `<div class="card">${emptyState({
        icon: "globe", title: "No audience data yet",
        message: "Connect at least one social account and Lumina builds a demographic profile of your followers.",
        actionLabel: "Connect an account", actionId: "aud-connect" })}</div>`;
      document.getElementById("aud-connect").onclick = () => { location.hash = "#/accounts"; };
      return;
    }
    body.innerHTML = `
      <div class="grid cols-2" style="margin-bottom:16px">
        <div class="card fade-in">
          <h3>Age distribution</h3>
          <div class="card-sub">Across ${fmtNum(d.followers)} connected followers</div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px">
            ${d.age.map(a => `
              <div style="display:flex;align-items:center;gap:12px">
                <span style="width:52px;font-size:12.5px;color:var(--muted);font-weight:600">${a.label}</span>
                <div class="progress" style="flex:1;margin:0"><div class="bar" style="width:${a.pct}%;background:var(--grad)"></div></div>
                <b style="width:48px;text-align:right;font-size:13px">${a.pct}%</b>
              </div>`).join("")}
          </div>
        </div>
        <div class="card fade-in">
          <h3>Gender split</h3>
          <div class="card-sub">Self-reported & inferred signals</div>
          <div id="aud-gender" style="margin-top:8px"></div>
        </div>
      </div>
      <div class="grid cols-2" style="margin-bottom:16px">
        <div class="card fade-in">
          <h3>Top locations</h3>
          <div class="card-sub">Where your audience is based</div>
          <div style="margin-top:12px">
            ${d.locations.map(l => `
              <div class="sov-row">
                <span class="sov-name" title="${esc(l.city)}, ${esc(l.country)}">${esc(l.city)}</span>
                <div class="progress" style="margin:0"><div class="bar" style="width:${l.pct * 5.5}%;background:var(--cyan)"></div></div>
                <b>${l.pct}%</b>
              </div>`).join("")}
          </div>
        </div>
        <div class="card fade-in">
          <h3>Best times to post</h3>
          <div class="card-sub">When your audience is most active</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:14px">
            ${d.best_times.map((t, i) => `
              <div style="background:var(--bg-soft);border:1px solid var(--border);border-radius:12px;padding:14px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                  <span class="badge ${i === 0 ? "purple" : "gray"}">${i === 0 ? "★ Peak slot" : "Slot " + (i + 1)}</span>
                  <span class="faint" style="font-size:11px;margin-left:auto">score ${t.score}</span>
                </div>
                <b style="font-size:15px">${t.day}</b>
                <div class="muted" style="font-size:13px">${icon("clock", 12)} ${t.time}</div>
              </div>`).join("")}
          </div>
        </div>
      </div>
      <div class="card fade-in">
        <h3>Activity heatmap</h3>
        <div class="card-sub">Audience activity by hour — darker means more people online</div>
        <div id="aud-heat" style="overflow-x:auto"></div>
      </div>`;
    renderDonut(document.getElementById("aud-gender"),
      d.gender.map(g => ({ label: g.label, value: g.pct, pct: g.pct, color: g.color })),
      { centerLabel: "of audience" });
    // heatmap
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let heat = `<div style="display:grid;grid-template-columns:40px repeat(24, minmax(13px, 1fr));gap:3px;min-width:560px">
      <div></div>${Array.from({ length: 24 }, (_, h) => `<div style="font-size:9px;color:var(--faint);text-align:center">${h % 3 === 0 ? h : ""}</div>`).join("")}`;
    d.hours.forEach((row, di) => {
      heat += `<div style="font-size:10.5px;color:var(--muted);font-weight:700;display:flex;align-items:center">${days[di]}</div>`;
      row.forEach((v, h) => {
        heat += `<div title="${days[di]} ${String(h).padStart(2, "0")}:00 — activity ${v}/100"
          style="aspect-ratio:1;border-radius:3px;background:rgba(139,92,246,${(0.05 + (v / 100) * 0.85).toFixed(2)});min-height:13px"></div>`;
      });
    });
    heat += `</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:11px;color:var(--faint)">
        Less <span style="width:12px;height:12px;border-radius:3px;background:rgba(139,92,246,.1)"></span>
        <span style="width:12px;height:12px;border-radius:3px;background:rgba(139,92,246,.4)"></span>
        <span style="width:12px;height:12px;border-radius:3px;background:rgba(139,92,246,.75)"></span> More
      </div>`;
    document.getElementById("aud-heat").innerHTML = heat;
  },
};

/* ============================================================ REPORTS */
ROUTES.reports = {
  title: "Reports",
  subtitle: "Auto-generated weekly performance summaries.",
  async render(page) {
    refreshCurrentList = () => ROUTES.reports.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="rep-count"></span>
        <span class="spacer"></span>
        <button class="btn primary sm" id="rep-gen">${icon("sparkles", 14)} Generate this week's report</button>
      </div>
      <div id="rep-body">${skeletonCards(3, 170)}</div>
      <div class="card mt-16" id="rep-detail" style="display:none"></div>`;
    document.getElementById("rep-gen").onclick = async e => {
      const btn = e.currentTarget;
      buttonLoading(btn, true, "Compiling…");
      try {
        await api("/api/reports/generate", { method: "POST" });
        toast("Report generated 📊");
        refreshCurrentList();
      } catch (err) {
        toast(err.message, { type: err.status === 409 ? "info" : "error" });
        buttonLoading(btn, false);
      }
    };
    let reports;
    try { reports = await api("/api/reports"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderReports(reports);
  },
};

function reportStatCells(s) {
  return [
    ["Reach", fmtNum(s.reach), s.reach_delta != null ? `${s.reach_delta > 0 ? "+" : ""}${s.reach_delta}%` : null, s.reach_delta >= 0],
    ["Engagement", s.engagement + "%", null, true],
    ["Followers", (s.followers_delta >= 0 ? "+" : "") + fmtNum(s.followers_delta), null, s.followers_delta >= 0],
    ["Clicks", fmtNum(s.clicks), null, true],
    ["Published", s.published + " posts", null, true],
  ];
}

function renderReports(reports) {
  const body = document.getElementById("rep-body");
  if (!body) return;
  const cnt = document.getElementById("rep-count");
  if (cnt) cnt.textContent = `${reports.length} report${reports.length === 1 ? "" : "s"} on file`;
  if (!reports.length) {
    body.innerHTML = `<div class="card">${emptyState({
      icon: "file", title: "No reports yet",
      message: "Generate your first weekly report — Lumina compiles reach, engagement, growth and publishing volume automatically.",
      actionLabel: "Generate this week's report", actionId: "rep-empty-gen" })}</div>`;
    document.getElementById("rep-empty-gen").onclick = () => document.getElementById("rep-gen").click();
    return;
  }
  body.innerHTML = `<div class="grid cols-3">${reports.map(r => `
    <div class="card fade-in" data-id="${r.id}" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px">
        <span class="li-ico" style="background:rgba(139,92,246,.13);color:#c4b5fd;width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center">${icon("file", 17)}</span>
        <button class="icon-btn danger" data-act="del" title="Delete report">${icon("trash", 14)}</button>
      </div>
      <h4 style="font-size:14px;margin-bottom:3px">${esc(r.title)}</h4>
      <div class="faint" style="font-size:12px;margin-bottom:13px">${fmtDate(r.period_start)} → ${fmtDate(r.period_end)}</div>
      <div style="display:flex;gap:16px">
        <div><b style="font-size:16px;letter-spacing:-.02em">${fmtNum(r.stats.reach)}</b><br><span class="faint" style="font-size:11px">reach</span></div>
        <div><b style="font-size:16px;letter-spacing:-.02em">${r.stats.engagement}%</b><br><span class="faint" style="font-size:11px">engagement</span></div>
        <div><b style="font-size:16px;letter-spacing:-.02em" class="${r.stats.followers_delta >= 0 ? "delta-up" : "delta-down"}">${r.stats.followers_delta >= 0 ? "+" : ""}${fmtNum(r.stats.followers_delta)}</b><br><span class="faint" style="font-size:11px">followers</span></div>
      </div>
    </div>`).join("")}</div>
    <p class="faint mt-16" style="font-size:12px">Click a report to expand the full summary, then export it as Markdown.</p>`;
  body.querySelectorAll(".card[data-id]").forEach(card => {
    const r = reports.find(x => x.id === Number(card.dataset.id));
    card.onclick = () => showReportDetail(r);
    card.querySelector('[data-act="del"]').onclick = async e => {
      e.stopPropagation();
      const ok = await confirmModal({ title: "Delete report", message: `Delete “${r.title}”? This can't be undone.` });
      if (!ok) return;
      card.style.transition = "opacity .2s"; card.style.opacity = "0";
      setTimeout(() => card.remove(), 180);
      reports.splice(reports.indexOf(r), 1);
      toast("Report deleted", { type: "info" });
      api(`/api/reports/${r.id}`, { method: "DELETE" }).catch(() => refreshCurrentList());
      const det = document.getElementById("rep-detail");
      if (det && det.dataset.rid === String(r.id)) det.style.display = "none";
    };
  });
}

function showReportDetail(r) {
  const det = document.getElementById("rep-detail");
  det.style.display = "";
  det.dataset.rid = r.id;
  det.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <h3>${esc(r.title)}</h3>
      <span class="badge purple">${fmtDate(r.period_start)} → ${fmtDate(r.period_end)}</span>
      <span class="spacer" style="flex:1"></span>
      <button class="btn sm" id="rep-export">${icon("copy", 13)} Export as Markdown</button>
    </div>
    <div class="grid cols-4" style="gap:12px">
      ${reportStatCells(r.stats).map(([label, val, delta, good]) => `
        <div style="background:var(--bg-soft);border:1px solid var(--border);border-radius:12px;padding:13px">
          <div class="muted" style="font-size:11.5px;font-weight:600;margin-bottom:5px">${label}</div>
          <b style="font-size:18px;letter-spacing:-.02em">${val}</b>
          ${delta ? `<span class="stat-delta ${good ? "delta-up" : "delta-down"}" style="margin-left:7px">${delta}</span>` : ""}
        </div>`).join("")}
    </div>`;
  det.querySelector("#rep-export").onclick = async () => {
    const s = r.stats;
    const md = [
      `# ${r.title}`, "",
      `**Period:** ${fmtDate(r.period_start)} → ${fmtDate(r.period_end)}`, "",
      `| Metric | Value |`, `|---|---|`,
      `| Reach | ${s.reach.toLocaleString()} (${s.reach_delta > 0 ? "+" : ""}${s.reach_delta}% vs prev. week) |`,
      `| Impressions | ${s.impressions.toLocaleString()} |`,
      `| Engagement rate | ${s.engagement}% |`,
      `| Link clicks | ${s.clicks.toLocaleString()} |`,
      `| Follower growth | ${s.followers_delta >= 0 ? "+" : ""}${s.followers_delta.toLocaleString()} |`,
      `| Posts published | ${s.published} |`, "",
      `_Generated by Lumina — AI Social Media Suite_`,
    ].join("\n");
    try { await navigator.clipboard.writeText(md); } catch (e) {
      const ta = document.createElement("textarea"); ta.value = md; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    toast("Markdown summary copied to clipboard");
  };
  det.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
