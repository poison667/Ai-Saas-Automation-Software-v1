/* ============ Lumina v3.0 — Real AI Engine, AI Studio, Image Studio ============ */

const AI_PROVIDERS = [
  { id: "builtin", name: "Built-in Engine", desc: "Offline demo engine. No key needed — great for exploring.", needsKey: false, free: true },
  { id: "ollama", name: "Ollama (Local)", desc: "100% free, private AI running on your own computer.", needsKey: false, free: true, url: true },
  { id: "openai", name: "OpenAI", desc: "GPT-4o & friends. Strongest general writer.", needsKey: true },
  { id: "anthropic", name: "Anthropic Claude", desc: "Excellent long-form and nuanced writing.", needsKey: true },
  { id: "gemini", name: "Google Gemini", desc: "Fast, generous free tier via AI Studio keys.", needsKey: true },
  { id: "groq", name: "Groq", desc: "Blazing-fast open models, generous free tier.", needsKey: true },
  { id: "custom", name: "Custom Endpoint", desc: "Any OpenAI-compatible API: LM Studio, vLLM, OpenRouter…", needsKey: true, url: true },
];

const AI_STATE = { chat: [], cfg: null, engine: null, models: {} };

async function aiFetchState() {
  const [engine, cfg, models] = await Promise.all([
    api("/api/ai/engine"), api("/api/ai/config"), api("/api/ai/models"),
  ]);
  AI_STATE.engine = engine; AI_STATE.cfg = cfg; AI_STATE.models = models;
  return { engine, cfg, models };
}

function engineBadge(engine) {
  if (!engine) return "";
  if (engine.connected)
    return `<span class="pill ok">● Real AI: ${esc(engine.provider)}${engine.model ? " · " + esc(engine.model) : ""}</span>`;
  if (engine.autoLocal && engine.autoLocal.found && engine.autoLocal.hasModel)
    return `<span class="pill ok">● Local AI auto-connected: Ollama · ${esc(engine.autoLocal.model)}</span>`;
  if (engine.autoLocal && engine.autoLocal.found)
    return `<span class="pill" style="background:rgba(251,191,36,.12);color:var(--yellow);border-color:rgba(251,191,36,.35)">● Ollama found — no model yet</span>`;
  return `<span class="pill">● Built-in demo engine</span>`;
}

/* ================= AI STUDIO ================= */

ROUTES.aistudio = {
  title: "AI Studio",
  subtitle: "Deep AI strategist — ask anything, unlimited.",
  async render(page) {
    const { engine } = await aiFetchState();
    page.innerHTML = `
      <div class="stack">
        <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <h3>${icon("sparkles", 16)} Your AI brain</h3>
            <div class="card-sub">With a connected provider every answer is written live by your AI. On the built-in engine, short strategy answers cost 2 credits.</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${engineBadge(engine)}
            <button class="btn ghost" id="as-engine">${icon("sliders", 14)} AI Engine</button>
          </div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
          <div id="as-log" style="height:420px;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;background:var(--bg-soft)"></div>
          <div style="border-top:1px solid var(--border);padding:12px;display:flex;gap:8px;background:var(--panel)">
            <textarea id="as-input" rows="2" placeholder="Ask your AI strategist anything… (Enter to send)" style="flex:1;resize:none"></textarea>
            <button class="btn primary" id="as-send" style="align-self:flex-end">${icon("send", 15)} Send</button>
          </div>
        </div>
        <div class="card">
          <h3>Quick questions</h3>
          <div class="chips" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
            ${[
              "Build me a 30-day content plan for my niche",
              "Rewrite this hook to make it scroll-stopping:",
              "What should I charge for a 3-post package?",
              "Diagnose why my reach dropped this month",
              "Give me 10 video ideas that get saves",
              "How do I turn followers into paying clients?",
            ].map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}
          </div>
        </div>
      </div>`;
    const log = page.querySelector("#as-log");
    const input = page.querySelector("#as-input");
    page.querySelector("#as-engine").onclick = () => { location.hash = "#/aiengine"; };
    page.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { input.value = b.dataset.q; input.focus(); });

    function bubble(role, text, meta) {
      const mine = role === "user";
      const div = document.createElement("div");
      div.style.cssText = `max-width:82%;align-self:${mine ? "flex-end" : "flex-start"};background:${mine ? "var(--grad)" : "var(--panel-2)"};color:${mine ? "#fff" : "var(--text)"};padding:12px 14px;border-radius:14px;${mine ? "border-bottom-right-radius:4px" : "border-bottom-left-radius:4px;border:1px solid var(--border)"};white-space:pre-wrap;font-size:13.5px;line-height:1.6`;
      div.textContent = text;
      log.appendChild(div);
      if (meta) {
        const m = document.createElement("div");
        m.style.cssText = `align-self:${mine ? "flex-end" : "flex-start"};font-size:11px;color:var(--faint)`;
        m.textContent = meta;
        log.appendChild(m);
      }
      log.scrollTop = log.scrollHeight;
      return div;
    }
    if (!AI_STATE.chat.length) {
      bubble("ai", engine.connected
        ? `Connected to ${engine.provider}${engine.model ? " (" + engine.model + ")" : ""}. I'm live and ready — ask me anything about content, growth, pricing or clients.`
        : (engine.autoLocal && engine.autoLocal.found && engine.autoLocal.hasModel)
          ? `I found Ollama running on your computer and connected to it automatically (${engine.autoLocal.model}). No setup needed — ask me anything, answers are free and unlimited.`
          : (engine.autoLocal && engine.autoLocal.found)
            ? "I found Ollama on your computer but it has no model yet — open AI Engine and click “Download model” (one click). Meanwhile I'll give you quick built-in answers."
            : "I'm running on Lumina's built-in engine. Install Ollama (free, ollama.com) and I'll auto-connect to it — or add any AI key in AI Engine for deep, unlimited answers.");
    } else {
      AI_STATE.chat.forEach(m => bubble(m.role, m.text, m.meta));
    }

    async function send() {
      const message = input.value.trim();
      if (!message) return;
      input.value = "";
      bubble("user", message);
      AI_STATE.chat.push({ role: "user", text: message });
      const thinking = bubble("ai", "…");
      try {
        const res = await api("/api/ai/ask", { method: "POST", body: {
          message,
          history: AI_STATE.chat.slice(-7).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
        }});
        thinking.textContent = res.text;
        const meta = res.engine === "builtin" ? `built-in engine · ${res.credits_used} credits · ${res.credits_left} left` : `${res.engine} · unlimited (your key)`;
        AI_STATE.chat.push({ role: "ai", text: res.text, meta });
        const m = document.createElement("div");
        m.style.cssText = "align-self:flex-start;font-size:11px;color:var(--faint)";
        m.textContent = meta;
        log.appendChild(m);
        updateCreditsPill();
      } catch (e) {
        thinking.textContent = "⚠ " + (e.message || "Something went wrong");
      }
      log.scrollTop = log.scrollHeight;
    }
    page.querySelector("#as-send").onclick = send;
    input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  },
};

/* ================= AI ENGINE ================= */

ROUTES.aiengine = {
  title: "AI Engine",
  subtitle: "Connect any AI, edit every prompt, train your brand voice — full control.",
  async render(page) {
    const { engine, cfg, models } = await aiFetchState();
    page.innerHTML = `
      <div class="stack">
        <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <h3>${icon("cpu", 16)} Engine control room</h3>
            <div class="card-sub">Everything the AI does — generator, profiles, threads, pitches — runs through this engine. Changes apply instantly, no reinstall.</div>
          </div>
          ${engineBadge(engine)}
        </div>
        <div class="tabs" id="ae-tabs" style="display:flex;gap:6px">
          <button class="btn ae-tab" data-tab="conn">${icon("link", 14)} Connection</button>
          <button class="btn ae-tab" data-tab="prompts">${icon("edit", 14)} Prompt Studio</button>
          <button class="btn ae-tab" data-tab="voice">${icon("award", 14)} Brand Voice Trainer</button>
        </div>
        <div id="ae-body"></div>
      </div>`;
    const body = page.querySelector("#ae-body");
    const tabs = page.querySelectorAll(".ae-tab");
    let current = cfg.customPrompts && Object.keys(cfg.customPrompts).length ? "conn" : "conn";

    function paintTabs() {
      tabs.forEach(t => t.classList.toggle("primary", t.dataset.tab === current));
    }

    /* ---- Tab: Connection ---- */
    function renderConn() {
      const p = cfg.provider || "builtin";
      const al = AI_STATE.engine && AI_STATE.engine.autoLocal;
      const autoBanner = (p === "builtin" && al && al.found) ? `
          <div class="card" style="border-color:rgba(52,211,153,.45)">
            <h3>${icon("cpu", 16)} Local AI detected on this computer</h3>
            ${al.hasModel ? `
              <div class="card-sub" style="margin-top:6px;line-height:1.8">
                <b>Ollama is running with ${esc(al.model)}</b> — Lumina is already using it automatically for every AI feature.<br>
                Nothing to configure, nothing to pay. If you want a specific or cloud provider instead, pick it below.
              </div>` : `
              <div class="card-sub" style="margin-top:6px;line-height:1.8">
                Ollama is running but has no model yet. One click downloads the recommended free model (~2 GB, one time):
              </div>
              <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap">
                <button class="btn primary" id="ae-pull">${icon("check", 14)} Download model (llama3.2)</button>
                ${al.models && al.models.length ? `<select id="ae-pull-model" class="input" style="width:200px">${["llama3.2", "llama3.1:8b", "qwen2.5:7b", "mistral"].map(m => `<option value="${m}">${m}</option>`).join("")}</select>` : ""}
                <span id="ae-pull-out" style="font-size:12.5px;color:var(--muted)"></span>
              </div>`}
          </div>` : "";
      body.innerHTML = `
        <div class="stack">
          ${autoBanner}
          <div class="card">
            <h3>Choose your AI provider</h3>
            <div class="card-sub">Local options are completely free and never leave your computer.</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-top:12px">
              ${AI_PROVIDERS.map(pr => `
                <button class="prov-card ${p === pr.id ? "sel" : ""}" data-prov="${pr.id}" style="text-align:left;padding:14px;border-radius:12px;border:1px solid ${p === pr.id ? "var(--accent)" : "var(--border)"};background:${p === pr.id ? "rgba(139,92,246,.10)" : "var(--panel-2)"};cursor:pointer">
                  <div style="font-weight:600;font-size:13.5px;display:flex;justify-content:space-between">${esc(pr.name)}${pr.free ? `<span class="pill ok" style="font-size:10px">FREE</span>` : ""}</div>
                  <div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5">${esc(pr.desc)}</div>
                </button>`).join("")}
            </div>
          </div>
          <div class="card">
            <h3>Provider settings</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:12px">
              <label class="field"><span>API key</span>
                <input type="password" id="ae-key" value="${esc(cfg.apiKey || "")}" placeholder="${cfg.provider === "builtin" ? "not needed" : "paste your key"}" ${cfg.provider === "builtin" ? "disabled" : ""}>
              </label>
              <label class="field" id="ae-url-wrap" style="display:${AI_PROVIDERS.find(x => x.id === p).url ? "" : "none"}"><span>Base URL</span>
                <input id="ae-url" value="${esc(cfg.baseUrl || "")}" placeholder="${p === "ollama" ? "http://localhost:11434" : "https://your-api.example.com/v1"}">
              </label>
              <label class="field"><span>Model</span>
                <input id="ae-model" list="ae-models" value="${esc(cfg.model || "")}" placeholder="e.g. gpt-4o-mini">
                <datalist id="ae-models">${(models[p] || []).map(m => `<option value="${esc(m)}">`).join("")}</datalist>
              </label>
              <label class="field"><span>Creativity (temperature): <b id="ae-temp-v">${cfg.temperature}</b></span>
                <input type="range" id="ae-temp" min="0" max="1.5" step="0.1" value="${cfg.temperature}">
              </label>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
              <button class="btn" id="ae-test">${icon("search", 14)} Test connection</button>
              <button class="btn primary" id="ae-save">${icon("check", 14)} Save engine</button>
              <span id="ae-test-out" style="align-self:center;font-size:12.5px;color:var(--muted)"></span>
            </div>
          </div>
          <div class="card">
            <h3>How it works</h3>
            <div class="card-sub" style="line-height:1.7">
              • Connect a provider once — every AI feature in Lumina (generator, profiles, threads, carousels, pitches, negotiation, AI Studio) instantly uses it.<br>
              • With your own key, generations are <b>unlimited and free from Lumina</b> — you only pay your provider (local models cost nothing).<br>
              • If your provider is ever unreachable, Lumina safely falls back to the built-in engine.<br>
              • Your key stays on your machine in your local workspace database.
            </div>
          </div>
        </div>`;
      body.querySelectorAll(".prov-card").forEach(c => c.onclick = () => {
        cfg.provider = c.dataset.prov;
        renderConn();
      });
      const prov = AI_PROVIDERS.find(x => x.id === cfg.provider);
      body.querySelector("#ae-temp").oninput = e => body.querySelector("#ae-temp-v").textContent = e.target.value;
      function collect() {
        return {
          provider: cfg.provider,
          apiKey: body.querySelector("#ae-key").value.trim(),
          baseUrl: body.querySelector("#ae-url").value.trim(),
          model: body.querySelector("#ae-model").value.trim(),
          temperature: parseFloat(body.querySelector("#ae-temp").value),
          maxTokens: cfg.maxTokens || 900,
          customPrompts: cfg.customPrompts || {},
        };
      }
      body.querySelector("#ae-test").onclick = async () => {
        const out = body.querySelector("#ae-test-out");
        out.textContent = "Testing…";
        try {
          const res = await api("/api/ai/test", { method: "POST", body: cfg.provider === "builtin" ? {} : collect() });
          out.innerHTML = res.ok ? `<span style="color:var(--green)">✔ ${esc(res.message)}</span>` : `<span style="color:var(--red)">✘ ${esc(res.message)}</span>`;
        } catch (e) { out.textContent = "✘ " + (e.message || "Test failed"); }
      };
      body.querySelector("#ae-save").onclick = async () => {
        try {
          await api("/api/ai/config", { method: "POST", body: collect() });
          toast("AI engine saved — every feature now uses it");
          const fresh = await apiFetchState();
          cfg = fresh.cfg;
          renderConn();
          paintBadge(fresh.engine);
        } catch (e) { toast(e.message || "Could not save", { type: "error" }); }
      };
      const pull = body.querySelector("#ae-pull");
      if (pull) pull.onclick = async () => {
        const modelSel = body.querySelector("#ae-pull-model");
        const model = modelSel ? modelSel.value : "llama3.2";
        const out = body.querySelector("#ae-pull-out");
        out.textContent = "Starting download…";
        try {
          const res = await api("/api/ai/local/setup", { method: "POST", body: { model } });
          out.textContent = res.message;
          toast("Model download started — the page will detect it automatically");
        } catch (e) { out.textContent = e.message || "Download failed"; }
      };
    }

    function paintBadge(eng) {
      const holder = page.querySelector(".card .pill");
      if (holder && eng) holder.outerHTML = engineBadge(eng);
    }

    /* ---- Tab: Prompt Studio ---- */
    const PROMPT_LABELS = {
      generator: "AI Generator", profile: "Profile Studio", thread: "Thread Writer", carousel: "Carousel Designer",
      pitch: "Brand Pitch Agent", negotiate: "Negotiation Coach", ask: "AI Studio Assistant", image: "Image Prompt Engineer",
    };
    function renderPrompts() {
      const customs = cfg.customPrompts || {};
      body.innerHTML = `
        <div class="card">
          <h3>Prompt Studio — edit what your AI thinks</h3>
          <div class="card-sub">Each box is the hidden instruction behind a feature. Change any of them and that feature behaves differently instantly. Empty = Lumina's expert default.</div>
          <div class="stack" style="margin-top:14px" id="ae-prompts">
            ${Object.keys(cfg.defaults).map(k => `
              <details class="prompt-box" ${customs[k] ? "open" : ""} style="border:1px solid var(--border);border-radius:12px;background:var(--panel-2);padding:12px 14px">
                <summary style="cursor:pointer;font-weight:600;font-size:13.5px;display:flex;align-items:center;gap:8px">
                  ${icon("edit", 14)} ${PROMPT_LABELS[k] || k}
                  ${customs[k] ? `<span class="pill ok" style="font-size:10px">CUSTOMIZED</span>` : `<span class="pill" style="font-size:10px">default</span>`}
                </summary>
                <textarea data-k="${k}" rows="4" placeholder="Lumina default (shown below)" style="width:100%;margin-top:10px;font-family:ui-monospace,monospace;font-size:12px">${esc(customs[k] || "")}</textarea>
                <div style="font-size:11px;color:var(--faint);margin-top:6px;white-space:pre-wrap"><b>Default:</b> ${esc(cfg.defaults[k])}</div>
                <button class="btn ghost reset-p" data-k="${k}" style="margin-top:8px;font-size:12px">${icon("refresh", 13)} Reset to default</button>
              </details>`).join("")}
          </div>
          <div style="display:flex;gap:10px;margin-top:16px">
            <button class="btn primary" id="ae-save-prompts">${icon("check", 14)} Save all prompts</button>
            <span style="align-self:center;font-size:12px;color:var(--faint)">Applies to the connected provider only.</span>
          </div>
        </div>`;
      body.querySelectorAll(".reset-p").forEach(b => b.onclick = () => {
        body.querySelector(`textarea[data-k="${b.dataset.k}"]`).value = "";
        toast("Will reset on save");
      });
      body.querySelector("#ae-save-prompts").onclick = async () => {
        const customPrompts = {};
        body.querySelectorAll("textarea[data-k]").forEach(t => { if (t.value.trim()) customPrompts[t.dataset.k] = t.value.trim(); });
        try {
          await api("/api/ai/config", { method: "POST", body: { ...(cfg), customPrompts } });
          const fresh = await aiFetchState();
          cfg = fresh.cfg;
          toast("Prompts saved — your AI obeys them now");
          renderPrompts();
        } catch (e) { toast(e.message || "Could not save", { type: "error" }); }
      };
    }

    /* ---- Tab: Voice Trainer ---- */
    function renderVoice() {
      const bv = (state.user.prefs && state.user.prefs.brandVoice) || {};
      body.innerHTML = `
        <div class="card">
          <h3>Train your custom AI on YOUR voice</h3>
          <div class="card-sub">Paste 3–10 samples of things you've already written (posts, captions, emails). Lumina learns your tone and rewrites every AI output to sound like you — automatically, inside every feature.</div>
          <textarea id="ae-samples" rows="8" placeholder="Paste your past posts here — separate samples with a blank line…" style="width:100%;margin-top:12px">${esc(bv._draft || "")}</textarea>
          <div style="display:flex;gap:10px;margin-top:12px;align-items:center;flex-wrap:wrap">
            <button class="btn primary" id="ae-train">${icon("sparkles", 14)} Train my AI</button>
            ${bv.style ? `<button class="btn ghost" id="ae-forget">${icon("trash", 14)} Forget training</button>` : ""}
            <span id="ae-train-out" style="font-size:12.5px;color:var(--muted)"></span>
          </div>
        </div>
        ${bv.style ? `
        <div class="card">
          <h3>${icon("award", 15)} Learned voice profile <span class="pill ok">active on all AI output</span></h3>
          <div style="margin-top:10px;font-size:13px;line-height:1.7;background:var(--panel-2);border:1px solid var(--border);border-radius:12px;padding:14px;white-space:pre-wrap">${esc(bv.style)}</div>
          <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;font-size:12px;color:var(--muted)">
            <span>📚 Trained on <b>${bv.samples || "?"}</b> samples</span>
            ${bv.avg_sentence_len ? `<span>✍️ Avg sentence <b>${bv.avg_sentence_len}</b> words</span>` : ""}
            ${bv.top_words ? `<span>🔑 Signature words: <b>${bv.top_words.slice(0, 5).map(esc).join(", ")}</b></span>` : ""}
            ${bv.trained_at ? `<span>🕒 ${esc(bv.trained_at.slice(0, 10))}</span>` : ""}
          </div>
        </div>` : ""}`;
      body.querySelector("#ae-train").onclick = async () => {
        const out = body.querySelector("#ae-train-out");
        const samples = body.querySelector("#ae-samples").value.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
        if (!samples.length) { toast("Paste some writing samples first", { type: "error" }); return; }
        out.textContent = "Training…";
        try {
          const res = await api("/api/ai/voice/train", { method: "POST", body: { samples } });
          await api("/api/me", { method: "PATCH", body: { prefs: {} } }).catch(() => {});
          const me = await api("/api/auth/me");
          state.user = me;
          toast(`Voice trained on ${res.samples} samples${res.engine !== "builtin" ? " by " + res.engine : ""}`);
          renderVoice();
        } catch (e) { out.textContent = ""; toast(e.message || "Training failed", { type: "error" }); }
      };
      const forget = body.querySelector("#ae-forget");
      if (forget) forget.onclick = async () => {
        await api("/api/me", { method: "PATCH", body: { prefs: { brandVoice: {} } } });
        const me = await api("/api/auth/me");
        state.user = me;
        toast("Voice training cleared");
        renderVoice();
      };
    }

    tabs.forEach(t => t.onclick = () => {
      current = t.dataset.tab;
      paintTabs();
      if (current === "conn") renderConn();
      else if (current === "prompts") renderPrompts();
      else renderVoice();
    });
    paintTabs();
    renderConn();
  },
};

/* ================= IMAGE STUDIO ================= */

const IMG_PRESETS = [
  { id: "sq", label: "Square", w: 1080, h: 1080, hint: "Instagram / TikTok post" },
  { id: "p45", label: "Portrait 4:5", w: 1080, h: 1350, hint: "Instagram feed" },
  { id: "story", label: "Story / Reel", w: 1080, h: 1920, hint: "Stories, Reels, Shorts" },
  { id: "wide", label: "Landscape", w: 1920, h: 1080, hint: "YouTube / X header" },
  { id: "x", label: "X Post", w: 1600, h: 900, hint: "X / link preview" },
  { id: "4k", label: "4K Ultra", w: 3840, h: 2160, hint: "Max quality" },
  { id: "avatar", label: "Profile picture", w: 400, h: 400, hint: "Avatars anywhere" },
  { id: "custom", label: "Custom…", w: 0, h: 0, hint: "Any resolution you want" },
];

ROUTES.imagestudio = {
  title: "Image Studio",
  subtitle: "Pick any picture, export it at any resolution — plus AI image generation.",
  async render(page) {
    const { engine } = await aiFetchState();
    page.innerHTML = `
      <div class="stack">
        <div class="card" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <div>
            <h3>${icon("image", 16)} Two tools, one studio</h3>
            <div class="card-sub">Resize any photo to any resolution instantly (works offline) — or generate brand-new images with your connected AI.</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn primary is-tab" data-t="resize">${icon("image", 14)} Resize any photo</button>
            <button class="btn is-tab" data-t="gen">${icon("sparkles", 14)} AI image generation</button>
          </div>
        </div>
        <div id="is-body"></div>
      </div>`;
    const body = page.querySelector("#is-body");
    let tab = "resize", srcImg = null;
    const sel = { preset: "sq", w: 1080, h: 1080, fit: "cover", fmt: "png", quality: 0.92, bg: "#0a0c12" };

    function paintTabs() {
      page.querySelectorAll(".is-tab").forEach(b => {
        const on = b.dataset.t === tab;
        b.classList.toggle("primary", on);
      });
    }

    function renderResize() {
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,1.2fr);gap:14px">
          <div class="card stack">
            <div>
              <h3>1 · Choose a picture</h3>
              <label class="dropzone" for="is-file" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:150px;border:2px dashed var(--border-strong);border-radius:14px;margin-top:10px;cursor:pointer;padding:20px;text-align:center;color:var(--muted);font-size:13px">
                ${icon("image", 26)}
                <span><b>Click to pick any image</b><br>JPG, PNG, WebP — any size</span>
              </label>
              <input type="file" id="is-file" accept="image/*" style="display:none">
            </div>
            <div>
              <h3>2 · Pick the resolution</h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
                ${IMG_PRESETS.map(p => `
                  <button class="rp ${sel.preset === p.id ? "sel" : ""}" data-id="${p.id}" style="text-align:left;padding:10px 12px;border-radius:10px;border:1px solid ${sel.preset === p.id ? "var(--accent)" : "var(--border)"};background:${sel.preset === p.id ? "rgba(139,92,246,.10)" : "var(--panel-2)"};cursor:pointer">
                    <div style="font-weight:600;font-size:12.5px">${p.label}</div>
                    <div style="font-size:11px;color:var(--muted)">${p.w ? p.w + "×" + p.h : "you decide"} · ${p.hint}</div>
                  </button>`).join("")}
              </div>
              <div id="is-custom" style="display:${sel.preset === "custom" ? "flex" : "none"};gap:8px;margin-top:10px;align-items:center">
                <input type="number" id="is-w" value="${sel.w || 1080}" min="16" max="8000" style="width:100px" placeholder="width"> ×
                <input type="number" id="is-h" value="${sel.h || 1080}" min="16" max="8000" style="width:100px" placeholder="height"> px
              </div>
            </div>
            <div>
              <h3>3 · Style & format</h3>
              <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                <select id="is-fit" class="input" style="flex:1">
                  <option value="cover" ${sel.fit === "cover" ? "selected" : ""}>Crop to fill (no borders)</option>
                  <option value="contain" ${sel.fit === "contain" ? "selected" : ""}>Fit inside (add background)</option>
                  <option value="stretch" ${sel.fit === "stretch" ? "selected" : ""}>Stretch to exact size</option>
                </select>
                <select id="is-fmt" class="input" style="flex:1">
                  <option value="png" ${sel.fmt === "png" ? "selected" : ""}>PNG (crisp)</option>
                  <option value="jpeg" ${sel.fmt === "jpeg" ? "selected" : ""}>JPG (small file)</option>
                  <option value="webp" ${sel.fmt === "webp" ? "selected" : ""}>WebP (modern)</option>
                </select>
              </div>
              <div id="is-q-wrap" style="display:${sel.fmt === "png" ? "none" : ""};margin-top:10px">
                <label style="font-size:12px;color:var(--muted)">Quality: <b id="is-qv">${Math.round(sel.quality * 100)}%</b></label>
                <input type="range" id="is-q" min="0.4" max="1" step="0.02" value="${sel.quality}" style="width:100%">
              </div>
            </div>
            <button class="btn primary" id="is-dl" style="width:100%">${icon("check", 15)} Export image</button>
          </div>
          <div class="card" style="display:flex;flex-direction:column">
            <h3>Preview</h3>
            <div id="is-prev" style="flex:1;display:flex;align-items:center;justify-content:center;min-height:340px;border-radius:12px;background:repeating-conic-gradient(var(--panel-2) 0% 25%, var(--panel-3) 0% 50%) 50%/22px 22px;margin-top:10px;overflow:hidden">
              <span style="color:var(--faint);font-size:13px">${srcImg ? "" : "Pick an image to preview it here"}</span>
            </div>
            <div id="is-info" style="font-size:12px;color:var(--muted);margin-top:8px"></div>
          </div>
        </div>`;
      const prev = body.querySelector("#is-prev");
      const info = body.querySelector("#is-info");

      function targetSize() {
        if (sel.preset === "custom") {
          const w = parseInt(body.querySelector("#is-w").value) || 1080;
          const h = parseInt(body.querySelector("#is-h").value) || 1080;
          return [Math.max(16, Math.min(8000, w)), Math.max(16, Math.min(8000, h))];
        }
        const p = IMG_PRESETS.find(x => x.id === sel.preset);
        return [p.w, p.h];
      }

      function draw() {
        if (!srcImg) return;
        const [w, h] = targetSize();
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (sel.fit !== "stretch") { ctx.fillStyle = sel.bg; ctx.fillRect(0, 0, w, h); }
        const sr = srcImg.width / srcImg.height, dr = w / h;
        let sx = 0, sy = 0, sw = srcImg.width, sh = srcImg.height;
        if (sel.fit === "cover") {
          if (sr > dr) { sw = srcImg.height * dr; sx = (srcImg.width - sw) / 2; }
          else { sh = srcImg.width / dr; sy = (srcImg.height - sh) / 2; }
          ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, w, h);
        } else if (sel.fit === "contain") {
          if (sr > dr) { sh = srcImg.width / dr; sy = (srcImg.height - sh) / 2; }
          else { sw = srcImg.height * dr; sx = (srcImg.width - sw) / 2; }
          ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, w, h);
        } else ctx.drawImage(srcImg, 0, 0, w, h);
        const scale = Math.min(1, 460 / w);
        prev.innerHTML = "";
        const imgEl = new Image();
        imgEl.src = canvas.toDataURL();
        imgEl.style.cssText = `max-width:${w * scale}px;max-height:340px;border-radius:8px`;
        prev.appendChild(imgEl);
        info.textContent = `${srcImg.width}×${srcImg.height} → ${w}×${h} px · ${sel.fit} · ${sel.fmt.toUpperCase()}`;
      }

      body.querySelector("#is-file").onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        const img = new Image();
        img.onload = () => { srcImg = img; draw(); };
        img.src = url;
      };
      body.querySelectorAll(".rp").forEach(b => b.onclick = () => { sel.preset = b.dataset.id; renderResize(); });
      const cw = body.querySelector("#is-w"), ch = body.querySelector("#is-h");
      if (cw) { cw.oninput = ch.oninput = draw; }
      body.querySelector("#is-fit").onchange = e => { sel.fit = e.target.value; draw(); };
      body.querySelector("#is-fmt").onchange = e => {
        sel.fmt = e.target.value;
        body.querySelector("#is-q-wrap").style.display = sel.fmt === "png" ? "none" : "";
        draw();
      };
      body.querySelector("#is-q").oninput = e => {
        sel.quality = parseFloat(e.target.value);
        body.querySelector("#is-qv").textContent = Math.round(sel.quality * 100) + "%";
        draw();
      };
      body.querySelector("#is-dl").onclick = () => {
        if (!srcImg) { toast("Pick an image first", { type: "error" }); return; }
        const [w, h] = targetSize();
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (sel.fit !== "stretch") { ctx.fillStyle = sel.bg; ctx.fillRect(0, 0, w, h); }
        const sr = srcImg.width / srcImg.height, dr = w / h;
        let sx = 0, sy = 0, sw = srcImg.width, sh = srcImg.height;
        if (sel.fit === "cover") {
          if (sr > dr) { sw = srcImg.height * dr; sx = (srcImg.width - sw) / 2; }
          else { sh = srcImg.width / dr; sy = (srcImg.height - sh) / 2; }
          ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, w, h);
        } else if (sel.fit === "contain") {
          if (sr > dr) { sh = srcImg.width / dr; sy = (srcImg.height - sh) / 2; }
          else { sw = srcImg.height * dr; sx = (srcImg.width - sw) / 2; }
          ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, w, h);
        } else ctx.drawImage(srcImg, 0, 0, w, h);
        canvas.toBlob(b => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = `lumina-${w}x${h}.${sel.fmt === "jpeg" ? "jpg" : sel.fmt}`;
          a.click();
          toast(`Exported ${w}×${h} ${sel.fmt.toUpperCase()}`);
        }, `image/${sel.fmt}`, sel.quality);
      };
      draw();
    }

    function renderGen() {
      body.innerHTML = `
        <div class="card">
          <h3>${icon("sparkles", 15)} Generate images with your AI</h3>
          ${engine.canImage ? `
            <div class="card-sub">Powered by your connected ${esc(engine.provider)} engine. Describe anything — Lumina refines the prompt for you.</div>
            <textarea id="is-prompt" rows="3" placeholder="A neon-lit creator desk setup with purple ambient light, cinematic, 4k…" style="width:100%;margin-top:12px"></textarea>
            <div style="display:flex;gap:10px;margin-top:12px;align-items:center;flex-wrap:wrap">
              <select id="is-size" class="input" style="width:170px">
                <option value="1024x1024">Square 1024</option>
                <option value="1024x1792">Tall 1024×1792</option>
                <option value="1792x1024">Wide 1792×1024</option>
              </select>
              <button class="btn primary" id="is-go">${icon("sparkles", 14)} Generate</button>
              <span id="is-status" style="font-size:12.5px;color:var(--muted)"></span>
            </div>
            <div id="is-out" style="margin-top:16px"></div>` : `
            <div class="card-sub" style="margin-top:8px;line-height:1.8">
              AI image generation needs an <b>OpenAI-compatible provider</b> (OpenAI or a custom endpoint) connected in the AI Engine.<br>
              <button class="btn" style="margin-top:10px" onclick="location.hash='#/aiengine'">${icon("cpu", 14)} Open AI Engine</button><br>
              <span style="color:var(--faint);font-size:12px">Meanwhile, the photo resizer above works with any picture, completely free.</span>
            </div>`}
        </div>`;
      if (!engine.canImage) return;
      body.querySelector("#is-go").onclick = async () => {
        const prompt = body.querySelector("#is-prompt").value.trim();
        const status = body.querySelector("#is-status");
        const out = body.querySelector("#is-out");
        if (!prompt) { toast("Describe the image first", { type: "error" }); return; }
        status.textContent = "Painting… (AI images can take 20–60s)";
        try {
          const res = await api("/api/ai/image", { method: "POST", body: { prompt, size: body.querySelector("#is-size").value } });
          status.textContent = "";
          out.innerHTML = `
            <img src="${res.image}" style="max-width:100%;border-radius:14px;border:1px solid var(--border)">
            <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;align-items:center">
              <a class="btn primary" href="${res.image}" download="lumina-ai-image.png">${icon("check", 14)} Download</a>
              <span style="font-size:12px;color:var(--faint)">${esc(res.prompt)}</span>
            </div>`;
          toast("Image generated");
        } catch (e) { status.textContent = ""; toast(e.message || "Generation failed", { type: "error" }); }
      };
    }

    page.querySelectorAll(".is-tab").forEach(b => b.onclick = () => { tab = b.dataset.t; paintTabs(); tab === "resize" ? renderResize() : renderGen(); });
    paintTabs();
    renderResize();
  },
};
