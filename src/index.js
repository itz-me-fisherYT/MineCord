require("dotenv").config();

const fs = require("fs");
const path = require("path");

const express = require("express");
const cors = require("cors");

const { startDiscord } = require("./discord");
const { startMinecraft } = require("./minecraft");
const { createMultiBridge } = require("./bridge");

/* =========================
   Helpers
========================= */

function mustGetEnv(key) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowMs() {
  return Date.now();
}

function loadBotsIfPresent() {
  const p = path.join(process.cwd(), "bots.json");
  if (!fs.existsSync(p)) return null;

  const raw = fs.readFileSync(p, "utf8");
  const json = JSON.parse(raw);

  if (!json?.bots?.length) {
    throw new Error("bots.json must contain { bots: [...] }");
  }

  return json.bots;
}

/* =========================
   Main
========================= */

async function main() {
  const token = mustGetEnv("DISCORD_TOKEN");
  const discord = await startDiscord({ token });

  const bots = loadBotsIfPresent();

  /* =========================
     Express panel
  ========================= */

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  /* =========================
     Per-bot console buffers + SSE
  ========================= */

  const LOG_MAX = Number(process.env.PANEL_LOG_MAX || 300);
  const consoleBuffers = new Map(); // botName -> [ {ts, level, text, bot} ]
  const logClients = new Set();

  function ensureBuf(bot) {
    const key = bot || "system";
    if (!consoleBuffers.has(key)) consoleBuffers.set(key, []);
    return consoleBuffers.get(key);
  }

  function toText(parts) {
    return parts
      .map((p) => {
        if (p instanceof Error) return p.stack || p.message;
        if (typeof p === "string") return p;
        try {
          return JSON.stringify(p);
        } catch {
          return String(p);
        }
      })
      .join(" ");
  }

  function pushLog(bot, level, parts) {
    const entry = {
      ts: Date.now(),
      level: level || "log",
      text: toText(parts),
      bot: bot || "system"
    };

    const buf = ensureBuf(entry.bot);
    buf.push(entry);
    while (buf.length > LOG_MAX) buf.shift();

    const payload = `event: log\ndata: ${JSON.stringify(entry)}\n\n`;
    for (const res of logClients) {
      try {
        res.write(payload);
      } catch {}
    }
  }

  // Patch console => goes to "system"
  const _log = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _error = console.error.bind(console);

  console.log = (...args) => {
    _log(...args);
    pushLog("system", "log", args);
  };
  console.warn = (...args) => {
    _warn(...args);
    pushLog("system", "warn", args);
  };
  console.error = (...args) => {
    _error(...args);
    pushLog("system", "error", args);
  };

  // SSE stream (init sends ALL buffers)
  app.get("/api/logs/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const buffers = {};
    for (const [bot, logs] of consoleBuffers.entries()) {
      buffers[bot] = logs;
    }

    res.write(`event: init\ndata: ${JSON.stringify({ buffers })}\n\n`);
    logClients.add(res);

    const ping = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {}
    }, 15000);

    req.on("close", () => {
      clearInterval(ping);
      logClients.delete(res);
    });
  });

  /* =========================
     Serve panel UI
  ========================= */

  const panelPublic = path.join(process.cwd(), "minecord-panel", "public");
  app.use("/", express.static(panelPublic));

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  /* =========================
     bots.json read/write
  ========================= */

  app.get("/api/bots", (req, res) => {
    try {
      const p = path.join(process.cwd(), "bots.json");
      res.json(JSON.parse(fs.readFileSync(p, "utf8")));
    } catch {
      res.json({});
    }
  });

  app.post("/api/bots", (req, res) => {
    try {
      const p = path.join(process.cwd(), "bots.json");
      fs.writeFileSync(p, JSON.stringify(req.body, null, 2) + "\n", "utf8");
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  const PORT = Number(process.env.PANEL_PORT || 3000);
  app.listen(PORT, () => {
    console.log(`[MineCord] Panel at http://localhost:${PORT}`);
    console.log(`[MineCord] Serving UI from: ${panelPublic}`);
  });

  /* =========================
     SINGLE MODE
  ========================= */

  if (!bots) {
    const channelId = mustGetEnv("DISCORD_CHANNEL_ID");

    const mc = startMinecraft({
      host: mustGetEnv("MC_HOST"),
      port: Number(process.env.MC_PORT || 25565),
      username: mustGetEnv("MC_USERNAME"),
      auth: process.env.MC_AUTH || "microsoft",
      version: process.env.MC_VERSION,
      name: "default",
      autoConnect: true
    });

    mc.onEvent((evt) => {
      if (evt.type === "chat") pushLog("default", "chat", [evt.text]);
      if (evt.type === "status") pushLog("default", "status", [evt.text]);
      if (evt.type === "state") pushLog("default", "log", [`phase: ${evt.phase}`]);
    });

    createMultiBridge({
      discord,
      mcBots: [{ cfg: { name: "default", channelId }, mc }]
    });

    app.get("/api/status", (req, res) => {
      res.json({
        default: {
          running: mc.isRunning(),
          mc: mc.getStatus()
        }
      });
    });

    app.post("/api/start/:name", (req, res) => {
      mc.start();
      pushLog("default", "log", ["Manual start"]);
      res.json({ ok: true });
    });

    app.post("/api/stop/:name", (req, res) => {
      mc.stop();
      pushLog("default", "log", ["Manual stop"]);
      res.json({ ok: true });
    });

    console.log("[MineCord] Started (single mode).");
    return;
  }

  /* =========================
     MULTI MODE
  ========================= */

  const cfgByName = new Map();
  for (const cfg of bots) {
    const name = String(cfg?.name || "").trim();
    if (!name) throw new Error("Every bot must have a non-empty name");
    cfgByName.set(name, cfg);
  }

  const mcByName = new Map();
  const lastManualActionAt = new Map();

  const baseDelayMs = Number(process.env.BOT_START_DELAY_MS || 15000);
  const jitterMs = Number(process.env.BOT_START_JITTER_MS || 3000);
  const manualCooldownMs = Number(process.env.BOT_MANUAL_COOLDOWN_MS || 15000);

  function canManualAction(name) {
    const last = lastManualActionAt.get(name) || 0;
    return nowMs() - last >= manualCooldownMs;
  }

  function markManualAction(name) {
    lastManualActionAt.set(name, nowMs());
  }

  function ensureInstance(name) {
    if (mcByName.has(name)) return mcByName.get(name);

    const cfg = cfgByName.get(name);
    if (!cfg) return null;

    const mc = startMinecraft({
      name: cfg.name,
      host: cfg.host,
      port: Number(cfg.port || 25565),
      username: cfg.username,
      auth: cfg.auth || "microsoft",
      version: cfg.version,
      autoConnect: false
    });

    // Hook MC events into per-bot console
    mc.onEvent((evt) => {
      if (evt.type === "chat") pushLog(name, "chat", [evt.text]);
      if (evt.type === "status") pushLog(name, "status", [evt.text]);
      if (evt.type === "state") pushLog(name, "log", [`phase: ${evt.phase}`]);
    });

    const entry = { cfg, mc };
    mcByName.set(name, entry);

    // create buffer early so tabs exist immediately
    ensureBuf(name);

    return entry;
  }

  async function startBot(name, { stagger = false } = {}) {
    const entry = ensureInstance(name);
    if (!entry) return { ok: false, error: `Unknown bot: ${name}` };

    if (!canManualAction(name)) {
      return { ok: false, error: `Cooldown active for ${name}` };
    }
    markManualAction(name);

    if (stagger) {
      const wait = baseDelayMs + Math.floor(Math.random() * jitterMs);
      pushLog(name, "log", [`Waiting ${Math.round(wait / 1000)}s before start...`]);
      await sleep(wait);
    }

    entry.mc.start();
    pushLog(name, "log", ["Start requested"]);
    return { ok: true };
  }

  function stopBot(name) {
    const entry = mcByName.get(name) || ensureInstance(name);
    if (!entry) return { ok: false, error: `Unknown bot: ${name}` };

    markManualAction(name);
    entry.mc.stop();
    pushLog(name, "log", ["Stop requested"]);
    return { ok: true };
  }

  function statusAll() {
    const out = {};
    for (const [name, cfg] of cfgByName.entries()) {
      const entry = mcByName.get(name);
      out[name] = {
        ...cfg,
        running: entry ? entry.mc.isRunning() : false,
        mc: entry ? entry.mc.getStatus() : { name, phase: "idle" }
      };
    }
    return out;
  }

  console.log(`[MineCord] Loaded ${cfgByName.size} bot(s) from bots.json`);
  const names = Array.from(cfgByName.keys());

  // Create instances on boot; optionally auto-start if enabled !== false
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const cfg = cfgByName.get(name);

    ensureInstance(name);

    const enabled = cfg.enabled !== false; // default true
    if (!enabled) {
      pushLog(name, "warn", ["Disabled on boot"]);
      continue;
    }

    pushLog(name, "log", ["Boot starting"]);
    await startBot(name, { stagger: i !== 0 });
  }

  createMultiBridge({
    discord,
    mcBots: Array.from(mcByName.values())
  });

  console.log(`[MineCord] Multi mode ready. Use panel to Join / Leave bots.`);

  app.get("/api/status", (req, res) => res.json(statusAll()));

  app.post("/api/start/:name", async (req, res) => {
    const name = String(req.params.name || "").trim();
    res.json(await startBot(name, { stagger: false }));
  });

  app.post("/api/stop/:name", (req, res) => {
    const name = String(req.params.name || "").trim();
    res.json(stopBot(name));
  });
}

main().catch((err) => {
  console.error("[MineCord] Fatal error:", err);
  process.exit(1);
});
