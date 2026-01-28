const mineflayer = require("mineflayer");

function startMinecraft({ host, port, username, auth }) {
  let bot = null;
  let stopping = false;

  const listeners = new Set();

  function connect() {
    console.log(`[MC] Connecting to ${host}:${port} as ${username} (${auth})...`);

    bot = mineflayer.createBot({
      host,
      port,
      username,
      auth
    });

    bot.once("spawn", () => {
      console.log("[MC] Spawned in!");
      emit({ type: "status", text: "✅ Connected to Minecraft." });
    });

    // Catch most server text (including plugin/system lines)
    bot.on("messagestr", (message) => {
      emit({ type: "chat", text: message });
    });

    // Optional: player chat event (not always enough on plugin-heavy servers)
    bot.on("chat", (username, message) => {
      emit({ type: "chat", text: `<${username}> ${message}` });
    });

    bot.on("kicked", (reason) => {
      console.error("[MC] Kicked:", reason);
      emit({ type: "status", text: `❌ Kicked from Minecraft: ${stringify(reason)}` });
    });

    bot.on("end", () => {
      console.warn("[MC] Disconnected.");
      emit({ type: "status", text: "⚠️ Disconnected from Minecraft." });
      if (!stopping) reconnectWithBackoff();
    });

    bot.on("error", (err) => {
      console.error("[MC] Error:", err);
    });
  }

  let retryMs = 2000;
  function reconnectWithBackoff() {
    const wait = retryMs;
    retryMs = Math.min(retryMs * 1.5, 30000);
    console.log(`[MC] Reconnecting in ${Math.round(wait / 1000)}s...`);
    setTimeout(() => {
      if (!stopping) connect();
    }, wait);
  }

  function emit(evt) {
    for (const fn of listeners) {
      try {
        fn(evt);
      } catch (e) {
        console.error("[MC] Listener error:", e);
      }
    }
  }

  function onEvent(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function sendChat(text) {
    if (!bot || !bot.chat) return false;
    bot.chat(text);
    return true;
  }

  function stop() {
    stopping = true;
    try {
      bot?.quit();
    } catch {}
  }

  connect();

  return {
    onEvent,
    sendChat,
    stop
  };
}

function stringify(x) {
  try {
    if (typeof x === "string") return x;
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

module.exports = { startMinecraft };
