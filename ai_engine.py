"""Lumina AI Engine — multi-provider router.

Lets the user plug in ANY AI backend:
  - builtin : the built-in simulated engine (no key, works offline)
  - ollama  : free local models (Ollama running on their machine)
  - openai  : OpenAI (gpt-4o, gpt-4o-mini, ...)
  - anthropic: Anthropic Claude
  - gemini  : Google Gemini
  - groq    : Groq (fast open models)
  - custom  : any OpenAI-compatible endpoint (LM Studio, vLLM, OpenRouter, ...)

Config is stored per-user in users.prefs["aiEngine"]. When a real provider
is configured AND reachable, generation uses it; otherwise it transparently
falls back to the built-in simulated engine so nothing ever breaks.
"""
import json
import time
import httpx

DEFAULT_OLLAMA = "http://localhost:11434"

# Curated model lists shown in the UI (user can also type any model id).
MODELS = {
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"],
    "anthropic": ["claude-3-7-sonnet-latest", "claude-3-5-haiku-latest", "claude-sonnet-4-20250514"],
    "gemini": ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    "groq": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    "ollama": ["llama3.2", "llama3.1", "mistral", "qwen2.5", "phi3"],
    "custom": [],
    "builtin": [],
}

TIMEOUT = 60.0


class AIEngineError(Exception):
    """Raised when a configured provider fails; caller falls back to builtin."""


def _cfg(user_prefs):
    try:
        cfg = (user_prefs or {}).get("aiEngine") or {}
    except Exception:
        cfg = {}
    return {
        "provider": cfg.get("provider") or "builtin",
        "apiKey": cfg.get("apiKey") or "",
        "baseUrl": (cfg.get("baseUrl") or "").strip(),
        "model": cfg.get("model") or "",
        "temperature": float(cfg.get("temperature", 0.7)),
        "maxTokens": int(cfg.get("maxTokens", 900)),
    }


def provider_active(user_prefs):
    """Return the provider name if a real (non-builtin) provider is configured."""
    c = _cfg(user_prefs)
    return c["provider"] if c["provider"] != "builtin" else None


async def generate_text(user_prefs, prompt, system=None, max_tokens=None):
    """Route a text-generation request to the configured provider.

    Returns the model's text. Raises AIEngineError if the provider fails so
    the caller can fall back to the built-in simulated engine.
    """
    c = _cfg(user_prefs)
    prov = c["provider"]
    if prov == "builtin":
        raise AIEngineError("builtin")
    max_tokens = max_tokens or c["maxTokens"]
    temp = c["temperature"]
    try:
        if prov in ("openai", "groq", "custom"):
            return await _openai_compatible(c, prompt, system, max_tokens, temp)
        if prov == "anthropic":
            return await _anthropic(c, prompt, system, max_tokens, temp)
        if prov == "gemini":
            return await _gemini(c, prompt, system, max_tokens, temp)
        if prov == "ollama":
            return await _ollama(c, prompt, system, max_tokens, temp)
    except AIEngineError:
        raise
    except httpx.HTTPStatusError as e:
        raise AIEngineError(f"{prov} error {e.response.status_code}: {e.response.text[:200]}")
    except Exception as e:
        raise AIEngineError(f"{prov} failed: {e}")
    raise AIEngineError("unknown provider")


async def _openai_compatible(c, prompt, system, max_tokens, temp):
    base = c["baseUrl"].rstrip("/") if c["baseUrl"] else {
        "openai": "https://api.openai.com/v1",
        "groq": "https://api.groq.com/openai/v1",
    }.get(c["provider"], "")
    if not base:
        raise AIEngineError("no base URL")
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    headers = {"Authorization": f"Bearer {c['apiKey']}", "Content-Type": "application/json"}
    payload = {"model": c["model"] or "gpt-4o-mini", "messages": messages,
               "temperature": temp, "max_tokens": max_tokens}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(f"{base}/chat/completions", headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
    return data["choices"][0]["message"]["content"].strip()


async def _anthropic(c, prompt, system, max_tokens, temp):
    headers = {"x-api-key": c["apiKey"], "anthropic-version": "2023-06-01",
               "Content-Type": "application/json"}
    payload = {"model": c["model"] or "claude-3-5-haiku-latest", "max_tokens": max_tokens,
               "temperature": temp, "messages": [{"role": "user", "content": prompt}]}
    if system:
        payload["system"] = system
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
    return "".join(b.get("text", "") for b in data.get("content", [])).strip()


async def _gemini(c, prompt, system, max_tokens, temp):
    model = c["model"] or "gemini-2.0-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={c['apiKey']}"
    payload = {"contents": [{"parts": [{"text": prompt}]}],
               "generationConfig": {"temperature": temp, "maxOutputTokens": max_tokens}}
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


async def _ollama(c, prompt, system, max_tokens, temp):
    base = (c["baseUrl"] or DEFAULT_OLLAMA).rstrip("/")
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    payload = {"model": c["model"] or "llama3.2", "messages": messages, "stream": False,
               "options": {"temperature": temp, "num_predict": max_tokens}}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(f"{base}/api/chat", json=payload)
        r.raise_for_status()
        data = r.json()
    return data["message"]["content"].strip()


async def test_connection(user_prefs):
    """Send a tiny probe to verify credentials + model. Returns a status dict."""
    c = _cfg(user_prefs)
    prov = c["provider"]
    if prov == "builtin":
        return {"ok": True, "message": "Built-in simulated engine is always available."}
    try:
        out = await generate_text(user_prefs, "Reply with the single word: ready",
                                  system=None, max_tokens=12)
        return {"ok": True, "message": f"Connected to {prov} ({c['model'] or 'default'}). It replied: “{out[:60]}”"}
    except AIEngineError as e:
        return {"ok": False, "message": str(e)}
    except Exception as e:
        return {"ok": False, "message": f"Unexpected: {e}"}


# ---- Local Ollama auto-detection (v3.2: zero-config local AI) ----

_ollama_cache = {"ts": 0.0, "ok": False, "models": []}

async def probe_ollama(base=DEFAULT_OLLAMA):
    """Check if a local Ollama is running and which models it has. Cached 60s."""
    now = time.time()
    if now - _ollama_cache["ts"] < 60:
        return _ollama_cache
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(base.rstrip("/") + "/api/tags")
            r.raise_for_status()
            models = [m.get("name", "") for m in r.json().get("models", []) if m.get("name")]
        _ollama_cache.update(ts=now, ok=True, models=models)
    except Exception:
        _ollama_cache.update(ts=now, ok=False, models=[])
    return _ollama_cache

PREFERRED_MODELS = ("llama3.2", "llama3.1", "llama3", "qwen2.5", "qwen", "mistral", "gemma", "phi")

def pick_model(models):
    for needle in PREFERRED_MODELS:
        for m in models:
            if needle in m.lower():
                return m
    return models[0] if models else None

async def pull_model(model="llama3.2", base=DEFAULT_OLLAMA):
    """Ask local Ollama to download a model (long-running; run as a background task)."""
    async with httpx.AsyncClient(timeout=1800.0) as client:
        r = await client.post(base.rstrip("/") + "/api/pull", json={"model": model, "stream": False})
        r.raise_for_status()
    _ollama_cache["ts"] = 0.0  # force re-probe
