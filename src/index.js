require("dotenv").config();

const fs = require("fs");
const path = require("path");

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

async function main() {
  const token = mustGetEnv("DISCORD_TOKEN");

  const discord = await startDiscord({ token });

  const bots = loadBotsIfPresent();

  // ===============================
  // ✅ MULTI MODE (bots.json exists)
  // ===============================
  if (bots) {
    const mcBots = [];

    // You can tune these in .env if you want
    const baseDelayMs = Number(process.env.BOT_START_DELAY_MS || 15000); // 15 sec default
    const jitterMs = Number(process.env.BOT_START_JITTER_MS || 3000);    // + up to 3 sec random

    console.log(`[MineCord] Starting ${bots.length} bot(s) with staggered login...`);

    for (let i = 0; i < bots.length; i++) {
      const cfg = bots[i];

      console.log(`[MineCord] Starting bot ${i + 1}/${bots.length}: ${cfg.name || cfg.username}`);

      const mc = startMinecraft({
        name: cfg.name,
        host: cfg.host,
        port: Number(cfg.port || 25565),
        username: cfg.username,
        auth: cfg.auth || "microsoft",
        version: cfg.version
      });

      mcBots.push({ cfg, mc });

      // Wait before starting next bot (prevents auth rate limit)
      if (i < bots.length - 1) {
        const wait = baseDelayMs + Math.floor(Math.random() * jitterMs);
        console.log(`[MineCord] Waiting ${Math.round(wait / 1000)}s before next bot...`);
        await sleep(wait);
      }
    }

    createMultiBridge({ discord, mcBots });

    console.log(`[MineCord] Started ${mcBots.length} bot(s) (multi mode).`);
    return;
  }

  // ===============================
  // ✅ SINGLE MODE (fallback to .env)
  // ===============================
  const channelId = mustGetEnv("DISCORD_CHANNEL_ID");

  const mc = startMinecraft({
    host: mustGetEnv("MC_HOST"),
    port: Number(process.env.MC_PORT || 25565),
    username: mustGetEnv("MC_USERNAME"),
    auth: process.env.MC_AUTH || "microsoft",
    version: process.env.MC_VERSION
  });

  createMultiBridge({
    discord,
    mcBots: [{ cfg: { name: "default", channelId }, mc }]
  });

  console.log("[MineCord] Started (single mode).");
}

main().catch((err) => {
  console.error("[MineCord] Fatal error:", err);
  process.exit(1);
});
