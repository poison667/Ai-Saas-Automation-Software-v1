"""
Lumina — AI Social Media Suite (full-stack demo SaaS)
FastAPI + SQLite backend. Serves the SPA from ./static and a JSON API under /api.
"""
import os
import re
import io
import csv
import json
import time
import sqlite3
import secrets
import hashlib
import hmac as hmac_mod
import random
import asyncio
import datetime as dt
from contextlib import closing
from typing import Optional

from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "app.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

COOKIE = "lumina_auth"
SESSION_DAYS = 30
CREDIT_COST = 10
REWRITE_COST = 2
PLAN_LIMITS = {"Starter": 60, "Pro": 500, "Scale": 2000}

PLATFORMS = {
    "instagram": {"name": "Instagram", "color": "#E1306C", "best": ["11:30", "18:00"]},
    "x":         {"name": "X / Twitter", "color": "#9aa4b8", "best": ["09:00", "17:30"]},
    "facebook":  {"name": "Facebook", "color": "#1877F2", "best": ["13:00", "19:00"]},
    "linkedin":  {"name": "LinkedIn", "color": "#0A66C2", "best": ["08:30", "12:00"]},
    "tiktok":    {"name": "TikTok", "color": "#69C9D0", "best": ["19:00", "21:30"]},
    "youtube":   {"name": "YouTube", "color": "#FF0000", "best": ["15:00", "18:00"]},
}

# ---------------------------------------------------------------- database

def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'Pro',
  avatar_color TEXT NOT NULL DEFAULT '#8b5cf6',
  workspace TEXT NOT NULL DEFAULT 'My Workspace',
  ai_credits_used INTEGER NOT NULL DEFAULT 0,
  prefs TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  followers INTEGER NOT NULL DEFAULT 0,
  engagement REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'connected',
  connected_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  platforms TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  published_at TEXT,
  campaign_id INTEGER,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  author TEXT NOT NULL DEFAULT '',
  review_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT 'Awareness',
  status TEXT NOT NULL DEFAULT 'draft',
  budget REAL NOT NULL DEFAULT 0,
  spent REAL NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  engagement REAL NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  tone TEXT NOT NULL,
  platforms TEXT NOT NULL DEFAULT '[]',
  content TEXT NOT NULL,
  hashtags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  type TEXT NOT NULL,
  author TEXT NOT NULL,
  author_handle TEXT NOT NULL,
  content TEXT NOT NULL,
  post_ref TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  unread INTEGER NOT NULL DEFAULT 1,
  sentiment TEXT NOT NULL DEFAULT 'positive',
  replies TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  status TEXT NOT NULL DEFAULT 'invited',
  avatar_color TEXT NOT NULL DEFAULT '#22d3ee',
  joined_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  tags TEXT NOT NULL DEFAULT '[]',
  data TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  number TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS post_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  platforms TEXT NOT NULL DEFAULT '[]',
  edited_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  webhook_token TEXT NOT NULL DEFAULT '',
  connected_at TEXT NOT NULL,
  last_sync TEXT
);
CREATE TABLE IF NOT EXISTS quick_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ab_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  content_a TEXT NOT NULL,
  content_b TEXT NOT NULL,
  metric_a REAL NOT NULL DEFAULT 0,
  metric_b REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  winner TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  integration_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  volume INTEGER NOT NULL DEFAULT 0,
  sentiment TEXT NOT NULL DEFAULT '{}',
  series TEXT NOT NULL DEFAULT '[]',
  mentions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  stats TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'instagram',
  followers INTEGER NOT NULL DEFAULT 0,
  growth REAL NOT NULL DEFAULT 0,
  engagement REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#f472b6',
  series TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
"""

def init_db():
    with closing(db()) as conn:
        conn.executescript(SCHEMA)
        # lightweight migrations for pre-existing databases
        cols = {r[1] for r in conn.execute("PRAGMA table_info(posts)")}
        if "review_note" not in cols:
            conn.execute("ALTER TABLE posts ADD COLUMN review_note TEXT NOT NULL DEFAULT ''")
        conn.commit()

def now_iso(offset_seconds=0):
    return (dt.datetime.now() + dt.timedelta(seconds=offset_seconds)).strftime("%Y-%m-%dT%H:%M:%S")

def day_iso(offset_days=0):
    return (dt.date.today() + dt.timedelta(days=offset_days)).strftime("%Y-%m-%d")

# ---------------------------------------------------------------- auth helpers

def hash_password(pw: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 180_000).hex()
    return f"{salt}${h}"

def verify_password(pw: str, stored: str) -> bool:
    try:
        salt, h = stored.split("$", 1)
    except ValueError:
        return False
    cand = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 180_000).hex()
    return hmac_mod.compare_digest(cand, h)

def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with closing(db()) as conn:
        conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
                     (token, user_id, time.time() + SESSION_DAYS * 86400))
        conn.commit()
    return token

def public_user(row) -> dict:
    u = dict(row)
    u.pop("password_hash", None)
    u["prefs"] = json.loads(u.get("prefs") or "{}")
    u["credits_limit"] = PLAN_LIMITS.get(u["plan"], 500)
    return u

async def require_user(request: Request):
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Not authenticated")
    with closing(db()) as conn:
        s = conn.execute("SELECT * FROM sessions WHERE token=?", (token,)).fetchone()
        if not s or s["expires_at"] < time.time():
            raise HTTPException(401, "Session expired")
        u = conn.execute("SELECT * FROM users WHERE id=?", (s["user_id"],)).fetchone()
    if not u:
        raise HTTPException(401, "Unknown user")
    return dict(u)

async def jitter(lo=0.15, hi=0.45):
    await asyncio.sleep(random.uniform(lo, hi))

def log_activity(user_id, type_, message):
    with closing(db()) as conn:
        conn.execute("INSERT INTO activity (user_id, type, message, created_at) VALUES (?,?,?,?)",
                     (user_id, type_, message, now_iso()))
        conn.commit()

# ---------------------------------------------------------------- AI engine (simulated)

HOOKS = {
    "professional": [
        "Big news: {topic} is here.",
        "We've been quietly building something around {topic} — and it's ready.",
        "{topic} just became a lot simpler for your team.",
        "A quick update on {topic} that's worth your attention.",
    ],
    "casual": [
        "okay so… {topic} 👀",
        "real talk: {topic} changed the game for us",
        "we need to talk about {topic}",
        "little update, big vibes: {topic} ✨",
    ],
    "witty": [
        "Plot twist: {topic} was the main character all along.",
        "Nobody: … Us: obsessing over {topic}.",
        "We put {topic} in the lab. The results? Unreasonably good.",
        "Breaking: local team discovers {topic}. Experts baffled by how well it works.",
    ],
    "inspiring": [
        "Every big win starts with a small decision. Ours was {topic}.",
        "Imagine what's possible when {topic} finally clicks.",
        "This is your sign to take {topic} seriously.",
        "We started with a hunch about {topic}. Today, it's proof that momentum compounds.",
    ],
    "bold": [
        "Hot take: {topic} is the biggest unlock of the year.",
        "Stop scrolling. {topic} matters more than you think.",
        "We're going all-in on {topic}. Here's why you should too.",
        "{topic}. That's the post. That's the whole strategy.",
    ],
}

BODY = {
    "professional": [
        "Over the past few weeks we tested this with early users and the results were clear: less busywork, faster turnaround, and measurably better engagement.",
        "It's designed to slot straight into your existing workflow — no migration, no learning curve, just immediate value.",
        "The numbers from our pilot speak for themselves: 38% time saved and a 2.1x lift in response rates.",
        "This is part of our broader push to make every hour you invest in content work harder.",
    ],
    "casual": [
        "we tested it for two weeks and honestly can't go back — it just saves so much time",
        "the best part? you don't need to change anything about how you work. it just… fits",
        "our whole team is using it daily now and the little wins add up fast",
        "also it's genuinely fun to use, which is rare for tooling lol",
    ],
    "witty": [
        "Science? Not quite. Vibes? Partially. Actual measurable results? Surprisingly yes.",
        "We ran the numbers twice because the first time we assumed a rounding error. It was not a rounding error.",
        "Your future self, already using this, sends their regards.",
        "Side effects may include: smugness, free time, and suspiciously good metrics.",
    ],
    "inspiring": [
        "Progress isn't loud. It's the quiet compounding of small, smart choices — and this is one of them.",
        "When you remove friction, creativity gets its hours back. That's what this unlocks.",
        "The teams that win aren't bigger. They're just a little braver about trying what's next.",
        "Momentum loves clarity. This brings both.",
    ],
    "bold": [
        "The teams that adopt this now will set the pace for the next 12 months. The rest will be catching up.",
        "We benchmarked it against everything on the market. Nothing came close on speed or quality.",
        "This isn't an experiment anymore — it's the new baseline.",
        "Early results: 3x faster output, double the engagement, zero regrets.",
    ],
}

CTAS = {
    "professional": [
        "Read the full breakdown on our blog — link in bio.",
        "Try it free for 14 days. No card required.",
        "Book a 15-minute walkthrough with our team this week.",
        "Save this post for your next planning session.",
    ],
    "casual": [
        "try it and tell me what you think 👇",
        "link in bio if you wanna peek 👀",
        "drop a 🔥 if you'd use this",
        "save this for later, thank me after",
    ],
    "witty": [
        "You know where the link is. It's in the bio. It's always been in the bio.",
        "Try it — worst case, you get your time back. Best case, you're insufferable about it.",
        "Comment 'IN' and we'll slide you the details. Yes, that's still a thing.",
        "Save this post. Future you is already grateful.",
    ],
    "inspiring": [
        "Take the first step today — future you will thank you.",
        "Start small. Start now. The compound effect does the rest.",
        "Share this with someone who needs the nudge today. 🤍",
        "Your next chapter starts with one click. Link in bio.",
    ],
    "bold": [
        "Join the launch before the window closes — link in bio.",
        "DM us 'READY' and we'll set you up today.",
        "Be early. Be loud. Link in bio.",
        "The waitlist closes Friday. Move fast.",
    ],
}

GENERIC_TAGS = ["#SocialMediaTips", "#ContentStrategy", "#CreatorEconomy", "#MarketingTips",
                "#BuildInPublic", "#GrowthHacking", "#DigitalMarketing", "#CommunityFirst"]

def _camel(words):
    return "".join(w[:1].upper() + w[1:] for w in words if w.isalnum() or w.replace("'", "").isalnum())

def ai_generate(topic: str, tone: str, platforms: list, length: str):
    rng = random.Random()
    tone = tone if tone in HOOKS else "casual"
    topic = (topic or "your next big idea").strip()
    t_low = topic.lower().strip(" .!?")

    hook = rng.choice(HOOKS[tone]).format(topic=t_low)
    body_pool = list(BODY[tone])
    rng.shuffle(body_pool)
    n_body = {"short": 1, "medium": 2, "long": 3}.get(length, 2)
    body = body_pool[:n_body]

    parts = [hook] + body
    if length == "long":
        parts.append("\nWhat you get:\n→ More reach without posting more\n→ Hours back every week\n→ Metrics your boss actually likes")
    parts.append(rng.choice(CTAS[tone]))

    if "linkedin" in platforms:
        content = "\n\n".join(parts)
    else:
        content = "\n\n".join(parts[:2] + [" ".join(parts[2:])]) if len(parts) > 2 else "\n\n".join(parts)

    words = re.findall(r"[A-Za-z0-9]+", topic)
    tags = []
    whole = _camel(words)
    if whole and len(whole) <= 28:
        tags.append(f"#{whole}")
    for w in words[:3]:
        if len(w) > 3:
            t = f"#{w.capitalize()}"
            if t not in tags:
                tags.append(t)
    extra = rng.sample(GENERIC_TAGS, k=3)
    tags += [t for t in extra if t not in tags]
    tags = tags[: 3 if "x" in platforms else 6]

    best_platform = next((p for p in ["instagram", "tiktok", "linkedin", "x", "youtube", "facebook"] if p in platforms), "instagram")
    best_time = rng.choice(PLATFORMS[best_platform]["best"])
    confidence = rng.randint(87, 98)
    return content, tags, best_time, confidence

# ---------------------------------------------------------------- seed data

DEFAULT_TEMPLATES = [
    ("Product Launch Teaser", "Conversion",
     "Build anticipation without revealing everything.",
     "Write a teaser post announcing {topic}. Build curiosity with 2 hints about the value, reveal nothing about the mechanics, and end with a waitlist CTA."),
    ("Tips Listicle", "Education",
     "A save-worthy carousel of practical tips.",
     "Write a caption for a 5-tip carousel about {topic}. Start with a hook that calls out the reader, keep tips concrete, end with 'save this post'."),
    ("Customer Success Story", "Social Proof",
     "Let results do the talking.",
     "Tell a short customer story about {topic}: hook with the result number, 2 sentences of context, one customer quote, soft CTA."),
    ("Behind the Scenes", "Authenticity",
     "Show the humans behind the brand.",
     "Write a behind-the-scenes post about {topic}. Warm, candid tone. Include one imperfect detail — it builds trust."),
    ("Engagement Question", "Community",
     "Spark a real conversation in comments.",
     "Write a post that opens with a spicy-but-safe hot take about {topic}, then asks the audience a specific question. Reply-bait done tastefully."),
    ("Milestone Celebration", "Gratitude",
     "Celebrate a number, thank the community.",
     "Celebrate a milestone related to {topic}. Thank the community specifically, share one lesson from the journey, invite people to be part of the next chapter."),
]

def seed_templates_for(conn, user_id):
    for name, cat, desc, prompt in DEFAULT_TEMPLATES:
        conn.execute("INSERT INTO templates (user_id, name, category, description, prompt) VALUES (?,?,?,?,?)",
                     (user_id, name, cat, desc, prompt))

def seed_analytics_for(conn, user_id, days=90, base=28000, growth=260):
    rng = random.Random(42)
    for i in range(days, -1, -1):
        d = day_iso(-i)
        progress = (days - i) / days
        dow = dt.date.fromisoformat(d).weekday()
        weekend = 0.72 if dow >= 5 else 1.0
        followers = int(base + growth * (days - i) + rng.uniform(-40, 40))
        reach = int((followers * rng.uniform(0.28, 0.42)) * weekend * (1 + 0.25 * progress))
        impressions = int(reach * rng.uniform(1.5, 1.9))
        engagement = round(rng.uniform(2.6, 6.2) * (1.05 if dow in (1, 3) else 1.0), 2)
        clicks = int(reach * rng.uniform(0.015, 0.045))
        conn.execute("INSERT INTO analytics (user_id, date, followers, reach, impressions, engagement, clicks) VALUES (?,?,?,?,?,?,?)",
                     (user_id, d, followers, reach, impressions, engagement, clicks))

def seed_starter_for(conn, user_id):
    """Lightweight workspace for freshly registered users (shows empty states)."""
    seed_templates_for(conn, user_id)
    conn.execute("INSERT INTO activity (user_id, type, message, created_at) VALUES (?,?,?,?)",
                 (user_id, "welcome", "Welcome to Lumina! Connect your first account to get started.", now_iso()))

MENTION_AUTHORS = ["@growth.daily", "@mkflows", "@designmatter", "@threadsmith", "@audience.lab", "@content.ops",
                   "@brandcraft", "@loopline", "@signal.boost", "@makernotes"]
MENTION_TEMPLATES = [
    ("Just tried {k} — genuinely impressed by how polished it feels. Small teams shipping fast 🙌", "positive"),
    ("The amount of value packed into {k} is absurd for the price. Instant recommend.", "positive"),
    ("Anyone else having issues with {k} today? It's been flaky for me since the morning.", "negative"),
    ("We benchmarked {k} against three alternatives this week. Results in thread 🧵", "neutral"),
    ("Unpopular opinion: {k} is overhyped. Happy to be proven wrong.", "negative"),
    ("Our team switched to {k} last month and onboarding time dropped by half.", "positive"),
    ("Writing a deep-dive newsletter about {k} this week — what should I cover?", "neutral"),
    ("{k} support replied in 11 minutes on a Sunday. That's how you win customers.", "positive"),
    ("PSA: check your settings if you use {k} — the default export changed quietly.", "neutral"),
    ("Hot take: {k} will be the default in this space within a year.", "positive"),
]

def build_keyword_data(keyword, rng):
    series = []
    base = rng.randint(18, 160)
    trend = rng.uniform(-0.03, 0.06)
    for i in range(14):
        v = max(3, int(base * (1 + trend) ** i + rng.uniform(-12, 12)))
        series.append(v)
    volume = sum(series[-7:])
    pos = rng.randint(34, 68)
    neg = rng.randint(6, min(30, 92 - pos))
    sentiment = {"positive": pos, "neutral": 100 - pos - neg, "negative": neg}
    templates = rng.sample(MENTION_TEMPLATES, k=min(6, len(MENTION_TEMPLATES)))
    mentions = []
    for text, senti in templates:
        mentions.append({
            "author": rng.choice(MENTION_AUTHORS),
            "platform": rng.choice(["x", "instagram", "linkedin", "tiktok", "facebook"]),
            "text": text.format(k=keyword),
            "sentiment": senti,
            "at": now_iso(-rng.randint(1, 90) * 3600),
        })
    mentions.sort(key=lambda m: m["at"], reverse=True)
    return {"volume": volume, "sentiment": sentiment, "series": series, "mentions": mentions}

def compute_report_stats(conn, uid, start, end):
    rows = conn.execute("SELECT * FROM analytics WHERE user_id=? AND date>=? AND date<=? ORDER BY date",
                        (uid, start, end)).fetchall()
    prev_start = (dt.date.fromisoformat(start) - dt.timedelta(days=7)).isoformat()
    prev = conn.execute("SELECT * FROM analytics WHERE user_id=? AND date>=? AND date<? ORDER BY date",
                        (uid, prev_start, start)).fetchall()
    reach = sum(r["reach"] for r in rows)
    clicks = sum(r["clicks"] for r in rows)
    impressions = sum(r["impressions"] for r in rows)
    eng = round(sum(r["engagement"] for r in rows) / len(rows), 2) if rows else 0
    followers_delta = (rows[-1]["followers"] - rows[0]["followers"]) if rows else 0
    prev_reach = sum(r["reach"] for r in prev)
    reach_delta = round((reach - prev_reach) / prev_reach * 100, 1) if prev_reach else 0
    published = conn.execute("""SELECT COUNT(*) c FROM posts WHERE user_id=? AND status='published'
                                AND published_at IS NOT NULL AND substr(published_at,1,10)>=? AND substr(published_at,1,10)<=?""",
                             (uid, start, end)).fetchone()["c"]
    return {"reach": reach, "reach_delta": reach_delta, "impressions": impressions, "clicks": clicks,
            "engagement": eng, "followers_delta": followers_delta, "published": published}

def seed_demo(conn):
    email = "demo@lumina.social"
    if conn.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        return
    cur = conn.execute(
        "INSERT INTO users (name, email, password_hash, plan, avatar_color, workspace, ai_credits_used, prefs, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ("Ava Martinez", email, hash_password("demo1234"), "Pro", "#8b5cf6", "Nova Studio",
         137, json.dumps({"weekly_report": True, "post_approvals": True, "product_news": False}),
         day_iso(-160)))
    uid = cur.lastrowid
    seed_templates_for(conn, uid)

    accounts = [
        ("instagram", "@nova.studio", "Nova Studio", 48230, 5.8, "connected", day_iso(-160)),
        ("x", "@novastudiohq", "Nova Studio HQ", 12840, 2.1, "connected", day_iso(-150)),
        ("linkedin", "nova-studio", "Nova Studio", 8420, 3.4, "connected", day_iso(-120)),
        ("tiktok", "@novastudio", "Nova Studio", 91600, 7.9, "connected", day_iso(-90)),
        ("youtube", "Nova Studio", "Nova Studio", 15300, 4.2, "connected", day_iso(-75)),
        ("facebook", "novastudiohq", "Nova Studio", 6900, 1.2, "disconnected", day_iso(-140)),
    ]
    for a in accounts:
        conn.execute("INSERT INTO accounts (user_id, platform, handle, display_name, followers, engagement, status, connected_at) VALUES (?,?,?,?,?,?,?,?)",
                     (uid, *a))

    campaigns = [
        ("Orbit 2.0 Launch", "Conversions", "active", 4800, 3120, day_iso(-19), day_iso(10), "#8b5cf6", day_iso(-25)),
        ("Creator Partnerships — Q3", "Awareness", "completed", 6000, 5890, day_iso(-81), day_iso(-20), "#22d3ee", day_iso(-90)),
        ("Back to School Promo", "Conversions", "paused", 2400, 860, day_iso(-36), day_iso(10), "#fbbf24", day_iso(-40)),
        ("Holiday Gift Guide", "Engagement", "draft", 5000, 0, day_iso(72), day_iso(125), "#f472b6", day_iso(-6)),
    ]
    camp_ids = []
    for c in campaigns:
        cur = conn.execute("INSERT INTO campaigns (user_id, name, goal, status, budget, spent, start_date, end_date, color, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                           (uid, *c))
        camp_ids.append(cur.lastrowid)

    posts = [
        # (content, platforms, status, scheduled/published offset days, hour, campaign_idx, likes, comments, shares, reach, author)
        ("Design faster, not harder 🎨 Orbit 2.0's new Smart Layout engine auto-aligns every element as you work — no more pixel-nudging at 1am.\n\nFree for all Pro creators this week.",
         ["instagram", "linkedin"], "published", -6, 9, 0, 842, 96, 128, 18400, "Ava Martinez"),
        ("5 hooks that stopped our scroll this week 👀\n\n1. Numbers before nouns\n2. A confession\n3. \"Nobody is talking about this\"\n4. The contrarian take\n5. A before/after\n\nSave this for your next campaign 📌",
         ["instagram", "x"], "published", -5, 12, None, 1204, 210, 342, 26100, "Ava Martinez"),
        ("How @bloomcoffee grew waitlist signups 3.2x with a single launch thread ☕\n\n\"We treated the launch like a story, not an ad. Three chapters, one payoff.\"\n\nFull breakdown on the blog.",
         ["linkedin", "x"], "published", -4, 8, 0, 486, 57, 91, 11900, "Ava Martinez"),
        ("Hot take: carousels are outperforming reels for saves in 2026.\n\nAgree or disagree? 👇 Drop your data below — compiling results for Friday's post.",
         ["instagram"], "published", -3, 18, None, 630, 384, 47, 9800, "Ava Martinez"),
        ("POV: it's launch week at Nova HQ 🚀\n\nWall of sticky notes, cold brew on tap, and a very good dog named Pixel supervising QA.",
         ["instagram", "tiktok"], "published", -2, 15, 0, 1533, 188, 205, 31200, "Marcus Bell"),
        ("100K creators. We're speechless 🥹\n\nTo everyone who shipped their first design with us — this milestone is yours. Next stop: making Orbit the co-pilot every creator deserves.",
         ["instagram", "x", "linkedin"], "published", -1, 10, None, 2210, 312, 418, 44800, "Ava Martinez"),
        ("Steal our 15-minute repurposing workflow ♻️\n\n1 long-form video → 12 assets:\n• 3 short clips\n• 1 carousel\n• 5 quote posts\n• 2 emails\n• 1 blog intro\n\nBatch it on Monday. Coast all week.",
         ["linkedin", "youtube"], "published", 0, 8, None, 391, 44, 122, 8700, "Ivy Zhang"),
        ("The October content calendar template is almost here 🍂\n\nJoin the waitlist — the first 500 get it free, plus our hook library.",
         ["instagram", "facebook"], "scheduled", 4, 11, 2, 0, 0, 0, 0, "Ava Martinez"),
        ("Meet the new Analytics tab: attribution that actually makes sense 📊\n\nLive demo Thursday, 10am ET. Bring questions — we brought answers (and a giveaway).",
         ["linkedin", "x"], "scheduled", 6, 9, 0, 0, 0, 0, 0, "Marcus Bell"),
        ("Creator spotlight: how @lena.draws turns 30-second sketches into a full brand ✏️\n\nHer stack: Orbit, one brush, zero fear. Thread 🧵",
         ["x", "tiktok"], "scheduled", 9, 17, None, 0, 0, 0, 0, "Ivy Zhang"),
        ("Your weekly reminder: batch your content, protect your focus 🧘\n\nTuesday tips thread drops at 9 — what should we cover next?",
         ["x"], "scheduled", 2, 9, None, 0, 0, 0, 0, "Ava Martinez"),
        ("Sneak peek 👀 Something big is coming to mobile next month. Can you guess what it is? Wrong answers only.",
         ["instagram", "tiktok"], "draft", None, None, 0, 0, 0, 0, 0, "Ava Martinez"),
        ("We asked 500 creators what their biggest bottleneck is. The answer surprised us 🧵\n\n(pull stats from the survey dashboard before publishing)",
         ["x", "linkedin"], "draft", None, None, None, 0, 0, 0, 0, "Marcus Bell"),
        ("Black Friday early access for Pro members — needs final numbers from finance before scheduling.",
         ["instagram", "facebook"], "draft", None, None, 3, 0, 0, 0, 0, "Ava Martinez"),
        # awaiting approval from teammates
        ("Thread draft: “How we onboarded 100K creators without breaking support” 🧵\n\nWaiting on the final numbers from Sofia before this goes out.",
         ["x", "linkedin"], "pending", None, None, None, 0, 0, 0, 0, "Marcus Bell"),
        ("Creator partnership announcement with @lena.draws ✏️ Legal signed off — ready for the green light. Aiming for next Tuesday.",
         ["instagram", "tiktok"], "pending", 8, 10, 0, 0, 0, 0, 0, "Ivy Zhang"),
        ("Giveaway time! 🎁 We're giving 5 Orbit Pro licenses to creators who remix our launch post. Full rules in the image.",
         ["instagram"], "pending", None, None, 0, 0, 0, 0, 0, "Sofia Reyes"),
    ]
    for p in posts:
        content, plats, status, off, hour, ci, likes, comments, shares, reach, author = p
        scheduled_at = published_at = None
        if status == "published" and off is not None:
            published_at = f"{day_iso(off)}T{hour:02d}:00:00"
        if status == "scheduled" or (status == "pending" and off is not None):
            scheduled_at = f"{day_iso(off)}T{hour:02d}:00:00"
        created = now_iso(-random.randint(1, 4) * 86400 if status == "pending" else -random.randint(2, 10) * 86400)
        conn.execute("""INSERT INTO posts (user_id, content, platforms, status, scheduled_at, published_at,
                        campaign_id, likes, comments, shares, reach, author, created_at, updated_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                     (uid, content, json.dumps(plats), status, scheduled_at, published_at,
                      camp_ids[ci] if ci is not None else None,
                      likes, comments, shares, reach, author, created, created))

    seed_analytics_for(conn, uid, days=180)

    gens = [
        ("Holiday campaign hooks", "bold", ["instagram", "tiktok"],
         "Stop scrolling. Your holiday content plan matters more than you think.\n\nWe benchmarked 200 seasonal campaigns — the early ones win 3x the reach.\n\nDM us 'READY' and we'll set you up today.",
         ["#HolidayCampaign", "#Holiday", "#Campaign", "#SocialMediaTips", "#ContentStrategy", "#MarketingTips"]),
        ("Orbit 2.0 launch teaser", "witty", ["x", "linkedin"],
         "Plot twist: the redesign was the main character all along.\n\nWe ran the numbers twice because the first time we assumed a rounding error. It was not a rounding error.",
         ["#Orbit2", "#Launch", "#BuildInPublic"]),
        ("Community gratitude post", "inspiring", ["instagram"],
         "Every big win starts with a small decision. Ours was showing up for this community daily.\n\nProgress isn't loud — it's the quiet compounding of small, smart choices.\n\nShare this with someone who needs the nudge today. 🤍",
         ["#CommunityFirst", "#Gratitude", "#CreatorEconomy", "#MarketingTips", "#GrowthHacking"]),
    ]
    for i, g in enumerate(gens):
        conn.execute("INSERT INTO generations (user_id, topic, tone, platforms, content, hashtags, created_at) VALUES (?,?,?,?,?,?,?)",
                     (uid, g[0], g[1], json.dumps(g[2]), g[3], json.dumps(g[4]), now_iso(-(i + 1) * 9 * 3600)))

    acts = [
        ("milestone", "“100K creators” post reached 44.8K people — your best performer this month", -3600 * 3),
        ("post", "Post “October content calendar” scheduled for " + day_iso(4), -3600 * 5),
        ("ai", "AI draft generated for “Holiday campaign hooks”", -3600 * 26),
        ("account", "TikTok account @novastudio reconnected", -3600 * 49),
        ("campaign", "Campaign “Orbit 2.0 Launch” reached 65% of budget", -3600 * 55),
        ("report", "Your weekly performance report is ready", -3600 * 76),
        ("milestone", "New follower milestone: 48K on Instagram 🎉", -3600 * 100),
        ("post", "3 posts published across 4 platforms", -3600 * 122),
    ]
    for t, m, off in acts:
        conn.execute("INSERT INTO activity (user_id, type, message, created_at) VALUES (?,?,?,?)",
                     (uid, t, m, now_iso(off)))

    # ---- inbox conversations ----
    convos = [
        ("instagram", "comment", "Maya Chen", "@mayachen.design",
         "The Smart Layout engine is unreal — cut my design time in half. When does the API open up? 🙌",
         "Design faster, not harder 🎨 Orbit 2.0's new Smart Layout engine…", "new", 1, "positive",
         "[]", -3600 * 2),
        ("tiktok", "comment", "Jordan Reyes", "@jordancreates",
         "ok but the sticky-note wall in your launch video?? need a tour immediately 😂",
         "POV: it's launch week at Nova HQ 🚀", "new", 1, "neutral", "[]", -3600 * 5),
        ("x", "mention", "Priya Natarajan", "@priyabuilds",
         "Been testing @novastudiohq Orbit 2.0 all week. The auto-align alone is worth the upgrade. Full review thread coming Friday 🧵",
         None, "new", 1, "positive", "[]", -3600 * 9),
        ("instagram", "dm", "Leo Fontaine", "@leo.fontaine",
         "Hey Nova team! I run a 120k design page — would love to partner on a tutorial series for Orbit 2.0. Open to collabs?",
         None, "new", 1, "positive", "[]", -3600 * 22),
        ("linkedin", "comment", "Dana Whitfield", "dana-whitfield",
         "Curious how Smart Layout handles brand-system constraints. Does it respect locked tokens, or does it override them?",
         "Design faster, not harder 🎨 Orbit 2.0's new Smart Layout engine…", "replied", 0, "neutral",
         json.dumps([{"author": "Nova Studio", "text": "Great question, Dana — it respects locked tokens by default and only suggests within your system. Full docs dropping this week.", "at": now_iso(-3600 * 20)}]),
         -3600 * 26),
        ("facebook", "comment", "Sam Okafor", "sam.okafor.9",
         "The pricing changed on my renewal without any heads-up. Not cool. Considering switching honestly.",
         None, "new", 1, "negative", "[]", -3600 * 30),
        ("instagram", "comment", "Aria Bloom", "@aria.bloom",
         "100K well earned!! 🥹🎉 been here since the beta — so proud of what you've built.",
         "100K creators. We're speechless 🥹", "resolved", 0, "positive",
         json.dumps([{"author": "Nova Studio", "text": "Aria, you were one of our first 200 beta users. This one's for you 🤍", "at": now_iso(-3600 * 40)}]),
         -3600 * 44),
        ("x", "mention", "Dev Weekly", "@devweekly",
         "ICYMI: @novastudiohq just crossed 100K creators. Their repurposing workflow is the playbook every content team should steal.",
         None, "resolved", 0, "positive", "[]", -3600 * 50),
        ("tiktok", "dm", "Nia Park", "@niapark.studio",
         "your 15-min repurposing workflow saved my agency SO much time 🥲 do you offer team plans?",
         None, "replied", 0, "positive",
         json.dumps([{"author": "Nova Studio", "text": "Nia this made our day! Yes — team plans are live, link is in our bio. 🙌", "at": now_iso(-3600 * 60)}]),
         -3600 * 70),
    ]
    for platform, ctype, author, handle, content, post_ref, status, unread, sentiment, replies, off in convos:
        conn.execute("""INSERT INTO conversations (user_id, platform, type, author, author_handle, content, post_ref,
                        status, unread, sentiment, replies, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                     (uid, platform, ctype, author, handle, content, post_ref, status, unread, sentiment, replies, now_iso(off)))

    # ---- team members ----
    team = [
        ("Sofia Reyes", "sofia@novastudio.co", "admin", "active", "#f472b6", day_iso(-210)),
        ("Marcus Bell", "marcus@novastudio.co", "editor", "active", "#22d3ee", day_iso(-140)),
        ("Ivy Zhang", "ivy@novastudio.co", "editor", "active", "#34d399", day_iso(-60)),
        ("Tomás Rivera", "tomas@novastudio.co", "viewer", "invited", "#fbbf24", day_iso(-2)),
    ]
    for n, e, r, s, c, j in team:
        conn.execute("INSERT INTO team_members (user_id, name, email, role, status, avatar_color, joined_at) VALUES (?,?,?,?,?,?,?)",
                     (uid, n, e, r, s, c, j))

    # ---- media library ----
    def svg_thumb(c1, c2, glyph):
        svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='400' height='280'>"
               f"<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
               f"<stop offset='0' stop-color='{c1}'/><stop offset='1' stop-color='{c2}'/></linearGradient></defs>"
               f"<rect width='400' height='280' fill='url(#g)'/>"
               f"<text x='200' y='155' font-size='72' text-anchor='middle'>{glyph}</text></svg>")
        return "data:image/svg+xml," + svg.replace("#", "%23")
    media = [
        ("orbit-launch-hero.png", "image", ["campaign", "orbit-2.0"], svg_thumb("#8b5cf6", "#d946ef", "🚀"), 482_000, -3600 * 48),
        ("carousel-tips-01.png", "image", ["carousel", "education"], svg_thumb("#0ea5e9", "#22d3ee", "💡"), 318_000, -3600 * 96),
        ("bts-launch-wall.png", "image", ["bts", "culture"], svg_thumb("#f59e0b", "#fbbf24", "📌"), 545_000, -3600 * 52),
        ("milestone-100k.png", "image", ["milestone"], svg_thumb("#34d399", "#6ee7b7", "🎉"), 271_000, -3600 * 30),
        ("analytics-tab-demo.mp4", "video", ["demo", "feature"], "", 14_800_000, -3600 * 20),
        ("logo-mark-dark.svg", "image", ["brand"], svg_thumb("#11141d", "#2a2f3f", "✦"), 12_400, -3600 * 300),
    ]
    for nm, kind, tags, data, size, off in media:
        conn.execute("INSERT INTO media (user_id, name, kind, tags, data, size, created_at) VALUES (?,?,?,?,?,?,?)",
                     (uid, nm, kind, json.dumps(tags), data, size, now_iso(off)))

    # ---- invoices ----
    invoices = [
        ("INV-2026-0914", "Pro plan — September", 49.00, "paid", day_iso(-6)),
        ("INV-2026-0814", "Pro plan — August", 49.00, "paid", day_iso(-37)),
        ("INV-2026-0714", "Pro plan — July", 49.00, "paid", day_iso(-68)),
        ("INV-2026-0620", "AI credits top-up (250)", 19.00, "paid", day_iso(-92)),
        ("INV-2026-0614", "Pro plan — June", 49.00, "paid", day_iso(-98)),
    ]
    for num, desc, amt, st, d in invoices:
        conn.execute("INSERT INTO invoices (user_id, number, description, amount, status, date) VALUES (?,?,?,?,?,?)",
                     (uid, num, desc, amt, st, d))

    # ---- competitors ----
    rng = random.Random(7)
    def comp_series(end_followers, growth_pct):
        start = end_followers / (1 + growth_pct / 100)
        pts = []
        for i in range(30):
            frac = i / 29
            base = start + (end_followers - start) * frac
            pts.append(int(base * rng.uniform(0.992, 1.008)))
        pts[-1] = end_followers
        return pts
    competitors = [
        ("PixelForge", "@pixelforge", "instagram", 64_200, 6.8, 4.9, "#f472b6"),
        ("Craftly", "@craftly.app", "instagram", 41_800, 11.2, 6.1, "#22d3ee"),
        ("Hue & Form", "@hueandform", "instagram", 88_500, -2.4, 3.2, "#fbbf24"),
    ]
    for nm, h, pf, f, g, e, color in competitors:
        conn.execute("""INSERT INTO competitors (user_id, name, handle, platform, followers, growth, engagement, color, series, created_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?)""",
                     (uid, nm, h, pf, f, g, e, color, json.dumps(comp_series(f, g)), day_iso(-30)))

    # ---- weekly reports (last 3 complete weeks) ----
    today = dt.date.today()
    last_sunday = today - dt.timedelta(days=(today.weekday() + 1) % 7)
    if last_sunday >= today:  # today is the week's final day; that week is still in progress
        last_sunday -= dt.timedelta(days=7)
    for k in range(1, 4):
        end = last_sunday - dt.timedelta(days=7 * (k - 1))
        start = end - dt.timedelta(days=6)
        stats = compute_report_stats(conn, uid, start.isoformat(), end.isoformat())
        title = f"Weekly report — {start.strftime('%b')} {start.day} to {end.strftime('%b')} {end.day}"
        conn.execute("INSERT INTO reports (user_id, title, period_start, period_end, stats, created_at) VALUES (?,?,?,?,?,?)",
                     (uid, title, start.isoformat(), end.isoformat(), json.dumps(stats),
                      now_iso(-(k - 1) * 86400 - 3600 * 6)))

    # ---- quick replies ----
    for title, body in (
        ("Thanks!", "Thanks so much for the kind words — it genuinely made our day! 💜"),
        ("Support handoff", "Great question! I'm looping in our support team — they'll get back to you within a few hours."),
        ("Collab open", "We love this idea! Drop us a DM with the details and let's make it happen."),
    ):
        conn.execute("INSERT INTO quick_replies (user_id, title, body, created_at) VALUES (?,?,?,?)",
                     (uid, title, body, day_iso(-12)))

    # ---- integrations ----
    for key in ("slack", "canva"):
        conn.execute("INSERT INTO integrations (user_id, key, enabled, webhook_token, connected_at, last_sync) VALUES (?,?,?,?,?,?)",
                     (uid, key, 1, secrets.token_hex(8), day_iso(-20), now_iso(-3600 * 5)))
    int_rows = conn.execute("SELECT * FROM integrations WHERE user_id=?", (uid,)).fetchall()
    slack_id = next(r["id"] for r in int_rows if r["key"] == "slack")
    canva_id = next(r["id"] for r in int_rows if r["key"] == "canva")
    pub_post = conn.execute("SELECT id, content FROM posts WHERE user_id=? AND status='published' ORDER BY id LIMIT 1", (uid,)).fetchone()
    sch_post = conn.execute("SELECT id, content FROM posts WHERE user_id=? AND status='scheduled' ORDER BY id LIMIT 1", (uid,)).fetchone()
    if pub_post and sch_post:
        conn.execute("INSERT INTO ab_tests (user_id, post_id, content_a, content_b, metric_a, metric_b, status, winner, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     (uid, pub_post["id"], pub_post["content"], "✨ " + pub_post["content"][:120].strip(),
                      4.6, 6.1, "completed", "B", day_iso(-6)))
        conn.execute("INSERT INTO ab_tests (user_id, post_id, content_a, content_b, status, created_at) VALUES (?,?,?,?,?,?)",
                     (uid, sch_post["id"], sch_post["content"],
                      sch_post["content"][:90].strip() + " — don't miss this. Full details in the thread 🧵", "running", day_iso(-1)))
    for ev, iid, ago in (("post.published", slack_id, -3600 * 30), ("test.ping", canva_id, -3600 * 26),
                         ("post.approved", slack_id, -3600 * 9), ("post.published", canva_id, -3600 * 3)):
        conn.execute("INSERT INTO webhook_events (user_id, integration_id, event, payload, created_at) VALUES (?,?,?,?,?)",
                     (uid, iid, ev, '{"demo":true}', now_iso(ago)))

    # ---- social listening keywords ----
    kw_rng = random.Random(99)
    for kw in ["Orbit 2.0", "smart layout", "nova studio"]:
        d = build_keyword_data(kw, kw_rng)
        conn.execute("""INSERT INTO keywords (user_id, keyword, volume, sentiment, series, mentions, status, created_at)
                        VALUES (?,?,?,?,?,?,?,?)""",
                     (uid, kw, d["volume"], json.dumps(d["sentiment"]), json.dumps(d["series"]),
                      json.dumps(d["mentions"]), "active", day_iso(-12)))

    conn.commit()

# ---------------------------------------------------------------- app

app = FastAPI(title="Lumina API")

@app.on_event("startup")
def startup():
    init_db()
    with closing(db()) as conn:
        seed_demo(conn)

def set_cookie(resp: Response, token: str):
    resp.set_cookie(COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax", path="/")

async def read_json(request: Request) -> dict:
    try:
        return await request.json()
    except Exception:
        return {}

def own(conn, table: str, id_: int, user_id: int):
    row = conn.execute(f"SELECT * FROM {table} WHERE id=? AND user_id=?", (id_, user_id)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    return row

def post_dict(row):
    d = dict(row)
    d["platforms"] = json.loads(d["platforms"] or "[]")
    return d

def maybe_autopublish(conn, user_id):
    """Flip overdue scheduled posts to published with light engagement numbers."""
    now = now_iso()
    due = conn.execute("SELECT id, content FROM posts WHERE user_id=? AND status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?",
                       (user_id, now)).fetchall()
    for p in due:
        likes = random.randint(40, 900)
        conn.execute("""UPDATE posts SET status='published', published_at=scheduled_at, likes=?,
                        comments=?, shares=?, reach=? WHERE id=?""",
                     (likes, likes // random.randint(5, 9), likes // random.randint(4, 7),
                      likes * random.randint(18, 30), p["id"]))
    if due:
        conn.commit()

# ---- auth

@app.get("/api/health")
def health():
    return {"ok": True, "time": now_iso()}

@app.post("/api/auth/register")
async def register(request: Request, response: Response):
    body = await read_json(request)
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    pw = body.get("password") or ""
    if len(name) < 2:
        raise HTTPException(400, "Please enter your name")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(400, "Please enter a valid email address")
    if len(pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    with closing(db()) as conn:
        if conn.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
            raise HTTPException(409, "An account with this email already exists")
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, plan, avatar_color, workspace, ai_credits_used, prefs, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (name, email, hash_password(pw), "Pro", random.choice(["#8b5cf6", "#22d3ee", "#f472b6", "#34d399", "#fbbf24"]),
             f"{name.split()[0]}'s Workspace", 0, json.dumps({"weekly_report": True, "post_approvals": True, "product_news": True}), now_iso()))
        uid = cur.lastrowid
        seed_starter_for(conn, uid)
        conn.commit()
    token = create_session(uid)
    resp = JSONResponse({"ok": True})
    set_cookie(resp, token)
    return resp

@app.post("/api/auth/login")
async def login(request: Request):
    body = await read_json(request)
    email = (body.get("email") or "").strip().lower()
    pw = body.get("password") or ""
    await jitter(0.3, 0.7)
    with closing(db()) as conn:
        u = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not u or not verify_password(pw, u["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_session(u["id"])
    resp = JSONResponse({"ok": True})
    set_cookie(resp, token)
    return resp

@app.post("/api/auth/logout")
async def logout(request: Request):
    token = request.cookies.get(COOKIE)
    if token:
        with closing(db()) as conn:
            conn.execute("DELETE FROM sessions WHERE token=?", (token,))
            conn.commit()
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE, path="/")
    return resp

@app.get("/api/auth/me")
async def me(user=Depends(require_user)):
    return public_user(user)

@app.patch("/api/me")
async def update_me(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        u = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        name = (body.get("name") or u["name"]).strip()
        email = (body.get("email") or u["email"]).strip().lower()
        workspace = body.get("workspace", u["workspace"])
        prefs = dict(json.loads(u["prefs"] or "{}"))
        if isinstance(body.get("prefs"), dict):
            prefs.update(body["prefs"])
        if email != u["email"] and conn.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
            raise HTTPException(409, "That email is already in use")
        conn.execute("UPDATE users SET name=?, email=?, workspace=?, prefs=? WHERE id=?",
                     (name, email, workspace, json.dumps(prefs), user["id"]))
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    return public_user(row)

# ---- dashboard

@app.get("/api/dashboard")
async def dashboard(user=Depends(require_user)):
    await jitter()
    uid = user["id"]
    with closing(db()) as conn:
        maybe_autopublish(conn, uid)
        accounts = [dict(r) for r in conn.execute("SELECT * FROM accounts WHERE user_id=?", (uid,))]
        total_followers = sum(a["followers"] for a in accounts if a["status"] == "connected")
        series = [dict(r) for r in conn.execute(
            "SELECT date, reach, followers, engagement, clicks, impressions FROM analytics WHERE user_id=? AND date>=? ORDER BY date",
            (uid, day_iso(-29)))]
        reach30 = sum(r["reach"] for r in series)
        eng = round(sum(r["engagement"] for r in series) / len(series), 2) if series else 0
        scheduled = conn.execute("SELECT COUNT(*) c FROM posts WHERE user_id=? AND status='scheduled'", (uid,)).fetchone()["c"]
        upcoming = [post_dict(r) for r in conn.execute(
            "SELECT * FROM posts WHERE user_id=? AND status='scheduled' AND scheduled_at IS NOT NULL ORDER BY scheduled_at LIMIT 5", (uid,))]
        top = [post_dict(r) for r in conn.execute(
            "SELECT * FROM posts WHERE user_id=? AND status='published' ORDER BY (likes + shares*2 + reach/40) DESC LIMIT 4", (uid,))]
        acts = [dict(r) for r in conn.execute(
            "SELECT type, message, created_at FROM activity WHERE user_id=? ORDER BY datetime(created_at) DESC LIMIT 8", (uid,))]
        active_campaigns = conn.execute("SELECT COUNT(*) c FROM campaigns WHERE user_id=? AND status='active'", (uid,)).fetchone()["c"]
        # month-to-date stats + goals
        month_start = dt.date.today().replace(day=1).strftime("%Y-%m-%d")
        m_rows = conn.execute("SELECT date, reach, engagement FROM analytics WHERE user_id=? AND date>=?", (uid, month_start)).fetchall()
        month_reach = sum(r["reach"] for r in m_rows)
        month_eng = round(sum(r["engagement"] for r in m_rows) / len(m_rows), 2) if m_rows else 0.0
        month_posts = conn.execute(
            "SELECT COUNT(*) c FROM posts WHERE user_id=? AND status='published' AND published_at IS NOT NULL AND substr(published_at,1,10)>=?",
            (uid, month_start)).fetchone()["c"]
        urow = conn.execute("SELECT prefs FROM users WHERE id=?", (uid,)).fetchone()
        try:
            goals = json.loads(urow["prefs"] or "{}").get("goals") or {}
        except (ValueError, TypeError):
            goals = {}
    platform_split = {}
    for a in accounts:
        if a["status"] == "connected":
            platform_split[a["platform"]] = platform_split.get(a["platform"], 0) + a["followers"]
    return {
        "stats": {
            "followers": total_followers,
            "reach30": reach30,
            "engagement": eng,
            "scheduled": scheduled,
            "active_campaigns": active_campaigns,
            "connected_accounts": len([a for a in accounts if a["status"] == "connected"]),
        },
        "series": series,
        "platform_split": platform_split,
        "upcoming": upcoming,
        "top_posts": top,
        "activity": acts,
        "month": {"reach": month_reach, "posts": month_posts, "engagement": month_eng},
        "goals": goals,
        "now": now_iso(),
    }

# ---- accounts

@app.get("/api/accounts")
async def list_accounts(user=Depends(require_user)):
    await jitter()
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM accounts WHERE user_id=? ORDER BY followers DESC", (user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/accounts")
async def create_account(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    platform = body.get("platform")
    handle = (body.get("handle") or "").strip()
    if platform not in PLATFORMS:
        raise HTTPException(400, "Pick a platform")
    if not handle:
        raise HTTPException(400, "Enter a handle or page name")
    await asyncio.sleep(1.1)  # simulated OAuth handshake
    rng = random.Random()
    with closing(db()) as conn:
        cur = conn.execute(
            "INSERT INTO accounts (user_id, platform, handle, display_name, followers, engagement, status, connected_at) VALUES (?,?,?,?,?,?,?,?)",
            (user["id"], platform, handle, body.get("display_name") or handle.lstrip("@"),
             rng.randint(300, 25000), round(rng.uniform(0.8, 6.5), 1), "connected", now_iso()))
        row = conn.execute("SELECT * FROM accounts WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    log_activity(user["id"], "account", f"{PLATFORMS[platform]['name']} account {handle} connected")
    return dict(row)

@app.patch("/api/accounts/{id}")
async def update_account(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        row = own(conn, "accounts", id, user["id"])
        d = dict(row)
        for k in ("handle", "display_name", "status"):
            if k in body:
                d[k] = body[k]
        if body.get("status") == "connected" and row["status"] != "connected":
            await asyncio.sleep(0.9)
        conn.execute("UPDATE accounts SET handle=?, display_name=?, status=? WHERE id=?",
                     (d["handle"], d["display_name"], d["status"], id))
        conn.commit()
        row = conn.execute("SELECT * FROM accounts WHERE id=?", (id,)).fetchone()
    return dict(row)

@app.delete("/api/accounts/{id}")
async def delete_account(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "accounts", id, user["id"])
        conn.execute("DELETE FROM accounts WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# ---- posts

@app.get("/api/posts/pending-count")
async def pending_count(user=Depends(require_user)):
    with closing(db()) as conn:
        c = conn.execute("SELECT COUNT(*) c FROM posts WHERE user_id=? AND status='pending'", (user["id"],)).fetchone()["c"]
    return {"count": c}

@app.get("/api/posts")
async def list_posts(user=Depends(require_user), status: Optional[str] = None, q: Optional[str] = None):
    await jitter()
    uid = user["id"]
    with closing(db()) as conn:
        maybe_autopublish(conn, uid)
        sql, args = "SELECT * FROM posts WHERE user_id=?", [uid]
        if status and status != "all":
            sql += " AND status=?"
            args.append(status)
        if q:
            sql += " AND content LIKE ?"
            args.append(f"%{q}%")
        sql += " ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, COALESCE(scheduled_at, published_at, created_at) DESC"
        rows = conn.execute(sql, args).fetchall()
    return [post_dict(r) for r in rows]

@app.post("/api/posts")
async def create_post(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    content = (body.get("content") or "").strip()
    plats = body.get("platforms") or []
    if not content:
        raise HTTPException(400, "Post content can't be empty")
    if not plats:
        raise HTTPException(400, "Pick at least one platform")
    status = body.get("status") or "draft"
    if status not in ("draft", "scheduled", "published", "pending"):
        raise HTTPException(400, "Invalid status")
    if status == "scheduled" and not body.get("scheduled_at"):
        raise HTTPException(400, "Pick a date and time to schedule")
    now = now_iso()
    with closing(db()) as conn:
        cur = conn.execute("""INSERT INTO posts (user_id, content, platforms, status, scheduled_at, published_at, campaign_id, author, created_at, updated_at)
                              VALUES (?,?,?,?,?,?,?,?,?,?)""",
                           (user["id"], content, json.dumps(plats), status,
                            body.get("scheduled_at"), now if status == "published" else None,
                            body.get("campaign_id"), user["name"], now, now))
        row = conn.execute("SELECT * FROM posts WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    verb = {"draft": "Draft saved", "scheduled": f"Post scheduled for {body.get('scheduled_at')}",
            "published": "Post published", "pending": "Post submitted for approval"}
    log_activity(user["id"], "post", verb[status])
    return post_dict(row)

@app.patch("/api/posts/{id}")
async def update_post(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        row = own(conn, "posts", id, user["id"])
        changed = (body.get("content") is not None and body.get("content") != row["content"]) or \
                  (body.get("platforms") is not None and json.dumps(body.get("platforms")) != row["platforms"])
        if changed:
            conn.execute("INSERT INTO post_versions (post_id, user_id, content, platforms, edited_by, created_at) VALUES (?,?,?,?,?,?)",
                         (id, user["id"], row["content"], row["platforms"], user["name"], now_iso()))
        d = dict(row)
        for k in ("content", "status", "scheduled_at", "campaign_id"):
            if k in body:
                d[k] = body[k]
        if isinstance(d.get("platforms"), list):
            pass
        if "platforms" in body:
            d["platforms"] = json.dumps(body["platforms"])
        if body.get("status") == "published" and row["status"] != "published":
            d["published_at"] = now_iso()
            d["likes"] = random.randint(5, 120)
            d["reach"] = random.randint(400, 3000)
        review_note = "" if body.get("status") == "pending" else row["review_note"]
        conn.execute("""UPDATE posts SET content=?, platforms=?, status=?, scheduled_at=?, published_at=?, campaign_id=?,
                        likes=?, comments=?, shares=?, reach=?, review_note=?, updated_at=? WHERE id=?""",
                     (d["content"], d["platforms"], d["status"], d["scheduled_at"], d.get("published_at"),
                      d["campaign_id"], d["likes"], d["comments"], d["shares"], d["reach"], review_note, now_iso(), id))
        if body.get("status") == "published" and row["status"] != "published":
            emit_webhooks(conn, user["id"], "post.published", {"post_id": id, "platforms": json.loads(d["platforms"] or "[]")})
        conn.commit()
        row = conn.execute("SELECT * FROM posts WHERE id=?", (id,)).fetchone()
    return post_dict(row)

@app.delete("/api/posts/{id}")
async def delete_post(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "posts", id, user["id"])
        conn.execute("DELETE FROM posts WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

@app.get("/api/posts/{id}/versions")
async def post_versions(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "posts", id, user["id"])
        rows = conn.execute("SELECT * FROM post_versions WHERE post_id=? AND user_id=? ORDER BY datetime(created_at) DESC",
                            (id, user["id"])).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["platforms"] = json.loads(d["platforms"] or "[]")
        out.append(d)
    return out

@app.post("/api/posts/{id}/versions/{vid}/restore")
async def restore_version(id: int, vid: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "posts", id, user["id"])
        v = conn.execute("SELECT * FROM post_versions WHERE id=? AND post_id=? AND user_id=?",
                         (vid, id, user["id"])).fetchone()
        if not v:
            raise HTTPException(404, "Version not found")
        # snapshot current before restoring
        cur = conn.execute("SELECT * FROM posts WHERE id=?", (id,)).fetchone()
        conn.execute("INSERT INTO post_versions (post_id, user_id, content, platforms, edited_by, created_at) VALUES (?,?,?,?,?,?)",
                     (id, user["id"], cur["content"], cur["platforms"], user["name"], now_iso()))
        conn.execute("UPDATE posts SET content=?, platforms=?, updated_at=? WHERE id=?",
                     (v["content"], v["platforms"], now_iso(), id))
        conn.commit()
        row = conn.execute("SELECT * FROM posts WHERE id=?", (id,)).fetchone()
    log_activity(user["id"], "post", "Restored an earlier version of a post")
    return post_dict(row)

@app.post("/api/posts/{id}/approve")
async def approve_post(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        row = own(conn, "posts", id, user["id"])
        if row["status"] != "pending":
            raise HTTPException(400, "Only pending posts can be approved")
        if row["scheduled_at"]:
            conn.execute("UPDATE posts SET status='scheduled', review_note='', updated_at=? WHERE id=?", (now_iso(), id))
            msg = f"Approved — scheduled for {row['scheduled_at']}"
        else:
            likes = random.randint(5, 120)
            conn.execute("UPDATE posts SET status='published', published_at=?, likes=?, reach=?, review_note='', updated_at=? WHERE id=?",
                         (now_iso(), likes, likes * random.randint(15, 30), now_iso(), id))
            msg = "Approved & published"
        emit_webhooks(conn, user["id"], "post.approved", {"post_id": id, "result": msg})
        conn.commit()
        row = conn.execute("SELECT * FROM posts WHERE id=?", (id,)).fetchone()
    log_activity(user["id"], "post", f"You approved {row['author']}'s post")
    return post_dict(row)

@app.post("/api/posts/{id}/reject")
async def reject_post(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    note = (body.get("note") or "").strip()
    with closing(db()) as conn:
        row = own(conn, "posts", id, user["id"])
        if row["status"] != "pending":
            raise HTTPException(400, "Only pending posts can be rejected")
        conn.execute("UPDATE posts SET status='draft', review_note=?, updated_at=? WHERE id=?",
                     (note, now_iso(), id))
        conn.commit()
        row = conn.execute("SELECT * FROM posts WHERE id=?", (id,)).fetchone()
    log_activity(user["id"], "post", f"You sent {row['author']}'s post back to drafts")
    return post_dict(row)

@app.get("/api/calendar")
async def calendar(user=Depends(require_user), month: Optional[str] = None):
    await jitter(0.1, 0.3)
    uid = user["id"]
    with closing(db()) as conn:
        maybe_autopublish(conn, uid)
        rows = conn.execute("SELECT * FROM posts WHERE user_id=? AND status IN ('scheduled','published') AND (scheduled_at IS NOT NULL OR published_at IS NOT NULL)",
                            (uid,)).fetchall()
    out = []
    for r in rows:
        d = post_dict(r)
        d["day"] = (d["scheduled_at"] or d["published_at"] or "")[:10]
        out.append(d)
    return out

# ---- campaigns

@app.get("/api/campaigns")
async def list_campaigns(user=Depends(require_user)):
    await jitter()
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM campaigns WHERE user_id=? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, created_at DESC",
                            (user["id"],)).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["post_count"] = conn.execute("SELECT COUNT(*) c FROM posts WHERE user_id=? AND campaign_id=?", (user["id"], r["id"])).fetchone()["c"]
            out.append(d)
    return out

@app.post("/api/campaigns")
async def create_campaign(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Campaign name is required")
    with closing(db()) as conn:
        cur = conn.execute("""INSERT INTO campaigns (user_id, name, goal, status, budget, spent, start_date, end_date, color, created_at)
                              VALUES (?,?,?,?,?,?,?,?,?,?)""",
                           (user["id"], name, body.get("goal") or "Awareness", body.get("status") or "draft",
                            float(body.get("budget") or 0), float(body.get("spent") or 0),
                            body.get("start_date"), body.get("end_date"), body.get("color") or "#8b5cf6", now_iso()))
        row = conn.execute("SELECT * FROM campaigns WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    log_activity(user["id"], "campaign", f"Campaign “{name}” created")
    d = dict(row)
    d["post_count"] = 0
    return d

@app.patch("/api/campaigns/{id}")
async def update_campaign(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        row = own(conn, "campaigns", id, user["id"])
        d = dict(row)
        for k in ("name", "goal", "status", "start_date", "end_date", "color"):
            if k in body and body[k] is not None:
                d[k] = body[k]
        for k in ("budget", "spent"):
            if k in body:
                try:
                    d[k] = float(body[k])
                except (TypeError, ValueError):
                    pass
        conn.execute("UPDATE campaigns SET name=?, goal=?, status=?, budget=?, spent=?, start_date=?, end_date=?, color=? WHERE id=?",
                     (d["name"], d["goal"], d["status"], d["budget"], d["spent"], d["start_date"], d["end_date"], d["color"], id))
        conn.commit()
        row = conn.execute("SELECT * FROM campaigns WHERE id=?", (id,)).fetchone()
        pc = conn.execute("SELECT COUNT(*) c FROM posts WHERE user_id=? AND campaign_id=?", (user["id"], id)).fetchone()["c"]
    d2 = dict(row)
    d2["post_count"] = pc
    return d2

@app.delete("/api/campaigns/{id}")
async def delete_campaign(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "campaigns", id, user["id"])
        conn.execute("UPDATE posts SET campaign_id=NULL WHERE campaign_id=?", (id,))
        conn.execute("DELETE FROM campaigns WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# ---- analytics

@app.get("/api/analytics")
async def analytics(user=Depends(require_user), range: int = 30):
    await jitter(0.2, 0.5)
    uid = user["id"]
    rng_days = min(max(range, 7), 90)
    with closing(db()) as conn:
        cur = [dict(r) for r in conn.execute(
            "SELECT date, followers, reach, impressions, engagement, clicks FROM analytics WHERE user_id=? AND date>=? ORDER BY date",
            (uid, day_iso(-rng_days)))]
        prev = [dict(r) for r in conn.execute(
            "SELECT followers, reach, engagement, clicks FROM analytics WHERE user_id=? AND date>=? AND date<? ORDER BY date",
            (uid, day_iso(-2 * rng_days), day_iso(-rng_days)))]
        accounts = [dict(r) for r in conn.execute("SELECT * FROM accounts WHERE user_id=?", (uid,))]
    def sums(rows, key):
        return sum(r[key] for r in rows)
    summary = {
        "reach": sums(cur, "reach"),
        "impressions": sums(cur, "impressions"),
        "engagement": round(sum(r["engagement"] for r in cur) / len(cur), 2) if cur else 0,
        "clicks": sums(cur, "clicks"),
        "followers": cur[-1]["followers"] if cur else 0,
    }
    deltas = {}
    if prev:
        for k in ("reach", "clicks"):
            pv = sums(prev, k)
            deltas[k] = round((summary[k] - pv) / pv * 100, 1) if pv else 0
        pv_eng = sum(r["engagement"] for r in prev) / len(prev)
        deltas["engagement"] = round(summary["engagement"] - pv_eng, 2)
        pv_f = prev[-1]["followers"] if prev else summary["followers"]
        deltas["followers"] = summary["followers"] - pv_f
    platform_stats = []
    for a in accounts:
        if a["status"] == "connected":
            platform_stats.append({"platform": a["platform"], "handle": a["handle"], "followers": a["followers"], "engagement": a["engagement"]})
    platform_stats.sort(key=lambda x: -x["followers"])
    return {"series": cur, "summary": summary, "deltas": deltas, "platforms": platform_stats, "range": rng_days}

# ---- templates

@app.get("/api/templates")
async def list_templates(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM templates WHERE user_id=? ORDER BY id", (user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/templates")
async def create_template(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    name = (body.get("name") or "").strip()
    prompt = (body.get("prompt") or "").strip()
    if not name or not prompt:
        raise HTTPException(400, "A name and prompt are required")
    with closing(db()) as conn:
        cur = conn.execute("INSERT INTO templates (user_id, name, category, description, prompt) VALUES (?,?,?,?,?)",
                           (user["id"], name, body.get("category") or "General", body.get("description") or "", prompt))
        row = conn.execute("SELECT * FROM templates WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    return dict(row)

@app.patch("/api/templates/{id}")
async def update_template(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        row = own(conn, "templates", id, user["id"])
        d = dict(row)
        for k in ("name", "category", "description", "prompt"):
            if k in body:
                d[k] = body[k]
        conn.execute("UPDATE templates SET name=?, category=?, description=?, prompt=? WHERE id=?",
                     (d["name"], d["category"], d["description"], d["prompt"], id))
        conn.commit()
        row = conn.execute("SELECT * FROM templates WHERE id=?", (id,)).fetchone()
    return dict(row)

@app.delete("/api/templates/{id}")
async def delete_template(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "templates", id, user["id"])
        conn.execute("DELETE FROM templates WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# ---- AI

EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F02F]")

def apply_brand_voice(content, voice):
    if not isinstance(voice, dict):
        return content
    for w in (voice.get("avoid") or []):
        w = w.strip()
        if w:
            content = re.sub(r"(?i)\b%s\b" % re.escape(w), "", content)
    content = re.sub(r" {2,}", " ", content).replace(" .", ".").replace(" ,", ",").strip()
    if voice.get("emoji") is False:
        content = EMOJI_RE.sub("", content)
    sig = (voice.get("signature") or "").strip()
    if sig and sig.lower() not in content.lower():
        content = content.rstrip() + "\n\n" + sig
    return content

@app.post("/api/ai/generate")
async def generate(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    topic = (body.get("topic") or "").strip()
    if not topic:
        raise HTTPException(400, "Give the AI a topic or goal")
    tone = body.get("tone") or "casual"
    plats = body.get("platforms") or ["instagram"]
    length = body.get("length") or "medium"
    await asyncio.sleep(random.uniform(1.2, 2.0))  # simulated model latency
    with closing(db()) as conn:
        u = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        limit = PLAN_LIMITS.get(u["plan"], 500)
        if u["ai_credits_used"] >= limit:
            raise HTTPException(402, "You're out of AI credits. Upgrade your plan to keep generating.")
        content, tags, best_time, confidence = ai_generate(topic, tone, plats, length)
        try:
            voice = json.loads(u["prefs"] or "{}").get("brandVoice") or {}
        except ValueError:
            voice = {}
        content = apply_brand_voice(content, voice)
        conn.execute("UPDATE users SET ai_credits_used = ai_credits_used + ? WHERE id=?", (CREDIT_COST, user["id"]))
        conn.execute("INSERT INTO generations (user_id, topic, tone, platforms, content, hashtags, created_at) VALUES (?,?,?,?,?,?,?)",
                     (user["id"], topic, tone, json.dumps(plats), content, json.dumps(tags), now_iso()))
        conn.commit()
        used = conn.execute("SELECT ai_credits_used FROM users WHERE id=?", (user["id"],)).fetchone()["ai_credits_used"]
    log_activity(user["id"], "ai", f"AI draft generated for “{topic[:48]}”")
    return {"content": content, "hashtags": tags, "best_time": best_time, "confidence": confidence,
            "credits_used": CREDIT_COST, "credits_left": limit - used}

# ---- AI rewrite

REWRITE_STOP = {"the","and","with","this","that","your","you","are","for","from","have","has","our","we","will","just","into","about","more","what","when","how","why","its","it's","get","can","all","new","now"}

def ai_rewrite(content, action):
    rng = random.Random(hashlib.sha256(content.encode()).hexdigest())
    c = content.strip()
    words = [w.strip(".,!?():;\"'") for w in c.lower().split()]
    keyws = [w for w in words if len(w) > 3 and w.isalpha() and w not in REWRITE_STOP][:6]
    if action == "shorten":
        cut = max(20, int(len(c) * 0.6))
        s = c[:cut]
        if "." in s: s = s[:s.rfind(".") + 1]
        return s.strip()
    if action == "expand":
        tail = rng.choice([
            " Here's why it matters: small, consistent wins compound faster than one big splash.",
            " We broke it down step by step so your team can repeat it tomorrow morning.",
            " The numbers back it up — and the trend is still climbing this week.",
            " Save this one: it's the kind of detail your competitors will copy next month.",
        ])
        return c + tail
    if action == "improve":
        hook = rng.choice(["Stop scrolling — ", "Real talk: ", "Here's what nobody tells you: ", "Quick win alert: "])
        body = c[0].lower() + c[1:] if len(c) > 1 and c[0].isupper() and not c.startswith(("http", "#")) else c
        return hook + body
    if action == "hashtags":
        base = [w.capitalize() for w in keyws[:4]]
        pool = ["SocialMedia", "Marketing", "Growth", "ContentStrategy", "BrandBuilding", "DigitalMarketing", "Community", "Trending"]
        rng.shuffle(pool)
        tags = base + pool[: max(2, 6 - len(base))]
        return c + "\n\n" + " ".join("#" + t.replace(" ", "") for t in tags)
    if action == "emoji":
        em = rng.sample(["🚀", "✨", "🔥", "💡", "📈", "🎯", "⚡", "🙌"], 3)
        sents = [s.strip() for s in c.replace("!", ".").split(".") if s.strip()]
        out = []
        for i, s in enumerate(sents):
            out.append(s + ("!" if rng.random() < 0.5 else ".") + " " + em[i % len(em)])
        return " ".join(out).strip()
    raise HTTPException(400, "Unknown rewrite action")

@app.post("/api/ai/rewrite")
async def rewrite(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    content = (body.get("content") or "").strip()
    action = body.get("action") or ""
    if not content:
        raise HTTPException(400, "Write something first")
    if action not in ("shorten", "expand", "improve", "hashtags", "emoji"):
        raise HTTPException(400, "Unknown rewrite action")
    await asyncio.sleep(random.uniform(0.9, 1.6))  # simulated model latency
    with closing(db()) as conn:
        u = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        limit = PLAN_LIMITS.get(u["plan"], 500)
        if u["ai_credits_used"] + REWRITE_COST > limit:
            raise HTTPException(402, "Not enough AI credits for a rewrite. Upgrade your plan.")
        result = ai_rewrite(content, action)
        try:
            voice = json.loads(u["prefs"] or "{}").get("brandVoice") or {}
        except ValueError:
            voice = {}
        if action in ("improve", "expand"):
            result = apply_brand_voice(result, voice)
        conn.execute("UPDATE users SET ai_credits_used = ai_credits_used + ? WHERE id=?", (REWRITE_COST, user["id"]))
        conn.commit()
        used = conn.execute("SELECT ai_credits_used FROM users WHERE id=?", (user["id"],)).fetchone()["ai_credits_used"]
    log_activity(user["id"], "ai", f"AI rewrite applied ({action})")
    return {"content": result, "action": action,
            "credits_used": REWRITE_COST, "credits_left": limit - used}

# ---- quick replies

@app.get("/api/quick-replies")
async def list_quick_replies(user=Depends(require_user)):
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM quick_replies WHERE user_id=? ORDER BY id", (user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/quick-replies")
async def create_quick_reply(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    title = (body.get("title") or "").strip()
    text = (body.get("body") or "").strip()
    if not title or not text:
        raise HTTPException(400, "Give the snippet a name and text")
    with closing(db()) as conn:
        cur = conn.execute("INSERT INTO quick_replies (user_id, title, body, created_at) VALUES (?,?,?,?)",
                           (user["id"], title, text, now_iso()))
        conn.commit()
        row = conn.execute("SELECT * FROM quick_replies WHERE id=?", (cur.lastrowid,)).fetchone()
    return dict(row)

@app.delete("/api/quick-replies/{id}")
async def delete_quick_reply(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "quick_replies", id, user["id"])
        conn.execute("DELETE FROM quick_replies WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# ---- competitor battle

BATTLE_COST = 5

@app.post("/api/competitors/{id}/battle")
async def battle_competitor(id: int, user=Depends(require_user)):
    await asyncio.sleep(random.uniform(1.6, 2.4))  # simulated deep analysis
    with closing(db()) as conn:
        comp = own(conn, "competitors", id, user["id"])
        u = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
        limit = PLAN_LIMITS.get(u["plan"], 500)
        if u["ai_credits_used"] + BATTLE_COST > limit:
            raise HTTPException(402, "Not enough AI credits for a battle report. Upgrade your plan.")
        mine = conn.execute(
            "SELECT reach, engagement, followers FROM analytics WHERE user_id=? AND date>=? ORDER BY date",
            (user["id"], day_iso(-29))).fetchall()
        conn.execute("UPDATE users SET ai_credits_used = ai_credits_used + ? WHERE id=?", (BATTLE_COST, user["id"]))
        conn.commit()
        used = conn.execute("SELECT ai_credits_used FROM users WHERE id=?", (user["id"],)).fetchone()["ai_credits_used"]
    my_followers = mine[-1]["followers"] if mine else 0
    my_eng = round(sum(r["engagement"] for r in mine) / len(mine), 2) if mine else 0.0
    my_growth = round((mine[-1]["followers"] - mine[0]["followers"]) / max(1, mine[0]["followers"]) * 100, 1) if len(mine) > 1 else 0.0
    rows = [
        {"metric": "Followers", "you": my_followers, "them": comp["followers"],
         "winner": "you" if my_followers >= comp["followers"] else "them", "fmt": "num"},
        {"metric": "30-day growth", "you": my_growth, "them": comp["growth"],
         "winner": "you" if my_growth >= comp["growth"] else "them", "fmt": "pct"},
        {"metric": "Engagement rate", "you": my_eng, "them": comp["engagement"],
         "winner": "you" if my_eng >= comp["engagement"] else "them", "fmt": "pct"},
    ]
    you_won = sum(1 for r in rows if r["winner"] == "you")
    rng = random.Random(f"{user['id']}-{id}-{day_iso(0)}")
    advice_pool = [
        f"{comp['name']} leans hard on {PLATFORMS.get(comp['platform'], {}).get('name', 'their')} video content — a consistent series could claw back attention.",
        "Their posting cadence dips on weekends; that's your opening to own the feed.",
        "Double down on your top-performing format this month while their growth cools.",
        "Run an A/B experiment on your hook style — engagement is the battlefield you can win fastest.",
    ]
    verdict = ("You're ahead on most fronts. Keep the pressure on and protect your engagement lead."
               if you_won >= 2 else
               f"{comp['name']} currently has the edge. Targeted moves below can flip the balance.")
    log_activity(user["id"], "report", f"Battle report vs {comp['name']}: {'won' if you_won >= 2 else 'behind'} on {you_won}/3 metrics")
    return {"competitor": comp["name"], "handle": comp["handle"], "platform": comp["platform"],
            "rows": rows, "score": f"{you_won}/3", "leading": you_won >= 2,
            "verdict": verdict, "advice": rng.sample(advice_pool, 2),
            "credits_used": BATTLE_COST, "credits_left": limit - used}

# ---- schedule conflict check

@app.post("/api/posts/check-conflict")
async def check_conflict(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    when = (body.get("scheduled_at") or "").replace("T", " ")[:16]
    plats = body.get("platforms") or []
    exclude = body.get("exclude_id")
    if not when or not plats:
        return {"conflicts": []}
    try:
        at = dt.datetime.strptime(when, "%Y-%m-%d %H:%M")
    except ValueError:
        return {"conflicts": []}
    lo = (at - dt.timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M")
    hi = (at + dt.timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M")
    with closing(db()) as conn:
        rows = conn.execute(
            "SELECT id, content, platforms, scheduled_at FROM posts WHERE user_id=? AND status='scheduled' AND scheduled_at IS NOT NULL"
            " AND replace(scheduled_at,'T',' ') >= ? AND replace(scheduled_at,'T',' ') <= ?",
            (user["id"], lo, hi)).fetchall()
    conflicts = []
    for r in rows:
        if exclude and r["id"] == exclude:
            continue
        rp = json.loads(r["platforms"] or "[]")
        shared = [p for p in rp if p in plats]
        if shared:
            conflicts.append({"id": r["id"], "content": r["content"], "platforms": shared, "scheduled_at": r["scheduled_at"]})
    return {"conflicts": conflicts}

# ---- trends

TREND_POOLS = {
    "instagram": ["reels", "behindthescenes", "carousel", "photodump", "aesthetic", "creatorlife", "goldenhour", "moodboard", "storytime", "grwm", "flatlay", "viralreels"],
    "twitter": ["buildinpublic", "technews", "startuplife", "aitools", "devlife", "producthunt", "indiehackers", "saas", "growthhacking", "remotework", "founders", "openai"],
    "linkedin": ["leadership", "futureofwork", "b2b", "careergrowth", "thoughtleadership", "hiring", "personalbranding", "salesstrategy", "innovation", "networking", "upskilling", "companyculture"],
    "facebook": ["community", "smallbusiness", "locallove", "familyowned", "giveaway", "livestream", "customerstories", "weekendvibes", "supportlocal", "flashsale", "behindthescenes", "event"],
    "tiktok": ["fyp", "duet", "trendalert", "pov", "dayinmylife", "tutorial", "lifehack", "storytime", "greenscreen", "capcut", "viralvideo", "comedy"],
    "youtube": ["shorts", "tutorial", "howto", "review", "unboxing", "vlog", "creator", "subscriber", "deepdive", "explained", "top10", "documentary"],
}

@app.get("/api/trends")
async def trends(platform: str = "instagram", user=Depends(require_user)):
    await jitter(0.2, 0.5)
    pool = TREND_POOLS.get(platform, TREND_POOLS["instagram"])
    seed_key = f"{platform}-{day_iso(0)}"
    rng = random.Random(hashlib.sha256(seed_key.encode()).hexdigest())
    s_rng = random.Random(seed_key + "-series")
    tags = pool[:]
    rng.shuffle(tags)
    out = []
    for i, t in enumerate(tags[:12]):
        vol = rng.randint(90, 2400) * 1000
        growth = rng.randint(-18, 85)
        sentiment = rng.choices(["positive", "neutral", "negative"], weights=[62, 30, 8])[0]
        series = []
        v = vol / rng.uniform(1.4, 2.6)
        for _ in range(14):
            v = max(1000, v * rng.uniform(0.9, 1.0 + max(0.02, growth / 400)))
            series.append(int(v))
        out.append({"tag": t, "volume": vol, "growth": growth, "sentiment": sentiment,
                    "score": round(min(100, vol / 25000 + max(0, growth)), 1), "series": series})
    out.sort(key=lambda x: x["score"], reverse=True)
    return {"platform": platform, "trends": out, "as_of": now_iso()}

# ---- posting heatmap

@app.get("/api/heatmap")
async def heatmap(user=Depends(require_user)):
    with closing(db()) as conn:
        rows = conn.execute("SELECT published_at FROM posts WHERE user_id=? AND status='published' AND published_at IS NOT NULL",
                            (user["id"],)).fetchall()
    days = {}
    for r in rows:
        d = (r["published_at"] or "")[:10]
        if d: days[d] = days.get(d, 0) + 1
    start = dt.date.today() - dt.timedelta(days=83)
    grid = {}
    for i in range(84):
        grid[(start + dt.timedelta(days=i)).strftime("%Y-%m-%d")] = 0
    for d, n in days.items():
        if d in grid: grid[d] = n
    return {"days": grid, "streak": _streak(grid)}

def _streak(grid):
    streak = 0
    today = dt.date.today()
    for i in range(84):
        d = (today - dt.timedelta(days=i)).strftime("%Y-%m-%d")
        if grid.get(d, 0) > 0: streak += 1
        elif i == 0: continue  # today may not have a post yet
        else: break
    return streak

@app.get("/api/generations")
async def generations(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM generations WHERE user_id=? ORDER BY datetime(created_at) DESC LIMIT 10", (user["id"],)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["platforms"] = json.loads(d["platforms"] or "[]")
        d["hashtags"] = json.loads(d["hashtags"] or "[]")
        out.append(d)
    return out

# ---- notifications

@app.get("/api/notifications")
async def notifications(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    uid = user["id"]
    prefs = json.loads(user.get("prefs") or "{}")
    last_seen = prefs.get("notifications_last_seen", "")
    with closing(db()) as conn:
        rows = conn.execute("SELECT type, message, created_at FROM activity WHERE user_id=? ORDER BY datetime(created_at) DESC LIMIT 30",
                            (uid,)).fetchall()
    items = [dict(r) for r in rows]
    unread = len([i for i in items if last_seen == "" or i["created_at"] > last_seen])
    return {"items": items, "unread": unread, "last_seen": last_seen}

@app.post("/api/notifications/read")
async def notifications_read(user=Depends(require_user)):
    with closing(db()) as conn:
        prefs = json.loads(user["prefs"] or "{}")
        prefs["notifications_last_seen"] = now_iso()
        conn.execute("UPDATE users SET prefs=? WHERE id=?", (json.dumps(prefs), user["id"]))
        conn.commit()
    return {"ok": True}

# ---- social listening

def kw_dict(row):
    d = dict(row)
    d["sentiment"] = json.loads(d["sentiment"] or "{}")
    d["series"] = json.loads(d["series"] or "[]")
    d["mentions"] = json.loads(d["mentions"] or "[]")
    return d

@app.get("/api/keywords")
async def list_keywords(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM keywords WHERE user_id=? ORDER BY volume DESC", (user["id"],)).fetchall()
    return [kw_dict(r) for r in rows]

@app.post("/api/keywords")
async def create_keyword(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    keyword = (body.get("keyword") or "").strip()
    if not keyword:
        raise HTTPException(400, "Enter a keyword or phrase to track")
    await asyncio.sleep(1.0)  # simulated web scan
    with closing(db()) as conn:
        if conn.execute("SELECT 1 FROM keywords WHERE user_id=? AND lower(keyword)=lower(?)", (user["id"], keyword)).fetchone():
            raise HTTPException(409, "You're already tracking that keyword")
        d = build_keyword_data(keyword, random.Random())
        cur = conn.execute("""INSERT INTO keywords (user_id, keyword, volume, sentiment, series, mentions, status, created_at)
                              VALUES (?,?,?,?,?,?,?,?)""",
                           (user["id"], keyword, d["volume"], json.dumps(d["sentiment"]), json.dumps(d["series"]),
                            json.dumps(d["mentions"]), "active", now_iso()))
        row = conn.execute("SELECT * FROM keywords WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    log_activity(user["id"], "campaign", f"Now listening for “{keyword}” across the web")
    return kw_dict(row)

@app.patch("/api/keywords/{id}")
async def update_keyword(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        own(conn, "keywords", id, user["id"])
        status = body.get("status")
        if status not in ("active", "paused"):
            raise HTTPException(400, "Invalid status")
        conn.execute("UPDATE keywords SET status=? WHERE id=?", (status, id))
        conn.commit()
        row = conn.execute("SELECT * FROM keywords WHERE id=?", (id,)).fetchone()
    return kw_dict(row)

@app.delete("/api/keywords/{id}")
async def delete_keyword(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "keywords", id, user["id"])
        conn.execute("DELETE FROM keywords WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# ---- content ideas

IDEA_BANK = [
    ("Behind the Scenes", "Show the messy middle of {niche} — the desk, the failed drafts, the whiteboard before the polish."),
    ("Myth vs. Fact", "Bust a common myth about {niche} with one surprising stat and a 3-point breakdown."),
    ("Before / After", "A side-by-side transformation from one of your {niche} projects — with the exact steps in between."),
    ("Tool Stack Reveal", "The 5 tools you can't run your {niche} workflow without, each with a one-line honest review."),
    ("AMA Session", "Open an ask-me-anything about {niche}; seed it with the 3 questions you get most often."),
    ("Contrarian Take", "Defend an unpopular opinion about {niche} and invite the audience to change your mind."),
    ("Mini Case Study", "Walk through how someone got a specific, measurable result with {niche} in under 30 days."),
    ("Checklist Post", "Publish the exact pre-flight checklist you run before shipping {niche} work."),
    ("Day in the Life", "A timestamped day-in-the-life that quietly demonstrates your {niche} process."),
    ("Trend Remix", "Take this week's trending audio/format and apply it to a {niche} lesson."),
    ("Numbers Post", "Share 3 real metrics from your {niche} journey this quarter — transparency drives saves."),
    ("Common Mistakes", "The 3 mistakes you see constantly in {niche}, and the 10-second fix for each."),
]
IDEA_CATEGORIES = {"Behind the Scenes": "Authenticity", "Myth vs. Fact": "Education", "Before / After": "Social Proof",
                   "Tool Stack Reveal": "Education", "AMA Session": "Community", "Contrarian Take": "Engagement",
                   "Mini Case Study": "Social Proof", "Checklist Post": "Education", "Day in the Life": "Authenticity",
                   "Trend Remix": "Engagement", "Numbers Post": "Authenticity", "Common Mistakes": "Education"}

@app.get("/api/ideas")
async def ideas(user=Depends(require_user), seed: Optional[int] = None):
    await asyncio.sleep(random.uniform(0.7, 1.2))
    uid = user["id"]
    with closing(db()) as conn:
        contents = [r["content"].lower() for r in conn.execute(
            "SELECT content FROM posts WHERE user_id=? LIMIT 40", (uid,))]
    words = {}
    stop = {"about", "their", "there", "which", "would", "could", "should", "these", "those", "before", "after",
            "every", "where", "being", "because", "while", "nothing", "something", "launch", "post", "posts",
            "content", "creators", "creator"}
    for c in contents:
        for w in re.findall(r"[a-z]{5,}", c):
            if w not in stop:
                words[w] = words.get(w, 0) + 1
    niche = max(words, key=words.get) if words else "your niche"
    rng = random.Random(seed if seed is not None else random.randint(0, 10 ** 9))
    picked = rng.sample(IDEA_BANK, 6)
    out = []
    for title, tmpl in picked:
        out.append({
            "title": title,
            "category": IDEA_CATEGORIES.get(title, "General"),
            "text": tmpl.format(niche=niche),
            "hook_score": rng.randint(71, 98),
            "platform": rng.choice(["instagram", "x", "linkedin", "tiktok", "youtube"]),
            "niche": niche,
        })
    return {"ideas": out, "niche": niche}

# ---- export / backup

@app.get("/api/export/workspace")
async def export_workspace(user=Depends(require_user)):
    uid = user["id"]
    data = {"exported_at": now_iso(), "user": public_user(user)}
    tables = {
        "accounts": "SELECT * FROM accounts WHERE user_id=?",
        "posts": "SELECT * FROM posts WHERE user_id=?",
        "campaigns": "SELECT * FROM campaigns WHERE user_id=?",
        "templates": "SELECT * FROM templates WHERE user_id=?",
        "generations": "SELECT * FROM generations WHERE user_id=?",
        "conversations": "SELECT * FROM conversations WHERE user_id=?",
        "team_members": "SELECT * FROM team_members WHERE user_id=?",
        "media": "SELECT id, user_id, name, kind, tags, size, created_at FROM media WHERE user_id=?",
        "competitors": "SELECT * FROM competitors WHERE user_id=?",
        "reports": "SELECT * FROM reports WHERE user_id=?",
        "keywords": "SELECT * FROM keywords WHERE user_id=?",
        "activity": "SELECT * FROM activity WHERE user_id=?",
        "analytics": "SELECT * FROM analytics WHERE user_id=?",
    }
    with closing(db()) as conn:
        for name, sql in tables.items():
            data[name] = [dict(r) for r in conn.execute(sql, (uid,))]
    body = json.dumps(data, indent=2, ensure_ascii=False)
    return Response(content=body, media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="lumina-backup-{day_iso()}.json"'})

@app.get("/api/export/analytics.csv")
async def export_analytics_csv(user=Depends(require_user)):
    uid = user["id"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "followers", "reach", "impressions", "engagement_pct", "clicks"])
    with closing(db()) as conn:
        for r in conn.execute("SELECT date, followers, reach, impressions, engagement, clicks FROM analytics WHERE user_id=? ORDER BY date", (uid,)):
            w.writerow([r["date"], r["followers"], r["reach"], r["impressions"], r["engagement"], r["clicks"]])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="lumina-analytics-{day_iso()}.csv"'})

@app.get("/api/export/posts.csv")
async def export_posts_csv(user=Depends(require_user)):
    uid = user["id"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "status", "platforms", "author", "created_at", "scheduled_at", "published_at", "likes", "comments", "shares", "reach", "content"])
    with closing(db()) as conn:
        for r in conn.execute("SELECT * FROM posts WHERE user_id=? ORDER BY created_at DESC", (uid,)):
            w.writerow([r["id"], r["status"], json.loads(r["platforms"] or "[]"), r["author"], r["created_at"],
                        r["scheduled_at"], r["published_at"], r["likes"], r["comments"], r["shares"], r["reach"], r["content"]])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="lumina-posts-{day_iso()}.csv"'})

# ---- integrations

def emit_webhooks(conn, user_id, event, payload):
    rows = conn.execute("SELECT id, key FROM integrations WHERE user_id=? AND enabled=1", (user_id,)).fetchall()
    for r in rows:
        conn.execute("INSERT INTO webhook_events (user_id, integration_id, event, payload, created_at) VALUES (?,?,?,?,?)",
                     (user_id, r["id"], event, json.dumps(payload), now_iso()))

INTEGRATION_CATALOG = ["slack", "zapier", "canva", "gdrive", "stripe", "shopify"]

@app.get("/api/integrations")
async def list_integrations(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM integrations WHERE user_id=? ORDER BY connected_at", (user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/integrations")
async def connect_integration(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    key = body.get("key")
    if key not in INTEGRATION_CATALOG:
        raise HTTPException(400, "Unknown integration")
    await asyncio.sleep(1.0)  # simulated OAuth
    with closing(db()) as conn:
        if conn.execute("SELECT 1 FROM integrations WHERE user_id=? AND key=?", (user["id"], key)).fetchone():
            raise HTTPException(409, "Already connected")
        cur = conn.execute("INSERT INTO integrations (user_id, key, enabled, webhook_token, connected_at, last_sync) VALUES (?,?,?,?,?,?)",
                           (user["id"], key, 1, secrets.token_hex(8), now_iso(), now_iso()))
        row = conn.execute("SELECT * FROM integrations WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    log_activity(user["id"], "account", f"Connected the {key} integration")
    return dict(row)

@app.patch("/api/integrations/{id}")
async def update_integration(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        row = own(conn, "integrations", id, user["id"])
        enabled = 1 if body.get("enabled", row["enabled"]) else 0
        conn.execute("UPDATE integrations SET enabled=?, last_sync=? WHERE id=?", (enabled, now_iso(), id))
        conn.commit()
        row = conn.execute("SELECT * FROM integrations WHERE id=?", (id,)).fetchone()
    return dict(row)

@app.delete("/api/integrations/{id}")
async def delete_integration(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "integrations", id, user["id"])
        conn.execute("DELETE FROM integrations WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

@app.post("/api/integrations/{id}/test")
async def test_integration(id: int, user=Depends(require_user)):
    await asyncio.sleep(0.8)
    with closing(db()) as conn:
        row = own(conn, "integrations", id, user["id"])
        conn.execute("UPDATE integrations SET last_sync=? WHERE id=?", (now_iso(), id))
        emit_webhooks(conn, user["id"], "test.ping", {"integration": row["key"], "source": "manual-test"})
        conn.commit()
    log_activity(user["id"], "account", f"Test event delivered to {row['key']} ✓")
    return {"ok": True, "key": row["key"]}

@app.get("/api/webhook-events")
async def webhook_events(user=Depends(require_user)):
    await jitter(0.1, 0.25)
    with closing(db()) as conn:
        rows = conn.execute("""SELECT w.*, i.key AS integration_key FROM webhook_events w
                               JOIN integrations i ON i.id = w.integration_id
                               WHERE w.user_id=? ORDER BY datetime(w.created_at) DESC LIMIT 30""", (user["id"],)).fetchall()
    return [dict(r) for r in rows]

# ---- A/B experiments

@app.get("/api/ab")
async def list_ab(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        rows = conn.execute("""SELECT a.*, p.content AS post_content, p.status AS post_status, p.platforms AS post_platforms
                               FROM ab_tests a JOIN posts p ON p.id = a.post_id
                               WHERE a.user_id=? ORDER BY datetime(a.created_at) DESC""", (user["id"],)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["platforms"] = json.loads(d.get("post_platforms") or "[]")
        out.append(d)
    return out

@app.post("/api/ab")
async def create_ab(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    content_b = (body.get("content_b") or "").strip()
    if not content_b:
        raise HTTPException(400, "Variant B content is required")
    await asyncio.sleep(0.8)
    with closing(db()) as conn:
        post = own(conn, "posts", body.get("post_id"), user["id"])
        if post["status"] not in ("draft", "scheduled"):
            raise HTTPException(409, "Only draft or scheduled posts can run experiments")
        if conn.execute("SELECT 1 FROM ab_tests WHERE post_id=? AND status='running'", (post["id"],)).fetchone():
            raise HTTPException(409, "This post already has a running experiment")
        cur = conn.execute("INSERT INTO ab_tests (user_id, post_id, content_a, content_b, created_at) VALUES (?,?,?,?,?)",
                           (user["id"], post["id"], post["content"], content_b, now_iso()))
        row = conn.execute("SELECT * FROM ab_tests WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    log_activity(user["id"], "post", "Started an A/B experiment on a post")
    return dict(row)

@app.post("/api/ab/{id}/decide")
async def decide_ab(id: int, user=Depends(require_user)):
    await asyncio.sleep(1.2)
    rng = random.Random(id * 7919 + int(time.time() / 60))
    with closing(db()) as conn:
        row = own(conn, "ab_tests", id, user["id"])
        if row["status"] != "running":
            raise HTTPException(409, "Experiment already completed")
        post = conn.execute("SELECT * FROM posts WHERE id=?", (row["post_id"],)).fetchone()
        ma = round(rng.uniform(1.4, 6.8), 2)
        mb = round(rng.uniform(1.4, 6.8), 2)
        if abs(ma - mb) < 0.15:
            mb = round(ma + 0.3, 2)
        winner = "A" if ma >= mb else "B"
        conn.execute("UPDATE ab_tests SET metric_a=?, metric_b=?, status='completed', winner=? WHERE id=?",
                     (ma, mb, winner, id))
        if winner == "B" and post and post["status"] in ("draft", "scheduled"):
            # snapshot current content, then promote the winning variant
            conn.execute("INSERT INTO post_versions (post_id, user_id, content, platforms, edited_by, created_at) VALUES (?,?,?,?,?,?)",
                         (post["id"], user["id"], post["content"], post["platforms"], "A/B test", now_iso()))
            conn.execute("UPDATE posts SET content=?, updated_at=? WHERE id=?", (row["content_b"], now_iso(), post["id"]))
        conn.commit()
        out = conn.execute("SELECT * FROM ab_tests WHERE id=?", (id,)).fetchone()
    log_activity(user["id"], "post", f"A/B experiment completed — Variant {winner} won")
    return dict(out)

@app.delete("/api/ab/{id}")
async def delete_ab(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "ab_tests", id, user["id"])
        conn.execute("DELETE FROM ab_tests WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# ---- onboarding

@app.get("/api/onboarding")
async def onboarding(user=Depends(require_user)):
    uid = user["id"]
    with closing(db()) as conn:
        def has(sql):
            return conn.execute(sql, (uid,)).fetchone()["c"] > 0
        steps = [
            {"id": "account", "label": "Connect a social account", "link": "accounts",
             "done": has("SELECT COUNT(*) c FROM accounts WHERE user_id=?")},
            {"id": "generate", "label": "Generate your first AI draft", "link": "generator",
             "done": has("SELECT COUNT(*) c FROM generations WHERE user_id=?")},
            {"id": "post", "label": "Create a post", "link": "posts",
             "done": has("SELECT COUNT(*) c FROM posts WHERE user_id=?")},
            {"id": "schedule", "label": "Schedule a post", "link": "calendar",
             "done": has("SELECT COUNT(*) c FROM posts WHERE user_id=? AND status IN ('scheduled','published')")},
            {"id": "keyword", "label": "Track a keyword", "link": "listening",
             "done": has("SELECT COUNT(*) c FROM keywords WHERE user_id=?")},
            {"id": "team", "label": "Invite a teammate", "link": "team",
             "done": has("SELECT COUNT(*) c FROM team_members WHERE user_id=?")},
        ]
    return {"steps": steps, "done": sum(1 for s in steps if s["done"]), "total": len(steps)}

# ---- workspace reset (demo helpers)

@app.post("/api/workspace/reset")
async def reset_workspace(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    mode = body.get("mode", "clear")
    uid = user["id"]
    tables = ["accounts", "posts", "campaigns", "analytics", "templates", "generations", "activity",
              "conversations", "team_members", "media", "invoices", "competitors", "reports", "keywords",
              "post_versions", "integrations", "ab_tests", "webhook_events", "quick_replies"]
    with closing(db()) as conn:
        for t in tables:
            conn.execute(f"DELETE FROM {t} WHERE user_id=?", (uid,))
        if mode == "demo":
            seed_starter_for(conn, uid)
            seed_analytics_for(conn, uid, days=30, base=1200, growth=35)
            demo_accounts = [
                ("instagram", "@my.new.brand", "My New Brand", 1240, 4.1, "connected", now_iso()),
                ("x", "@mynewbrand", "My New Brand", 380, 1.8, "connected", now_iso()),
            ]
            for a in demo_accounts:
                conn.execute("INSERT INTO accounts (user_id, platform, handle, display_name, followers, engagement, status, connected_at) VALUES (?,?,?,?,?,?,?,?)",
                             (uid, *a))
            conn.execute("INSERT INTO posts (user_id, content, platforms, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                         (uid, "Hello world 👋 This is our first post drafted in Lumina. Big things coming!",
                          json.dumps(["instagram"]), "draft", now_iso(), now_iso()))
        conn.execute("UPDATE users SET ai_credits_used=0 WHERE id=?", (uid,))
        conn.commit()
    return {"ok": True, "mode": mode}

# ---- inbox

def conv_dict(row):
    d = dict(row)
    d["replies"] = json.loads(d["replies"] or "[]")
    d["unread"] = bool(d["unread"])
    return d

@app.get("/api/inbox/unread")
async def inbox_unread(user=Depends(require_user)):
    with closing(db()) as conn:
        c = conn.execute("SELECT COUNT(*) c FROM conversations WHERE user_id=? AND unread=1 AND status NOT IN ('archived','resolved')",
                         (user["id"],)).fetchone()["c"]
    return {"count": c}

@app.get("/api/inbox")
async def list_inbox(user=Depends(require_user)):
    await jitter()
    with closing(db()) as conn:
        rows = conn.execute("""SELECT * FROM conversations WHERE user_id=?
            ORDER BY (CASE WHEN unread=1 THEN 0 ELSE 1 END), datetime(created_at) DESC""", (user["id"],)).fetchall()
    return [conv_dict(r) for r in rows]

@app.patch("/api/inbox/{id}")
async def update_conv(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        row = own(conn, "conversations", id, user["id"])
        status = body.get("status", row["status"])
        if status not in ("new", "replied", "resolved", "archived"):
            raise HTTPException(400, "Invalid status")
        unread = 1 if body.get("unread", bool(row["unread"])) else 0
        conn.execute("UPDATE conversations SET status=?, unread=? WHERE id=?", (status, unread, id))
        conn.commit()
        row = conn.execute("SELECT * FROM conversations WHERE id=?", (id,)).fetchone()
    return conv_dict(row)

@app.post("/api/inbox/{id}/reply")
async def reply_conv(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    text = (body.get("content") or "").strip()
    if not text:
        raise HTTPException(400, "Reply can't be empty")
    with closing(db()) as conn:
        row = own(conn, "conversations", id, user["id"])
        replies = json.loads(row["replies"] or "[]")
        replies.append({"author": user["name"], "text": text, "at": now_iso()})
        conn.execute("UPDATE conversations SET replies=?, status='replied', unread=0 WHERE id=?",
                     (json.dumps(replies), id))
        conn.commit()
        row = conn.execute("SELECT * FROM conversations WHERE id=?", (id,)).fetchone()
    log_activity(user["id"], "post", f"Replied to {row['author']} on {PLATFORMS.get(row['platform'], {}).get('name', row['platform'])}")
    return conv_dict(row)

@app.post("/api/inbox/{id}/ai-reply")
async def ai_reply(id: int, user=Depends(require_user)):
    await asyncio.sleep(random.uniform(0.9, 1.5))
    with closing(db()) as conn:
        row = own(conn, "conversations", id, user["id"])
    first = row["author"].split()[0]
    senti, ctype = row["sentiment"], row["type"]
    if senti == "negative":
        sugs = [
            f"Thanks for flagging this, {first} — that's not the experience we want you to have. I've looped in our billing team and we'll make it right within 24h. Could you DM us your account email?",
            f"Really sorry about that, {first}. This is on us. I've opened a priority ticket and someone from the team will reach out today with a fix and a credit for the trouble.",
        ]
    elif ctype == "dm":
        sugs = [
            f"Hey {first}! Love this idea 🙌 Yes, we're open to it — sending you our partnership one-pager now. What does your timeline look like?",
            f"Hi {first}, thanks for reaching out! Absolutely — could you share a few details (audience size, format, timeline) and we'll come back with options this week?",
        ]
    elif senti == "positive":
        sugs = [
            f"{first}, this made our day 🥹 Thank you for being part of the journey — more coming very soon!",
            f"Appreciate you, {first}! 🙌 Glad it's saving you time — watch this space, we're just getting started.",
        ]
    else:
        sugs = [
            f"Great question, {first}! Short answer: yes. Long answer: we're publishing a full walkthrough this week — want us to ping you when it's live?",
            f"Thanks for asking, {first} — happy to clarify! Here's how it works in practice… (and DM us if you'd like a hands-on demo).",
        ]
    with closing(db()) as conn:
        u = conn.execute("SELECT ai_credits_used, plan FROM users WHERE id=?", (user["id"],)).fetchone()
        limit = PLAN_LIMITS.get(u["plan"], 500)
        if u["ai_credits_used"] < limit:
            conn.execute("UPDATE users SET ai_credits_used = ai_credits_used + 2 WHERE id=?", (user["id"],))
            conn.commit()
    return {"suggestions": sugs, "credits_used": 2}

# ---- team

@app.get("/api/team")
async def list_team(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM team_members WHERE user_id=? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, joined_at",
                            (user["id"],)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/team")
async def invite_member(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    role = body.get("role") or "editor"
    if not name or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(400, "A name and valid email are required")
    if role not in ("admin", "editor", "viewer"):
        raise HTTPException(400, "Invalid role")
    with closing(db()) as conn:
        if conn.execute("SELECT 1 FROM team_members WHERE user_id=? AND email=?", (user["id"], email)).fetchone():
            raise HTTPException(409, "That person is already on the team")
        cur = conn.execute("INSERT INTO team_members (user_id, name, email, role, status, avatar_color, joined_at) VALUES (?,?,?,?,?,?,?)",
                           (user["id"], name, email, role, "invited",
                            random.choice(["#22d3ee", "#f472b6", "#34d399", "#fbbf24", "#60a5fa"]), now_iso()))
        row = conn.execute("SELECT * FROM team_members WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    log_activity(user["id"], "account", f"Invited {name} to the workspace as {role}")
    return dict(row)

@app.patch("/api/team/{id}")
async def update_member(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        row = own(conn, "team_members", id, user["id"])
        role = body.get("role", row["role"])
        status = body.get("status", row["status"])
        if role not in ("admin", "editor", "viewer"):
            raise HTTPException(400, "Invalid role")
        if status not in ("active", "invited", "deactivated"):
            raise HTTPException(400, "Invalid status")
        if status == "invited" and row["status"] == "invited":
            await asyncio.sleep(0.8)  # simulated resend
        conn.execute("UPDATE team_members SET role=?, status=? WHERE id=?", (role, status, id))
        conn.commit()
        row = conn.execute("SELECT * FROM team_members WHERE id=?", (id,)).fetchone()
    return dict(row)

@app.delete("/api/team/{id}")
async def remove_member(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "team_members", id, user["id"])
        conn.execute("DELETE FROM team_members WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# ---- media

@app.get("/api/media")
async def list_media(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM media WHERE user_id=? ORDER BY datetime(created_at) DESC", (user["id"],)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["tags"] = json.loads(d["tags"] or "[]")
        out.append(d)
    return out

@app.post("/api/media")
async def create_media(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    name = (body.get("name") or "").strip()
    data = body.get("data") or ""
    if not name:
        raise HTTPException(400, "Asset name is required")
    if len(data) > 2_800_000:
        raise HTTPException(400, "File too large — 2 MB max in this demo")
    kind = body.get("kind") or ("image" if data.startswith("data:image") else "image")
    with closing(db()) as conn:
        cur = conn.execute("INSERT INTO media (user_id, name, kind, tags, data, size, created_at) VALUES (?,?,?,?,?,?,?)",
                           (user["id"], name, kind, json.dumps(body.get("tags") or []), data,
                            body.get("size") or int(len(data) * 0.75), now_iso()))
        row = conn.execute("SELECT * FROM media WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    d = dict(row)
    d["tags"] = json.loads(d["tags"] or "[]")
    return d

@app.patch("/api/media/{id}")
async def update_media(id: int, request: Request, user=Depends(require_user)):
    body = await read_json(request)
    with closing(db()) as conn:
        row = own(conn, "media", id, user["id"])
        name = body.get("name", row["name"])
        tags = body.get("tags")
        tags_json = json.dumps(tags) if isinstance(tags, list) else row["tags"]
        conn.execute("UPDATE media SET name=?, tags=? WHERE id=?", (name, tags_json, id))
        conn.commit()
        row = conn.execute("SELECT * FROM media WHERE id=?", (id,)).fetchone()
    d = dict(row)
    d["tags"] = json.loads(d["tags"] or "[]")
    return d

@app.delete("/api/media/{id}")
async def delete_media(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "media", id, user["id"])
        conn.execute("DELETE FROM media WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# ---- billing

PLANS = {
    "Starter": {"price": 19, "credits": 60, "tagline": "For solo creators finding their voice"},
    "Pro": {"price": 49, "credits": 500, "tagline": "For growing teams shipping daily"},
    "Scale": {"price": 129, "credits": 2000, "tagline": "For brands running the full machine"},
}

@app.get("/api/billing")
async def billing(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        inv = [dict(r) for r in conn.execute("SELECT * FROM invoices WHERE user_id=? ORDER BY date DESC", (user["id"],))]
    return {"plan": user["plan"], "plans": PLANS, "invoices": inv,
            "credits": {"used": user["ai_credits_used"], "limit": PLAN_LIMITS.get(user["plan"], 500)}}

@app.post("/api/billing/switch")
async def switch_plan(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    plan = body.get("plan")
    if plan not in PLANS:
        raise HTTPException(400, "Unknown plan")
    if plan == user["plan"]:
        raise HTTPException(400, "You're already on that plan")
    await asyncio.sleep(0.9)  # simulated billing round-trip
    with closing(db()) as conn:
        conn.execute("UPDATE users SET plan=? WHERE id=?", (plan, user["id"]))
        num = f"INV-2026-{random.randint(1000, 9999)}"
        conn.execute("INSERT INTO invoices (user_id, number, description, amount, status, date) VALUES (?,?,?,?,?,?)",
                     (user["id"], num, f"Switch to {plan} plan — prorated", PLANS[plan]["price"], "paid", day_iso()))
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    log_activity(user["id"], "campaign", f"Workspace switched to the {plan} plan")
    return public_user(row)

# ---- competitors

@app.get("/api/competitors")
async def list_competitors(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM competitors WHERE user_id=? ORDER BY followers DESC", (user["id"],)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["series"] = json.loads(d["series"] or "[]")
        out.append(d)
    return out

@app.post("/api/competitors")
async def add_competitor(request: Request, user=Depends(require_user)):
    body = await read_json(request)
    name = (body.get("name") or "").strip()
    handle = (body.get("handle") or "").strip()
    platform = body.get("platform") or "instagram"
    if not name or not handle:
        raise HTTPException(400, "Competitor name and handle are required")
    await asyncio.sleep(1.2)  # simulated profile scan
    rng = random.Random()
    followers = rng.randint(9_000, 120_000)
    growth = round(rng.uniform(-4, 14), 1)
    engagement = round(rng.uniform(1.2, 8.5), 1)
    start = followers / (1 + growth / 100)
    series = []
    for i in range(30):
        frac = i / 29
        series.append(int((start + (followers - start) * frac) * rng.uniform(0.992, 1.008)))
    series[-1] = followers
    color = random.choice(["#f472b6", "#22d3ee", "#fbbf24", "#60a5fa", "#34d399"])
    with closing(db()) as conn:
        cur = conn.execute("""INSERT INTO competitors (user_id, name, handle, platform, followers, growth, engagement, color, series, created_at)
                              VALUES (?,?,?,?,?,?,?,?,?,?)""",
                           (user["id"], name, handle, platform, followers, growth, engagement, color, json.dumps(series), now_iso()))
        row = conn.execute("SELECT * FROM competitors WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    log_activity(user["id"], "campaign", f"Now tracking competitor {name}")
    d = dict(row)
    d["series"] = series
    return d

@app.delete("/api/competitors/{id}")
async def delete_competitor(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "competitors", id, user["id"])
        conn.execute("DELETE FROM competitors WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# ---- audience insights

CITIES = [
    ("New York", "United States"), ("London", "United Kingdom"), ("Los Angeles", "United States"),
    ("Berlin", "Germany"), ("Toronto", "Canada"), ("Sydney", "Australia"), ("Amsterdam", "Netherlands"),
    ("Singapore", "Singapore"), ("São Paulo", "Brazil"), ("Austin", "United States"),
]

@app.get("/api/audience")
async def audience(user=Depends(require_user)):
    await jitter(0.2, 0.5)
    uid = user["id"]
    with closing(db()) as conn:
        acc = conn.execute("SELECT COUNT(*) c FROM accounts WHERE user_id=? AND status='connected'", (uid,)).fetchone()["c"]
        followers = conn.execute("SELECT COALESCE(SUM(followers),0) f FROM accounts WHERE user_id=? AND status='connected'", (uid,)).fetchone()["f"]
    if acc == 0:
        return {"available": False}
    rng = random.Random(uid * 7919)
    age_raw = [rng.uniform(6, 14), rng.uniform(22, 34), rng.uniform(20, 30), rng.uniform(10, 18), rng.uniform(4, 9)]
    tot = sum(age_raw)
    age = [{"label": l, "pct": round(v / tot * 100, 1)} for l, v in zip(["13-17", "18-24", "25-34", "35-44", "45+"], age_raw)]
    women = rng.randint(38, 60)
    men = rng.randint(32, 94 - women)
    gender = [{"label": "Women", "pct": women, "color": "#f472b6"},
              {"label": "Men", "pct": men, "color": "#60a5fa"},
              {"label": "Other / undisclosed", "pct": 100 - women - men, "color": "#6b7284"}]
    pool = rng.sample(CITIES, 8)
    pcts = sorted([rng.uniform(4, 16) for _ in range(8)], reverse=True)
    scale = 62 / sum(pcts)
    locations = [{"city": c, "country": co, "pct": round(p * scale, 1)} for (c, co), p in zip(pool, pcts)]
    hours = []
    for dow in range(7):
        row = []
        for h in range(24):
            base = 12
            if 8 <= h <= 10: base += 34
            if 12 <= h <= 13: base += 22
            if 18 <= h <= 21: base += 46
            if h <= 5: base -= 8
            if dow >= 5 and 11 <= h <= 16: base += 18
            if dow >= 5 and (8 <= h <= 10): base -= 14
            row.append(max(2, min(100, int(base + rng.uniform(-9, 9)))))
        hours.append(row)
    best = sorted(((hours[d][h], d, h) for d in range(7) for h in range(24)), reverse=True)[:4]
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    best_times = [{"day": days[d], "time": f"{h:02d}:00", "score": v} for v, d, h in best]
    return {"available": True, "followers": followers, "age": age, "gender": gender,
            "locations": locations, "hours": hours, "best_times": best_times}

# ---- reports

@app.get("/api/reports")
async def list_reports(user=Depends(require_user)):
    await jitter(0.1, 0.3)
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM reports WHERE user_id=? ORDER BY period_end DESC", (user["id"],)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["stats"] = json.loads(d["stats"] or "{}")
        out.append(d)
    return out

@app.post("/api/reports/generate")
async def generate_report(user=Depends(require_user)):
    await asyncio.sleep(1.0)
    uid = user["id"]
    end = dt.date.today()
    start = end - dt.timedelta(days=6)
    with closing(db()) as conn:
        if conn.execute("SELECT 1 FROM reports WHERE user_id=? AND period_end=?", (uid, end.isoformat())).fetchone():
            raise HTTPException(409, "This week's report has already been generated")
        stats = compute_report_stats(conn, uid, start.isoformat(), end.isoformat())
        title = f"Weekly report — {start.strftime('%b')} {start.day} to {end.strftime('%b')} {end.day}"
        cur = conn.execute("INSERT INTO reports (user_id, title, period_start, period_end, stats, created_at) VALUES (?,?,?,?,?,?)",
                           (uid, title, start.isoformat(), end.isoformat(), json.dumps(stats), now_iso()))
        row = conn.execute("SELECT * FROM reports WHERE id=?", (cur.lastrowid,)).fetchone()
        conn.commit()
    log_activity(user["id"], "report", f"{title} generated")
    d = dict(row)
    d["stats"] = stats
    return d

@app.delete("/api/reports/{id}")
async def delete_report(id: int, user=Depends(require_user)):
    with closing(db()) as conn:
        own(conn, "reports", id, user["id"])
        conn.execute("DELETE FROM reports WHERE id=?", (id,))
        conn.commit()
    return {"ok": True}

# static SPA (keep last)
app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "static"), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, log_level="warning")
