function createBridge({ discord, mc }) {
  // Relay Minecraft -> Discord
  mc.onEvent(async (evt) => {
    if (evt.type === "chat") {
      // You can add filters here later
      await discord.sendToChannel(`🟩 ${evt.text}`);
    } else if (evt.type === "status") {
      await discord.sendToChannel(`**${evt.text}**`);
    }
  });

  // Relay Discord -> Minecraft (prefix commands)
  discord.client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;
    if (msg.channelId !== discord.channelId) return;

    const content = msg.content.trim();

    // Commands:
    // !mc say hello
    // !mc cmd /list
    if (!content.toLowerCase().startsWith("!mc ")) return;

    const rest = content.slice(4).trim();

    if (rest.toLowerCase().startsWith("say ")) {
      const text = rest.slice(4).trim();
      if (!text) return;
      mc.sendChat(text);
      await msg.reply("✅ Sent to Minecraft chat.");
      return;
    }

    if (rest.toLowerCase().startsWith("cmd ")) {
      const cmd = rest.slice(4).trim();
      if (!cmd.startsWith("/")) {
        await msg.reply("❌ Commands must start with `/` (example: `!mc cmd /list`).");
        return;
      }
      // WARNING: you should restrict this to admin roles later.
      mc.sendChat(cmd);
      await msg.reply("✅ Command sent to Minecraft.");
      return;
    }

    await msg.reply("Commands:\n- `!mc say <text>`\n- `!mc cmd /command`");
  });
}

module.exports = { createBridge };
