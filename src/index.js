require("dotenv").config();

const fs = require("fs");
const path = require("path");

const express = require("express");
const cors = require("cors");

const { startDiscord } = require("./discord");
const { startMinecraft } = require("./minecraft");
const { createMultiBridge } = require("./bridge");

function mustGetEnv(key) {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function loadBotsIfPresent() {
  const p = path.join(process.cwd(), "bots.json");
  if (!fs.existsSync(p)) return null;

  const raw = fs.readFileSync(p, "utf8");
  const json = JSON.parse(raw);

  if (!json?.bots?.length) throw new Error("bots.json must contain { bots: [...] }");
  return json.bots;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowMs() {
  return Date.now();
}

async function main() {
  const token = mustGetEnv("DISCORD_TOKEN");
  const discord = await startDiscord({ token });

  const bots = loadBotsIfPresent();

  // ---- Web panel (same process) ----
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const panelPublic = path.join(process.cwd(), "minecord-panel", "public");
  app.use("/", express.static(panelPublic));

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.get("/api/bots", (req, res) => {
    try {
      const p = path.join(process.cwd(), "bots.json");
      const raw = fs.readFileSync(p, "utf8");
      res.json(JSON.parse(raw));
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

  // ---- SINGLE MODE ----
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

    createMultiBridge({
      discord,
      mcBots: [{ cfg: { name: "default", channelId }, mc }]
    });

    // Simple status for single mode
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
      res.json({ ok: true });
    });

    app.post("/api/stop/:name", (req, res) => {
      mc.stop();
      res.json({ ok: true });
    });

    console.log("[MineCord] Started (single mode).");
    return;
  }

  // ---- MULTI MODE (per-bot control) ----
  const cfgByName = new Map();
  for (const cfg of bots) {
    const name = String(cfg?.name || "").trim();
    if (!name) throw new Error("Every bot in bots.json must have a non-empty 'name'");
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
    const existing = mcByName.get(name);
    if (existing) return existing;

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

    const entry = { cfg, mc };
    mcByName.set(name, entry);
    return entry;
  }

  async function startBot(name, { stagger = false } = {}) {
    const entry = ensureInstance(name);
    if (!entry) return { ok: false, error: `Unknown bot: ${name}` };

    if (!canManualAction(name)) {
      return { ok: false, error: `Cooldown: wait a bit before starting ${name} again.` };
    }
    markManualAction(name);

    if (stagger) {
      const wait = baseDelayMs + Math.floor(Math.random() * jitterMs);
      console.log(`[MineCord] Waiting ${Math.round(wait / 1000)}s before starting ${name}...`);
      await sleep(wait);
    }

    entry.mc.start();
    return { ok: true };
  }

  function stopBot(name) {
    const entry = mcByName.get(name) || ensureInstance(name);
    if (!entry) return { ok: false, error: `Unknown bot: ${name}` };

    markManualAction(name);
    entry.mc.stop();
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

  // Boot behavior: start bots unless enabled === false
  console.log(`[MineCord] Loaded ${cfgByName.size} bot(s) from bots.json.`);
  const names = Array.from(cfgByName.keys());

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const cfg = cfgByName.get(name);

    const enabled = cfg.enabled !== false; // default true
    ensureInstance(name); // create but do not connect yet

    if (!enabled) {
      console.log(`[MineCord] Bot disabled on boot: ${name}`);
      continue;
    }

    console.log(`[MineCord] Boot starting: ${name}`);
    await startBot(name, { stagger: i !== 0 });
  }

  // Bridge uses the instances
  createMultiBridge({
    discord,
    mcBots: Array.from(mcByName.values())
  });

  console.log(`[MineCord] Multi mode ready. Use the panel to Join/Leave bots individually.`);

  // Panel endpoints
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
