const mineflayer = require("mineflayer");

function startMinecraft({ host, port, username, auth, version, name }) {
  let bot = null;
  let stopping = false;

  const listeners = new Set();

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

  let retryMs = 2000;
  function reconnectWithBackoff() {
    const wait = retryMs;
    retryMs = Math.min(Math.floor(retryMs * 1.5), 30000);
    console.log(`[MC] ${label()} Reconnecting in ${Math.round(wait / 1000)}s...`);
    setTimeout(() => {
      if (!stopping) connect();
    }, wait);
  }

  function label() {
    return name ? `[${name}]` : "";
  }

  function connect() {
    const forcedVersion = (version || "").trim();

    console.log(
      `[MC] ${label()} Connecting to ${host}:${port} as ${username} (${auth})...` +
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
      console.log(`[MC] ${label()} Spawned in!`);
      emit({ type: "status", text: "✅ Connected to Minecraft." });
    });

    // Resource pack handshake (safe for most servers)
    bot.on("resourcePack", (url, hash) => {
      console.log(`[MC] ${label()} Resource pack requested: ${url}`);
      try {
        if (bot?._client?.write && hash) {
          bot._client.write("resource_pack_status", { result: 3, hash }); // accepted
          setTimeout(() => {
            try {
              if (!bot || bot._ended) return;
              bot._client.write("resource_pack_status", { result: 0, hash }); // successfully loaded
            } catch {}
          }, 500);
        } else if (typeof bot.acceptResourcePack === "function") {
          bot.acceptResourcePack();
        }
      } catch (e) {
        console.error(`[MC] ${label()} Resource pack handling failed:`, e);
      }
    });

    // ✅ Use messagestr so you keep prefixes/system messages
    bot.on("messagestr", (message) => {
      emit({ type: "chat", text: message });
    });

    bot.on("kicked", (reason) => {
      console.error(`[MC] ${label()} Kicked:`, reason);
      emit({ type: "status", text: `❌ Kicked: ${stringify(reason)}` });
    });

    bot.on("end", () => {
      console.warn(`[MC] ${label()} Disconnected.`);
      emit({ type: "status", text: "⚠️ Disconnected." });
      if (!stopping) reconnectWithBackoff();
    });

    bot.on("error", (err) => {
      console.error(`[MC] ${label()} Error:`, err);
    });
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
