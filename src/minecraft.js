const mineflayer = require("mineflayer");

function startMinecraft({ host, port, username, auth }) {
  let bot = null;
  let stopping = false;

  const listeners = new Set();

  function connect() {
    const forcedVersion = (process.env.MC_VERSION || "").trim();

    console.log(
      `[MC] Connecting to ${host}:${port} as ${username} (${auth})...` +
        (forcedVersion ? ` [version=${forcedVersion}]` : "")
    );

    bot = mineflayer.createBot({
      host,
      port,
      username,
      auth,
      ...(forcedVersion ? { version: forcedVersion } : {})
    });

    bot.once("spawn", () => {
      console.log("[MC] Spawned in!");
      emit({ type: "status", text: "✅ Connected to Minecraft." });
    });

    // Optional but helpful: satisfy servers that require a resource-pack status response.
    bot.on("resourcePack", (url, hash) => {
      console.log("[MC] Resource pack requested:", url);
      try {
        if (bot?._client?.write && hash) {
          bot._client.write("resource_pack_status", { result: 3, hash }); // accepted
          setTimeout(() => {
            try {
              if (!bot || bot._ended) return;
              bot._client.write("resource_pack_status", { result: 0, hash }); // successfully loaded
              emit({ type: "status", text: "📦 Resource pack handshake completed." });
            } catch {}
          }, 500);
        } else if (typeof bot.acceptResourcePack === "function") {
          bot.acceptResourcePack();
          emit({ type: "status", text: "📦 Accepted server resource pack." });
        }
      } catch (e) {
        console.error("[MC] Resource pack handling failed:", e);
      }
    });

    // Keep prefixes + system messages (no duplicates because we do NOT use bot.on('chat'))
    bot.on("messagestr", (message) => {
      emit({ type: "chat", text: message });
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
    retryMs = Math.min(Math.floor(retryMs * 1.5), 30000);
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

  return { onEvent, sendChat, stop };
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
