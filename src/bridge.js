function createMultiBridge({ discord, mcBots }) {
  // channelId -> { cfg, mc }
  const byChannel = new Map();
  for (const entry of mcBots) byChannel.set(entry.cfg.channelId, entry);

  // MC -> Discord (chat + status)
  for (const { cfg, mc } of mcBots) {
    mc.onEvent(async (evt) => {
      if (evt.type === "chat") {
        await discord.sendToChannel(cfg.channelId, `🟩 ${evt.text}`);
      } else if (evt.type === "status") {
        await discord.sendToChannel(cfg.channelId, `**${evt.text}**`);
      }
    });
  }

  function fmtDuration(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  function fmtBotLine(entry) {
    const st = entry.mc.getStatus();
    const phase = st.phase;
    const up = st.upForMs ? ` | up ${fmtDuration(st.upForMs)}` : "";
    const next = st.nextRetryInMs ? ` | retry ${Math.round(st.nextRetryInMs / 1000)}s` : "";
    return `• **${entry.cfg.name || st.name}** — \`${phase}\`${up}${next}`;
  }

  // Discord -> MC
  discord.client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    const content = (msg.content || "").trim();
    if (!content.toLowerCase().startsWith("!mc")) return;

    const args = content.split(/\s+/);
    const sub = (args[1] || "").toLowerCase();

    // Global command: list bots (works in any channel)
    if (sub === "bots" || sub === "list") {
      const lines = mcBots.map(fmtBotLine);
      await msg.reply(`🤖 **MineCord Bots**\n${lines.join("\n")}`);
      return;
    }

    // Channel-specific commands require a mapped channel
    const entry = byChannel.get(msg.channelId);
    if (!entry) {
      await msg.reply("❌ This channel is not mapped to any Minecraft bot.");
      return;
    }

    if (sub === "status") {
      const st = entry.mc.getStatus();
      const up = st.upForMs ? fmtDuration(st.upForMs) : "0s";
      const kick = st.lastKick ? `\nLast kick: \`${st.lastKick}\`` : "";
      const err = st.lastError ? `\nLast error: \`${st.lastError}\`` : "";
      const retry =
        st.nextRetryInMs && st.phase !== "connected"
          ? `\nNext retry: **${Math.round(st.nextRetryInMs / 1000)}s**`
          : "";

      await msg.reply(
        `📊 **${entry.cfg.name || st.name}**\n` +
          `Phase: **${st.phase}**\n` +
          `Server: \`${st.host}:${st.port}\`\n` +
          `Uptime: **${up}**${retry}${kick}${err}`
      );
      return;
    }

    if (sub === "reconnect") {
      entry.mc.reconnectNow();
      await msg.reply("🔁 Reconnecting this Minecraft bot now...");
      return;
    }

    if (sub === "say") {
      const text = content.replace(/^!mc\s+say\s+/i, "").trim();
      if (!text) return;
      entry.mc.sendChat(text);
      await msg.reply("✅ Sent to Minecraft chat.");
      return;
    }

    if (sub === "cmd") {
      const cmd = content.replace(/^!mc\s+cmd\s+/i, "").trim();
      if (!cmd.startsWith("/")) {
        await msg.reply("❌ Commands must start with `/` (example: `!mc cmd /list`).");
        return;
      }
      entry.mc.sendChat(cmd);
      await msg.reply("✅ Command sent to Minecraft.");
      return;
    }

    await msg.reply(
      "Commands:\n" +
        "- `!mc say <text>`\n" +
        "- `!mc cmd /command`\n" +
        "- `!mc status`\n" +
        "- `!mc reconnect`\n" +
        "- `!mc bots`"
    );
  });
}

module.exports = { createMultiBridge };
