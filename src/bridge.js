function createMultiBridge({ discord, mcBots }) {
  // channelId -> { cfg, mc }
  const byChannel = new Map();
  for (const entry of mcBots) byChannel.set(entry.cfg.channelId, entry);

  // MC -> Discord
  for (const { cfg, mc } of mcBots) {
    mc.onEvent(async (evt) => {
      if (evt.type === "chat") {
        await discord.sendToChannel(cfg.channelId, `🟩 ${evt.text}`);
      } else if (evt.type === "status") {
        await discord.sendToChannel(cfg.channelId, `**${evt.text}**`);
      }
    });
  }

  // Discord -> MC (only if message is in a mapped channel)
  discord.client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    const entry = byChannel.get(msg.channelId);
    if (!entry) return; // ignore other channels

    const content = (msg.content || "").trim();
    if (!content.toLowerCase().startsWith("!mc ")) return;

    const rest = content.slice(4).trim();

    if (rest.toLowerCase().startsWith("say ")) {
      const text = rest.slice(4).trim();
      if (!text) return;
      entry.mc.sendChat(text);
      await msg.reply("✅ Sent to Minecraft chat.");
      return;
    }

    if (rest.toLowerCase().startsWith("cmd ")) {
      const cmd = rest.slice(4).trim();
      if (!cmd.startsWith("/")) {
        await msg.reply("❌ Commands must start with `/` (example: `!mc cmd /list`).");
        return;
      }
      entry.mc.sendChat(cmd);
      await msg.reply("✅ Command sent to Minecraft.");
      return;
    }

    await msg.reply("Commands:\n- `!mc say <text>`\n- `!mc cmd /command`");
  });
}

module.exports = { createMultiBridge };
