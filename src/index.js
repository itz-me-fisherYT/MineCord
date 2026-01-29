require("dotenv").config();

const { startDiscord } = require("./discord");
const { startMinecraft } = require("./minecraft");
const { createBridge } = require("./bridge");

function mustGetEnv(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

async function main() {
  // Validate required config
  mustGetEnv("DISCORD_TOKEN");
  mustGetEnv("DISCORD_CHANNEL_ID");
  mustGetEnv("MC_HOST");
  mustGetEnv("MC_USERNAME");

  const mc = startMinecraft({
    host: process.env.MC_HOST,
    port: Number(process.env.MC_PORT || 25565),
    username: process.env.MC_USERNAME,
    auth: process.env.MC_AUTH || "microsoft"
  });

  const discord = await startDiscord({
    token: process.env.DISCORD_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID
  });

  createBridge({ discord, mc });

  console.log("[MineCord] Started.");
}

main().catch((err) => {
  console.error("[MineCord] Fatal error:", err);
  process.exit(1);
});
