function createMultiBridge({ discord, mcBots }) {
  // channelId -> { cfg, mc }
  const byChannel = new Map();
  for (const entry of mcBots) byChannel.set(String(entry.cfg.channelId), entry);

  // botName -> { cfg, mc }
  const byName = new Map();
  for (const entry of mcBots) byName.set(String(entry.cfg.name), entry);

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

  function getMappedEntry(msg) {
    const direct = byChannel.get(String(msg.channelId));
    if (direct) return direct;

    // Thread support
    const parentId = msg.channel?.isThread?.() ? msg.channel.parentId : null;
    if (parentId) {
      const viaParent = byChannel.get(String(parentId));
      if (viaParent) return viaParent;
    }
    return null;
  }

  function parseAfterSub(content, sub) {
    const re = new RegExp(`^!mc\\s+${sub}\\s+`, "i");
    return content.replace(re, "").trim();
  }

  function splitFirstWord(s) {
    const t = String(s || "").trim();
    if (!t) return { first: "", rest: "" };
    const parts = t.split(/\s+/);
    const first = parts.shift() || "";
    const rest = parts.join(" ").trim();
    return { first, rest };
  }

  async function sendToEntry(entry, text) {
    const r = entry.mc.sendChat(text);
    if (typeof r === "boolean") return { ok: r, queued: false, error: r ? "" : "Bot not connected" };
    if (r && typeof r === "object") return r;
    return { ok: false, queued: false, error: "Send failed" };
  }

  // Discord -> MC
  discord.client.on("messageCreate", async (msg) => {
    if (!msg || msg.author?.bot) return;

    const content = (msg.content || "").trim();
    if (!content.toLowerCase().startsWith("!mc")) return;

    const args = content.split(/\s+/);
    const sub = (args[1] || "").toLowerCase();

    // Global list
    if (sub === "bots" || sub === "list") {
      const lines = mcBots.map(fmtBotLine);
      await msg.reply(`🤖 **MineCord Bots**\n${lines.join("\n")}`);
      return;
    }

    const channelEntry = getMappedEntry(msg);

    if (sub === "status") {
      if (!channelEntry) {
        await msg.reply("❌ This channel is not mapped to any Minecraft bot.");
        return;
      }

      const st = channelEntry.mc.getStatus();
      const up = st.upForMs ? fmtDuration(st.upForMs) : "0s";
      const kick = st.lastKick ? `\nLast kick: \`${st.lastKick}\`` : "";
      const err = st.lastError ? `\nLast error: \`${st.lastError}\`` : "";
      const retry =
        st.nextRetryInMs && st.phase !== "connected"
          ? `\nNext retry: **${Math.round(st.nextRetryInMs / 1000)}s**`
          : "";

      await msg.reply(
        `📊 **${channelEntry.cfg.name || st.name}**\n` +
          `Phase: **${st.phase}**\n` +
          `Server: \`${st.host}:${st.port}\`\n` +
          `Uptime: **${up}**${retry}${kick}${err}`
      );
      return;
    }

    if (sub === "reconnect") {
      if (!channelEntry) {
        await msg.reply("❌ This channel is not mapped to any Minecraft bot.");
        return;
      }
      channelEntry.mc.reconnectNow();
      await msg.reply("🔁 Reconnecting this Minecraft bot now...");
      return;
    }

    // SAY (channel bot OR named bot)
    if (sub === "say") {
      const raw = parseAfterSub(content, "say");
      if (!raw) {
        await msg.reply("Usage: `!mc say <text>` OR `!mc say <botName> <text>`");
        return;
      }

      const { first, rest } = splitFirstWord(raw);
      const named = byName.get(first);
      const targetEntry = named || channelEntry;
      const text = named ? rest : raw;

      if (!targetEntry) {
        await msg.reply("❌ This channel is not mapped to any Minecraft bot.");
        return;
      }
      if (!text) {
        await msg.reply("Usage: `!mc say <text>` OR `!mc say <botName> <text>`");
        return;
      }

      const r = await sendToEntry(targetEntry, text);
      if (!r.ok) {
        await msg.reply(`❌ Send failed: ${r.error || "failed"}`);
        return;
      }

      if (r.queued) {
        await msg.reply(`🕓 Queued for **${targetEntry.cfg.name}** (bot not fully ready yet).`);
      } else {
        await msg.reply(`✅ Sent to **${targetEntry.cfg.name}**.`);
      }
      return;
    }

    // CMD (channel bot OR named bot)
    if (sub === "cmd") {
      const raw = parseAfterSub(content, "cmd");
      if (!raw) {
        await msg.reply("Usage: `!mc cmd /command` OR `!mc cmd <botName> /command`");
        return;
      }

      const { first, rest } = splitFirstWord(raw);
      const named = byName.get(first);
      const targetEntry = named || channelEntry;
      const cmd = named ? rest : raw;

      if (!targetEntry) {
        await msg.reply("❌ This channel is not mapped to any Minecraft bot.");
        return;
      }
      if (!cmd) {
        await msg.reply("Usage: `!mc cmd /command` OR `!mc cmd <botName> /command`");
        return;
      }
      if (!cmd.startsWith("/")) {
        await msg.reply("❌ Commands must start with `/` (example: `!mc cmd /list`).");
        return;
      }

      const r = await sendToEntry(targetEntry, cmd);
      if (!r.ok) {
        await msg.reply(`❌ Command failed: ${r.error || "failed"}`);
        return;
      }

      if (r.queued) {
        await msg.reply(`🕓 Queued for **${targetEntry.cfg.name}** (bot not fully ready yet).`);
      } else {
        await msg.reply(`✅ Command sent to **${targetEntry.cfg.name}**.`);
      }
      return;
    }

    await msg.reply(
      "Commands:\n" +
        "- `!mc say <text>`\n" +
        "- `!mc say <botName> <text>`\n" +
        "- `!mc cmd /command`\n" +
        "- `!mc cmd <botName> /command`\n" +
        "- `!mc status`\n" +
        "- `!mc reconnect`\n" +
        "- `!mc bots`"
    );
  });
}

module.exports = { createMultiBridge };
