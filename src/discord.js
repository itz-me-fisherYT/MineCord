const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");

async function startDiscord({ token }) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
  });

  // Works in v14 and future versions without double-firing
  client.once(Events.ClientReady ?? "ready", () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);
  });

  await client.login(token);

  async function sendToChannel(channelId, text) {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch) return;

    const chunks = splitIntoChunks(String(text), 1800);
    for (const c of chunks) await ch.send(c);
  }

  return { client, sendToChannel };
}

function splitIntoChunks(text, maxLen) {
  const out = [];
  let s = text;
  while (s.length > maxLen) {
    out.push(s.slice(0, maxLen));
    s = s.slice(maxLen);
  }
  if (s.length) out.push(s);
  return out;
}

module.exports = { startDiscord };
