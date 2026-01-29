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

async function main() {
  const token = mustGetEnv("DISCORD_TOKEN");

  const discord = await startDiscord({ token });

  const bots = loadBotsIfPresent();

  // ✅ MULTI MODE (bots.json exists)
  if (bots) {
    const mcBots = bots.map((cfg) => {
      const mc = startMinecraft({
        name: cfg.name,
        host: cfg.host,
        port: Number(cfg.port || 25565),
        username: cfg.username,
        auth: cfg.auth || "microsoft",
        version: cfg.version
      });

      return { cfg, mc };
    });

    createMultiBridge({ discord, mcBots });
    console.log(`[MineCord] Started ${mcBots.length} bot(s) (multi mode).`);
    return;
  }

  // ✅ SINGLE MODE (fallback to .env)
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
