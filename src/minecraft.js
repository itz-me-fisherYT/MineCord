const mineflayer = require("mineflayer");

function startMinecraft({ host, port, username, auth, version, name }) {
  let bot = null;
  let stopping = false;
  let retryTimer = null;

  // Status state
  const state = {
    name: name || "bot",
    host,
    port,
    username,
    auth,
    version: version || "",
    phase: "idle", // idle | connecting | connected | disconnected | stopped
    connectedAt: null,
    lastDisconnectAt: null,
    lastKick: null,
    lastError: null,
    reconnects: 0,
    nextRetryInMs: 0
  };

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

  function label() {
    return state.name ? `[${state.name}]` : "";
  }

  function setPhase(phase) {
    state.phase = phase;
    emit({ type: "state", phase });
  }

  function clearRetry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function connect() {
    clearRetry();
    if (stopping) return;

    state.lastKick = null;
    state.lastError = null;
    state.nextRetryInMs = 0;

    const forcedVersion = (version || "").trim();
    setPhase("connecting");

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
      state.connectedAt = Date.now();
      setPhase("connected");
      console.log(`[MC] ${label()} Spawned in!`);
      emit({ type: "status", text: `[MC] ${label()} Connected to ${host}:${port}` });
    });

    // Keep prefixes/system messages
    bot.on("messagestr", (message) => {
      emit({ type: "chat", text: message });
    });

    // Resource pack handshake (safe)
    bot.on("resourcePack", (url, hash) => {
      console.log(`[MC] ${label()} Resource pack requested: ${url}`);
      try {
        if (bot?._client?.write && hash) {
          bot._client.write("resource_pack_status", { result: 3, hash }); // accepted
          setTimeout(() => {
            try {
              if (!bot || bot._ended) return;
              bot._client.write("resource_pack_status", { result: 0, hash }); // loaded
            } catch {}
          }, 500);
        } else if (typeof bot.acceptResourcePack === "function") {
          bot.acceptResourcePack();
        }
      } catch (e) {
        console.error(`[MC] ${label()} Resource pack handling failed:`, e);
      }
    });

    bot.on("kicked", (reason) => {
      state.lastKick = stringify(reason);
      console.error(`[MC] ${label()} Kicked:`, reason);
      emit({ type: "status", text: `❌ Kicked: ${state.lastKick}` });
    });

    bot.on("error", (err) => {
      state.lastError = err?.message || String(err);
      console.error(`[MC] ${label()} Error:`, err);
    });

    bot.on("end", () => {
      state.lastDisconnectAt = Date.now();
      if (!stopping) setPhase("disconnected");
      console.warn(`[MC] ${label()} Disconnected.`);
      emit({ type: "status", text: "⚠️ Disconnected." });

      if (!stopping) scheduleReconnect();
    });
  }

  // Reconnect manager (per bot)
  let retryMs = 2000;
  function scheduleReconnect() {
    clearRetry();
    const wait = retryMs;
    retryMs = Math.min(Math.floor(retryMs * 1.5), 30000);

    state.reconnects += 1;
    state.nextRetryInMs = wait;

    console.log(`[MC] ${label()} Reconnecting in ${Math.round(wait / 1000)}s...`);
    emit({ type: "status", text: `🔁 Reconnecting in ${Math.round(wait / 1000)}s...` });

    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!stopping) connect();
    }, wait);
  }

  function sendChat(text) {
    if (!bot || !bot.chat) return false;
    bot.chat(text);
    return true;
  }

  function stop() {
    stopping = true;
    clearRetry();
    setPhase("stopped");
    try {
      bot?.quit();
    } catch {}
  }

  // Manual controls
  function reconnectNow() {
    stopping = false;
    clearRetry();
    try {
      bot?.quit();
    } catch {}
    connect();
  }

  function getStatus() {
    const now = Date.now();
    const upFor =
      state.phase === "connected" && state.connectedAt
        ? Math.max(0, now - state.connectedAt)
        : 0;

    return {
      ...state,
      upForMs: upFor
    };
  }

  function onEvent(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  connect();

  return {
    onEvent,
    sendChat,
    stop,
    reconnectNow,
    getStatus
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
