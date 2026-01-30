const mineflayer = require("mineflayer");

function startMinecraft({ host, port, username, auth, version, name, autoConnect = true }) {
  let bot = null;
  let stopping = false;
  let retryTimer = null;

  const outQueue = [];
  let flushTimer = null;

  const state = {
    name: name || "bot",
    host,
    port,
    username,
    auth,
    version: version || "",
    phase: "idle",
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

  function clearFlushTimer() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function isConnected() {
    return state.phase === "connected" && bot && !bot._ended && typeof bot.chat === "function";
  }

  function scheduleFlush(delayMs = 800) {
    clearFlushTimer();
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushQueue();
    }, delayMs);
  }

function safeChatSend(text) {
  try {
    bot.chat(text);
    // ❌ no SENT echo
    return { ok: true };
  } catch (e) {
    const err = e?.message || String(e);
    state.lastError = err;
    emit({ type: "status", text: `❌ Send failed: ${err}` });
    return { ok: false, error: err };
  }
}


  function flushQueue() {
    if (!isConnected()) return;
    if (!outQueue.length) return;

    const item = outQueue.shift();
    safeChatSend(item.text);

    if (outQueue.length) scheduleFlush(600);
  }

  function connect() {
    clearRetry();
    clearFlushTimer();
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
      console.log(`[MC] ${label()} Connected to ${host}:${port}`);
      emit({ type: "status", text: `Connected to ${host}:${port}` });

      scheduleFlush(1200);
    });

    bot.on("messagestr", (message) => {
      emit({ type: "chat", text: message });
    });

    bot.on("resourcePack", (url, hash) => {
      console.log(`[MC] ${label()} Resource pack requested: ${url}`);
      try {
        if (bot?._client?.write && hash) {
          bot._client.write("resource_pack_status", { result: 3, hash });
          setTimeout(() => {
            try {
              if (!bot || bot._ended) return;
              bot._client.write("resource_pack_status", { result: 0, hash });
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
      emit({ type: "status", text: `❌ Error: ${state.lastError}` });
    });

    bot.on("end", () => {
      state.lastDisconnectAt = Date.now();
      if (!stopping) setPhase("disconnected");
      console.warn(`[MC] ${label()} Disconnected.`);
      emit({ type: "status", text: "⚠️ Disconnected." });

      bot = null;

      if (!stopping) scheduleReconnect();
    });
  }

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
  const msg = String(text || "").trim();
  if (!msg) return { ok: false, queued: false, error: "Empty message" };

  if (isConnected()) {
    return { ...safeChatSend(msg), queued: false };
  }


    outQueue.push({ text: msg, ts: Date.now() });
    if (outQueue.length > 50) outQueue.shift();

    scheduleFlush(1200);
    return { ok: true, queued: true };
  }

  function stop() {
    stopping = true;
    clearRetry();
    clearFlushTimer();
    outQueue.length = 0;
    setPhase("stopped");
    try {
      bot?.quit();
    } catch {}
  }

  function start() {
    stopping = false;
    clearRetry();
    clearFlushTimer();

    if (state.phase === "connected" || state.phase === "connecting") return;

    retryMs = 2000;
    connect();
  }

  function reconnectNow() {
    stopping = false;
    clearRetry();
    clearFlushTimer();
    try {
      bot?.quit();
    } catch {}
    connect();
  }

  function isRunning() {
    return state.phase === "connected" || state.phase === "connecting";
  }

  function getStatus() {
    const now = Date.now();
    const upFor =
      state.phase === "connected" && state.connectedAt
        ? Math.max(0, now - state.connectedAt)
        : 0;

    return { ...state, upForMs: upFor };
  }

  function onEvent(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  if (autoConnect) start();
  else setPhase("idle");

  return {
    onEvent,
    sendChat,
    stop,
    start,
    reconnectNow,
    isRunning,
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