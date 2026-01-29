const { Client, GatewayIntentBits, Partials } = require("discord.js");

async function startDiscord({ token, channelId }) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  const onReady = async () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);
    try {
      const ch = await client.channels.fetch(channelId);
      if (!ch) throw new Error("Channel not found.");
      console.log(`[Discord] Bound to channel: ${ch.id}`);
      await ch.send("✅ MineCord is online.");
    } catch (e) {
      console.error("[Discord] Failed to fetch/start channel:", e);
    }
  };

  // Support both discord.js v14 and v15 event names
  client.once("ready", onReady);
  client.once("clientReady", onReady);

  await client.login(token);

  return {
    client,
    channelId,
    async sendToChannel(text) {
      const ch = await client.channels.fetch(channelId);
      if (!ch) return;

      const chunks = splitIntoChunks(String(text), 1800);
      for (const c of chunks) await ch.send(c);
    }
  };
}

function splitIntoChunks(text, maxLen) {
  const out = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    out.push(remaining.slice(0, maxLen));
    remaining = remaining.slice(maxLen);
  }
  if (remaining.length) out.push(remaining);
  return out;
}

module.exports = { startDiscord };
