/* ============ pages8: Profile Studio · Thread & Carousel Studio · Launch Kit · Publish Assistant ============ */
"use strict";

async function copyText(text, label) {
  try { await navigator.clipboard.writeText(text); toast((label || "Text") + " copied"); }
  catch (e) { toast("Copy failed — select and copy manually", { type: "error" }); }
}

const TONE_CHIPS = ["casual", "professional", "witty", "inspiring", "bold"];

function toneChipsHTML(id, active = "casual") {
  return `<div class="chip-row" id="${id}">${TONE_CHIPS.map(t =>
    `<span class="chip ${t === active ? "active" : ""}" data-tone="${t}">${t[0].toUpperCase() + t.slice(1)}</span>`).join("")}</div>`;
}
function wireTones(el) {
  el.querySelectorAll(".chip[data-tone]").forEach(c => c.onclick = () => {
    el.querySelectorAll(".chip[data-tone]").forEach(x => x.classList.remove("active"));
    c.classList.add("active");
  });
}
function pickedTone(el) {
  const a = el.querySelector(".chip[data-tone].active");
  return a ? a.dataset.tone : "casual";
}
function afterAICall(res) {
  if (res && typeof res.credits_left === "number" && state.user) {
    state.user.ai_credits_used = (state.user.credits_limit || 0) - res.credits_left;
    if (typeof updateCreditsPill === "function") updateCreditsPill();
  }
}

/* ============================================================ PROFILE STUDIO */
ROUTES.profile = {
  title: "Profile Studio",
  subtitle: "Bios, handles and a first post — ready to paste into your real accounts.",
  async render(page) {
    refreshCurrentList = () => {};
    page.innerHTML = `
      <div class="gen-layout">
        <div class="stack">
          <div class="card">
            <h3>Brief the studio</h3>
            <div class="card-sub">Everything is generated for you to review and paste — Lumina never touches your accounts.</div>
            <div class="field"><label>Your niche / topic</label>
              <input class="input" id="pf-niche" placeholder="e.g. home bakery, fitness coaching, indie SaaS"></div>
            <div class="field"><label>Name or brand <span class="faint">(optional)</span></label>
              <input class="input" id="pf-name" placeholder="e.g. Mia / Crumb & Co"></div>
            <div class="field"><label>Vibe</label>${toneChipsHTML("pf-tone")}</div>
            <div class="field"><label>Main platform</label>
              <select class="input" id="pf-plat">${Object.entries(PLATFORMS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("")}</select></div>
            <button class="btn primary lg block" id="pf-go" data-perm="generate">${icon("user", 16)} Generate profile kit</button>
            <p class="faint text-c" style="font-size:11.5px;margin-top:9px">Uses 10 AI credits</p>
          </div>
        </div>
        <div class="stack"><div id="pf-out">${emptyState({ icon: "user", title: "Your kit appears here",
          message: "Fill in a niche and hit Generate — you'll get 3 bios, handle ideas, a first post and hashtags." })}</div></div>
      </div>`;
    wireTones(document.getElementById("pf-tone"));
    document.getElementById("pf-go").onclick = async () => {
      const niche = document.getElementById("pf-niche").value.trim();
      if (!niche) { toast("Give me a niche first", { type: "info" }); return; }
      const btn = document.getElementById("pf-go");
      buttonLoading(btn, true, "Writing your profile…");
      try {
        const r = await api("/api/ai/profile", { method: "POST", body: {
          niche, name: document.getElementById("pf-name").value.trim(),
          tone: pickedTone(document.getElementById("pf-tone")),
          platform: document.getElementById("pf-plat").value,
        }});
        afterAICall(r);
        renderProfileKit(r);
        toast("Profile kit ready — review and copy what you like");
      } catch (e) { toast(e.message, { type: "error" }); }
      buttonLoading(btn, false);
    };
  },
};

function renderProfileKit(r) {
  const out = document.getElementById("pf-out");
  if (!out) return;
  out.innerHTML = `
    <div class="card fade-in">
      <h3>Bio options <span class="badge purple">${PLATFORMS[r.platform]?.name || r.platform}</span></h3>
      ${r.bios.map((b, i) => `
        <div class="msg-bubble" style="margin-top:10px">
          <div class="mb-meta"><b>Option ${i + 1}</b><span style="margin-left:auto"><button class="btn sm" data-copy="${i}">${icon("copy", 12)} Copy</button></span></div>
          ${esc(b)}
        </div>`).join("")}
    </div>
    <div class="card fade-in">
      <h3>Handle ideas</h3>
      <div class="card-sub">Click any to copy — check availability when you create the account.</div>
      <div class="chip-row">${r.handles.map(h => `<span class="chip" data-handle="${esc(h)}">${esc(h)}</span>`).join("")}</div>
    </div>
    <div class="card fade-in">
      <h3>First post</h3>
      <div class="msg-bubble">${esc(r.first_post)}<br><br><span class="faint">${esc(r.hashtags.join(" "))}</span></div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn sm" id="pf-copy-post">${icon("copy", 13)} Copy post</button>
        <button class="btn sm" id="pf-copy-tags">${icon("copy", 13)} Copy hashtags</button>
        <button class="btn primary sm" id="pf-to-post">${icon("send", 13)} Save as draft post</button>
      </div>
    </div>
    <div class="card fade-in">
      <h3>Avatar idea</h3>
      <div class="card-sub">Paste this prompt into any image generator for a profile picture.</div>
      <div class="msg-bubble">${esc(r.avatar_prompt)}</div>
      <button class="btn sm mt-16" id="pf-copy-avatar">${icon("copy", 13)} Copy prompt</button>
    </div>`;
  out.querySelectorAll("[data-copy]").forEach(btn => btn.onclick = () => copyText(r.bios[+btn.dataset.copy], "Bio"));
  out.querySelectorAll("[data-handle]").forEach(ch => ch.onclick = () => copyText(ch.dataset.handle, "Handle"));
  out.querySelector("#pf-copy-post").onclick = () => copyText(r.first_post, "First post");
  out.querySelector("#pf-copy-tags").onclick = () => copyText(r.hashtags.join(" "), "Hashtags");
  out.querySelector("#pf-copy-avatar").onclick = () => copyText(r.avatar_prompt, "Avatar prompt");
  out.querySelector("#pf-to-post").onclick = () => openPostModal(null, { content: r.first_post + "\n\n" + r.hashtags.join(" "), platforms: [r.platform] || ["instagram"] });
}

/* ============================================================ THREAD & CAROUSEL STUDIO */
ROUTES.studio = {
  title: "Thread & Carousel",
  subtitle: "Long-form formats, written for you in seconds.",
  async render(page) {
    refreshCurrentList = () => {};
    page.innerHTML = `
      <div class="seg" id="st-tabs" style="margin-bottom:14px">
        <button class="active" data-st="thread">🧵 Thread builder</button>
        <button data-st="carousel">▤ Carousel outline</button>
      </div>
      <div class="gen-layout">
        <div class="stack">
          <div class="card">
            <h3 id="st-title">Thread brief</h3>
            <div class="field"><label>Topic</label><input class="input" id="st-topic" placeholder="e.g. 5 lessons from my first year freelancing"></div>
            <div class="field"><label>Vibe</label>${toneChipsHTML("st-tone")}</div>
            <div class="field" id="st-count-wrap"><label>Number of posts</label>
              <select class="input" id="st-count"><option>4</option><option selected>6</option><option>8</option><option>10</option></select></div>
            <button class="btn primary lg block" id="st-go" data-perm="generate">${icon("file", 16)} <span id="st-go-label">Write thread</span></button>
            <p class="faint text-c" style="font-size:11.5px;margin-top:9px">Uses 10 AI credits</p>
          </div>
        </div>
        <div class="stack"><div id="st-out">${emptyState({ icon: "file", title: "Nothing written yet",
          message: "Pick a topic and let the studio draft the full format — you edit, you post." })}</div></div>
      </div>`;
    wireTones(document.getElementById("st-tone"));
    let mode = "thread";
    document.querySelectorAll("#st-tabs button").forEach(b => b.onclick = () => {
      document.querySelectorAll("#st-tabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      mode = b.dataset.st;
      document.getElementById("st-title").textContent = mode === "thread" ? "Thread brief" : "Carousel brief";
      document.getElementById("st-go-label").textContent = mode === "thread" ? "Write thread" : "Outline carousel";
      document.getElementById("st-count-wrap").style.display = mode === "thread" ? "" : "none";
    });
    document.getElementById("st-go").onclick = async () => {
      const topic = document.getElementById("st-topic").value.trim();
      if (!topic) { toast("Give me a topic first", { type: "info" }); return; }
      const btn = document.getElementById("st-go");
      buttonLoading(btn, true, mode === "thread" ? "Writing thread…" : "Designing slides…");
      const tone = pickedTone(document.getElementById("st-tone"));
      try {
        if (mode === "thread") {
          const r = await api("/api/ai/thread", { method: "POST", body: { topic, tone, count: +document.getElementById("st-count").value } });
          afterAICall(r); renderThread(r);
        } else {
          const r = await api("/api/ai/carousel", { method: "POST", body: { topic, tone } });
          afterAICall(r); renderCarousel(r);
        }
        toast("Draft ready — make it yours");
      } catch (e) { toast(e.message, { type: "error" }); }
      buttonLoading(btn, false);
    };
  },
};

function renderThread(r) {
  const out = document.getElementById("st-out");
  out.innerHTML = `
    <div class="card fade-in">
      <h3>Thread — ${r.count} posts <span class="faint" style="font-size:12px;font-weight:400">about “${esc(r.topic)}”</span></h3>
      ${r.posts.map((p, i) => `
        <div class="msg-bubble" style="margin-top:10px">
          <div class="mb-meta"><b>${i + 1}/${r.count}</b><span style="margin-left:auto"><button class="btn sm" data-tc="${i}">${icon("copy", 12)} Copy</button></span></div>
          ${esc(p)}
        </div>`).join("")}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn sm" id="th-copy-all">${icon("copy", 13)} Copy whole thread</button>
        <button class="btn primary sm" id="th-to-post">${icon("send", 13)} Save hook as draft post</button>
      </div>
    </div>`;
  out.querySelectorAll("[data-tc]").forEach(b => b.onclick = () => copyText(r.posts[+b.dataset.tc], "Post"));
  out.querySelector("#th-copy-all").onclick = () => copyText(r.posts.join("\n\n---\n\n"), "Thread");
  out.querySelector("#th-to-post").onclick = () => openPostModal(null, { content: r.posts[0], platforms: ["x"] });
}

function renderCarousel(r) {
  const out = document.getElementById("st-out");
  out.innerHTML = `
    <div class="card fade-in">
      <h3>Carousel — ${r.slides.length} slides <span class="faint" style="font-size:12px;font-weight:400">about “${esc(r.topic)}”</span></h3>
      <div class="card-sub">Design each slide in your favorite tool — text is ready below.</div>
      <div class="grid cols-2" style="gap:12px">
      ${r.slides.map(s => `
        <div class="card" style="margin:0;${s.type === "cover" ? "border-color:rgba(59,130,246,.5)" : s.type === "cta" ? "border-color:rgba(34,211,238,.4)" : ""}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="badge ${s.type === "cover" ? "purple" : s.type === "cta" ? "cyan" : "gray"}">Slide ${s.n} · ${s.type}</span>
            <span style="margin-left:auto"><button class="btn sm" data-sc="${s.n}">${icon("copy", 12)}</button></span>
          </div>
          <b style="font-size:13.5px;display:block;margin-bottom:5px">${esc(s.title)}</b>
          <span class="muted" style="font-size:12.5px;line-height:1.5">${esc(s.caption)}</span>
        </div>`).join("")}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn sm" id="ca-copy-all">${icon("copy", 13)} Copy all slide text</button>
        <button class="btn primary sm" id="ca-to-post">${icon("send", 13)} Save cover as draft post</button>
      </div>
    </div>`;
  out.querySelectorAll("[data-sc]").forEach(b => b.onclick = () => {
    const s = r.slides.find(x => x.n === +b.dataset.sc);
    copyText(s.title + "\n" + s.caption, "Slide " + s.n);
  });
  out.querySelector("#ca-copy-all").onclick = () =>
    copyText(r.slides.map(s => `Slide ${s.n} — ${s.title}\n${s.caption}`).join("\n\n"), "Carousel");
  out.querySelector("#ca-to-post").onclick = () =>
    openPostModal(null, { content: r.slides[0].title + "\n\n" + r.slides[0].caption, platforms: ["instagram"] });
}

/* ============================================================ LAUNCH KIT */
ROUTES.launch = {
  title: "Launch Kit",
  subtitle: "Your first week on social media, planned end-to-end.",
  async render(page) {
    refreshCurrentList = () => {};
    page.innerHTML = `
      <div class="gen-layout">
        <div class="stack">
          <div class="card">
            <h3>${icon("rocket", 16)} Plan the launch</h3>
            <div class="card-sub">One brief in → a full week of setup, profiles and content ideas out. You create the accounts and post by hand; Lumina prepares everything.</div>
            <div class="field"><label>Your niche / business</label>
              <input class="input" id="lk-niche" placeholder="e.g. specialty coffee cart, freelance design, plant shop"></div>
            <div class="field"><label>Vibe</label>${toneChipsHTML("lk-tone")}</div>
            <div class="field"><label>Platforms to launch on</label>
              <div class="chip-row" id="lk-plats">${Object.entries(PLATFORMS).map(([k, v], i) =>
                `<span class="chip ${i < 2 ? "active" : ""}" data-plat="${k}">${platIcon(k, 12)} ${v.name}</span>`).join("")}</div></div>
            <button class="btn primary lg block" id="lk-go" data-perm="generate">${icon("rocket", 16)} Build my launch kit</button>
            <p class="faint text-c" style="font-size:11.5px;margin-top:9px">Uses 15 AI credits</p>
          </div>
        </div>
        <div class="stack"><div id="lk-out">${emptyState({ icon: "rocket", title: "No kit yet",
          message: "Tell me what you're launching and I'll write the whole first-week plan." })}</div></div>
      </div>`;
    wireTones(document.getElementById("lk-tone"));
    document.querySelectorAll("#lk-plats .chip").forEach(c => c.onclick = () => c.classList.toggle("active"));
    document.getElementById("lk-go").onclick = async () => {
      const niche = document.getElementById("lk-niche").value.trim();
      if (!niche) { toast("Tell me what you're launching", { type: "info" }); return; }
      const plats = [...document.querySelectorAll("#lk-plats .chip.active")].map(c => c.dataset.plat);
      if (!plats.length) { toast("Pick at least one platform", { type: "info" }); return; }
      const btn = document.getElementById("lk-go");
      buttonLoading(btn, true, "Planning your launch…");
      try {
        const r = await api("/api/ai/launchkit", { method: "POST", body: { niche, tone: pickedTone(document.getElementById("lk-tone")), platforms: plats } });
        afterAICall(r); renderLaunchKit(r);
        toast("Launch kit ready 🚀");
      } catch (e) { toast(e.message, { type: "error" }); }
      buttonLoading(btn, false);
    };
  },
};

function renderLaunchKit(r) {
  const out = document.getElementById("lk-out");
  out.innerHTML = `
    ${Object.entries(r.profiles).map(([plat, p]) => `
      <div class="card fade-in">
        <h3>${platIcon(plat, 14)} ${PLATFORMS[plat]?.name || plat} profile</h3>
        <div class="grid cols-2" style="gap:10px;align-items:start">
          <div><div class="faint" style="font-size:11px;margin-bottom:4px">HANDLE — click to copy</div>
            <span class="chip" data-lk-copy="${esc(p.handles[0] || "")}">${esc(p.handles[0] || "—")}</span>
            <div class="faint" style="font-size:11px;margin:10px 0 4px">BIO</div>
            <div class="msg-bubble">${esc(p.bios[0])}</div></div>
          <div><div class="faint" style="font-size:11px;margin-bottom:4px">FIRST POST</div>
            <div class="msg-bubble">${esc(p.first_post)}<br><br><span class="faint">${esc(p.hashtags.slice(0, 4).join(" "))}</span></div></div>
        </div>
        <button class="btn sm mt-16" data-lk-all="${plat}">${icon("copy", 13)} Copy everything for ${PLATFORMS[plat]?.name || plat}</button>
      </div>`).join("")}
    <div class="card fade-in">
      <h3>${icon("calendar", 15)} First-7-days schedule</h3>
      <table class="table"><thead><tr><th>Day</th><th>Platform</th><th>Content idea</th></tr></thead><tbody>
        ${r.schedule.map(s => `<tr><td style="white-space:nowrap"><b>${s.day}</b></td>
          <td>${platIcon(s.platform, 11)} ${PLATFORMS[s.platform]?.name || s.platform}</td>
          <td style="font-size:12.5px">${esc(s.idea)}</td></tr>`).join("")}
      </tbody></table>
    </div>
    <div class="card fade-in">
      <h3>${icon("check", 15)} Launch checklist</h3>
      ${r.checklist.map((c, i) => `
        <label style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer">
          <input type="checkbox" data-lk-check style="margin-top:2px"> <span>${i + 1}. ${esc(c)}</span>
        </label>`).join("")}
      <div class="progress mt-16"><div class="bar" id="lk-bar" style="width:2%;background:var(--grad)"></div></div>
    </div>`;
  out.querySelectorAll("[data-lk-copy]").forEach(ch => ch.onclick = () => copyText(ch.dataset.lkCopy, "Handle"));
  out.querySelectorAll("[data-lk-all]").forEach(btn => btn.onclick = () => {
    const p = r.profiles[btn.dataset.lkAll];
    copyText(`Handle: ${p.handles[0]}\n\nBio: ${p.bios[0]}\n\nFirst post:\n${p.first_post}\n\n${p.hashtags.join(" ")}`, "Profile kit");
  });
  const checks = out.querySelectorAll("[data-lk-check]");
  checks.forEach(cb => cb.onchange = () => {
    const done = [...checks].filter(c => c.checked).length;
    document.getElementById("lk-bar").style.width = Math.max(2, (done / checks.length) * 100) + "%";
    if (done === checks.length) toast("Launch complete — you're live everywhere 🎉");
  });
}

/* ============================================================ PUBLISH ASSISTANT */
function openPublishAssistant(p) {
  const plats = p.platforms || [];
  const m = openModal({
    title: "Publish — you're in control",
    wide: true,
    body: `
      <p class="muted" style="font-size:12.5px;margin-bottom:12px">Lumina doesn't post to platforms directly. Copy your content, publish it on each platform below, then mark it done.</p>
      <div class="field"><label>Final content (editable)</label>
        <textarea class="input" id="pa-content" rows="6">${esc(p.content)}</textarea></div>
      <div class="grid cols-${Math.min(plats.length || 1, 3)}" style="gap:10px">
        ${(plats.length ? plats : ["instagram"]).map(pl => `
          <div class="card" style="margin:0;padding:13px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">${platIcon(pl, 13)} <b style="font-size:13px">${PLATFORMS[pl]?.name || pl}</b></div>
            <ol class="faint" style="font-size:12px;line-height:1.7;padding-left:17px;margin:0">
              <li>Copy the content</li>
              <li>Open ${PLATFORMS[pl]?.name || pl} → new post</li>
              <li>Paste, adjust, publish</li>
            </ol>
          </div>`).join("")}
      </div>`,
    foot: `<button class="btn" data-close>Cancel</button>
      <button class="btn" id="pa-copy">${icon("copy", 14)} Copy content</button>
      <button class="btn primary" id="pa-done">${icon("check", 14)} I posted it — mark published</button>`,
  });
  m.el.querySelector("#pa-copy").onclick = () => copyText(m.el.querySelector("#pa-content").value, "Post content");
  m.el.querySelector("#pa-done").onclick = async () => {
    const btn = m.el.querySelector("#pa-done");
    buttonLoading(btn, true, "Saving…");
    try {
      await api(`/api/posts/${p.id}`, { method: "PATCH", body: { status: "published", content: m.el.querySelector("#pa-content").value } });
      m.close();
      toast("Marked published 🎉 Nice work getting it out there.");
      if (typeof loadPosts === "function") loadPosts();
    } catch (e) { toast(e.message, { type: "error" }); buttonLoading(btn, false); }
  };
}
