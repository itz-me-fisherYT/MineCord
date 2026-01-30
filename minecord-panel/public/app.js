// minecord-panel/public/app.js
const botsBox = document.getElementById("bots");
const msg = document.getElementById("msg");
const statusBox = document.getElementById("status");
const logsBox = document.getElementById("logs");
const tabsBox = document.getElementById("consoleTabs");

// Toggles
const chatOnlyToggle = document.getElementById("chatOnlyToggle");
const sendAllToggle = document.getElementById("sendAllToggle");

// CMD UI
const cmdBotSelect = document.getElementById("cmdBotSelect");
const cmdInput = document.getElementById("cmdInput");
const cmdSendBtn = document.getElementById("cmdSendBtn");
const cmdMsg = document.getElementById("cmdMsg");

let buffers = {}; // bot -> [ {ts, level, text, bot} ]
let activeBot = "system";
let logSource = null;

// command history (terminal-like)
let cmdHistory = [];
let cmdHistIndex = -1; // -1 means not browsing history
let cmdDraft = "";

// persisted toggle + history (nice QoL)
const LS_CHAT_ONLY = "minecord_chatOnly";
const LS_SEND_ALL = "minecord_sendAll";
const LS_CMD_HISTORY = "minecord_cmdHistory_v1";

/* =========================
   Status helpers
========================= */

function phaseToUi(phase) {
  const p = String(phase || "idle").toLowerCase();
  if (p === "connected") return { text: "CONNECTED", cls: "on" };
  if (p === "connecting") return { text: "CONNECTING", cls: "on" };
  if (p === "disconnected") return { text: "DISCONNECTED", cls: "off" };
  if (p === "stopped") return { text: "STOPPED", cls: "off" };
  return { text: "IDLE", cls: "off" };
}

function fmtAgo(ts) {
  if (!ts) return "never";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function fmtUptime(ms) {
  if (!ms || ms <= 0) return "0s";
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const s = sec % 60;
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/* =========================
   Bots editor
========================= */

async function loadBots() {
  try {
    const res = await fetch("/api/bots");
    const json = await res.json();
    botsBox.value = JSON.stringify(json, null, 2);
    msg.innerText = "";
  } catch {
    msg.innerText = "Failed to load bots.json";
  }
}

async function saveBots() {
  try {
    const parsed = JSON.parse(botsBox.value);

    const res = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    });

    const out = await res.json().catch(() => ({}));

    if (!res.ok || out.ok === false) {
      msg.innerText = out.error ? `Save failed: ${out.error}` : "Save failed ❌";
      return;
    }

    msg.innerText = "Saved ✅";
    await loadStatus();
  } catch {
    msg.innerText = "Invalid JSON ❌";
  }
}

/* =========================
   Status panel
========================= */

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const json = await res.json();

    statusBox.innerHTML = "";

    const names = Object.keys(json).sort((a, b) => a.localeCompare(b));

    for (const name of names) {
      const entry = json[name] || {};
      const mc = entry.mc || {};

      const phase = mc.phase || "idle";
      const ui = phaseToUi(phase);

      const lastKick = mc.lastKick ? String(mc.lastKick).slice(0, 140) : "";
      const lastErr = mc.lastError ? String(mc.lastError).slice(0, 140) : "";
      const lastDisc = mc.lastDisconnectAt || null;

      const canJoin = phase === "idle" || phase === "disconnected" || phase === "stopped";

      const canLeave = phase === "connected" || phase === "connecting" || phase === "disconnected";

      const div = document.createElement("div");
      div.className = "statusRow";

      div.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:4px;">
          <b>${escapeHtml(name)}</b>

          <div class="small">
            ${entry.host ? `${escapeHtml(entry.host)}:${escapeHtml(entry.port || 25565)}` : ""}
            ${mc.upForMs ? ` • up ${fmtUptime(mc.upForMs)}` : ""}
            ${lastDisc ? ` • last dc ${fmtAgo(lastDisc)}` : ""}
          </div>

          ${
            lastKick
              ? `<div class="small">Kick: ${escapeHtml(lastKick)}</div>`
              : lastErr
              ? `<div class="small">Error: ${escapeHtml(lastErr)}</div>`
              : ""
          }
        </div>

        <div style="display:flex; align-items:center; gap:10px;">
          <span class="${ui.cls}">${ui.text}</span>

          <button ${canJoin ? "" : "disabled"} onclick="joinBot('${escapeAttr(name)}')">Join</button>
          <button ${canLeave ? "" : "disabled"} onclick="leaveBot('${escapeAttr(name)}')">Leave</button>
        </div>
      `;

      statusBox.appendChild(div);
    }

    // ensure tabs + dropdown have bots
    ensureTabsFor(names);
    ensureCmdBots(names);
  } catch {}
}

/* =========================
   Console tabs + logs
========================= */

function formatLogLine(e) {
  const t = new Date(e.ts).toLocaleTimeString();
  const lvl = (e.level || "log").toUpperCase();
  const bot = e.bot || "system";

  if (e.level === "chat") return `[${t}] (${bot}) ${e.text}`;
  if (e.level === "status") return `[${t}] (${bot}) * ${e.text}`;
  return `[${t}] (${bot}) ${lvl}: ${e.text}`;
}

function getRenderedLinesForBot(bot) {
  const entries = buffers[bot] || [];
  const chatOnly = !!(chatOnlyToggle && chatOnlyToggle.checked);

  const filtered = entries.filter((e) => {
    // hide local echo lines
    const text = String(e.text || "").toUpperCase();
    if (text.startsWith("YOU:")) return false;
    if (text.startsWith("SENT:")) return false;

    if (chatOnly) return e.level === "chat";
    return true;
  });

  return filtered.map(formatLogLine);
}


function renderLogs() {
  if (!logsBox) return;

  const lines = getRenderedLinesForBot(activeBot);
  logsBox.textContent = lines.join("\n");
  logsBox.scrollTop = logsBox.scrollHeight;

  // keep dropdown aligned with active bot
  if (cmdBotSelect && cmdBotSelect.value !== activeBot && buffers[activeBot]) {
    if (!sendAllToggle?.checked) cmdBotSelect.value = activeBot;
  }
}

function buildTabs() {
  if (!tabsBox) return;

  const bots = Object.keys(buffers).sort((a, b) => a.localeCompare(b));

  tabsBox.innerHTML = "";

  for (const bot of bots) {
    const btn = document.createElement("button");
    btn.className = "tabBtn" + (bot === activeBot ? " active" : "");
    btn.textContent = bot;

    btn.onclick = () => {
      activeBot = bot;
      buildTabs();
      renderLogs();
    };

    tabsBox.appendChild(btn);
  }
}

function ensureTabsFor(botNames) {
  if (!buffers.system) buffers.system = [];
  for (const name of botNames) if (!buffers[name]) buffers[name] = [];
  if (!buffers[activeBot]) activeBot = botNames[0] || "system";
  buildTabs();
}

function addLogEntry(e) {
  const bot = e.bot || "system";
  if (!buffers[bot]) buffers[bot] = [];

  buffers[bot].push({
    ts: e.ts,
    level: e.level || "log",
    text: String(e.text ?? ""),
    bot
  });

  if (buffers[bot].length > 800) buffers[bot].shift();

  buildTabs();
  if (bot === activeBot) renderLogs();
}

function clearLogs() {
  buffers[activeBot] = [];
  renderLogs();
}

window.clearLogs = clearLogs;

/* =========================
   SSE stream
========================= */

function startLogStream() {
  if (!logsBox) return;

  if (logSource) {
    try {
      logSource.close();
    } catch {}
  }

  logSource = new EventSource("/api/logs/stream");

  logSource.addEventListener("init", (ev) => {
    try {
      const data = JSON.parse(ev.data);
      buffers = {};

      const b = data.buffers || {};
      for (const bot in b) {
        buffers[bot] = (b[bot] || []).map((x) => ({
          ts: x.ts,
          level: x.level || "log",
          text: String(x.text ?? ""),
          bot: x.bot || bot
        }));
      }

      if (!buffers.system) buffers.system = [];

      if (!buffers[activeBot]) {
        const keys = Object.keys(buffers).filter((k) => k !== "system");
        activeBot = keys[0] || "system";
      }

      buildTabs();
      ensureCmdBots(Object.keys(buffers).filter((k) => k !== "system"));
      renderLogs();
    } catch {}
  });

  logSource.addEventListener("log", (ev) => {
    try {
      addLogEntry(JSON.parse(ev.data));
    } catch {}
  });

  logSource.onerror = () => {};
}

/* =========================
   Bot actions
========================= */

async function joinBot(name) {
  try {
    const res = await fetch(`/api/start/${encodeURIComponent(name)}`, { method: "POST" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out.ok === false) {
      alert(out.error || "Join failed");
      return;
    }
    activeBot = name;
    buildTabs();
    renderLogs();
    await loadStatus();
  } catch {
    alert("Join failed");
  }
}

async function leaveBot(name) {
  try {
    const res = await fetch(`/api/stop/${encodeURIComponent(name)}`, { method: "POST" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out.ok === false) {
      alert(out.error || "Leave failed");
      return;
    }
    await loadStatus();
  } catch {
    alert("Leave failed");
  }
}

/* =========================
   Panel CMD box
========================= */

function ensureCmdBots(names) {
  if (!cmdBotSelect) return;

  const unique = Array.from(new Set(names))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const current = cmdBotSelect.value;

  cmdBotSelect.innerHTML = "";

  for (const n of unique) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    cmdBotSelect.appendChild(opt);
  }

  // Pick activeBot if it’s a real bot, otherwise first option
  const canUseActive = unique.includes(activeBot);
  cmdBotSelect.value = canUseActive
    ? activeBot
    : current && unique.includes(current)
    ? current
    : unique[0] || "";
}

function pushCmdHistory(text) {
  const t = String(text || "").trim();
  if (!t) return;

  // avoid duplicates if user spams enter
  const last = cmdHistory.length ? cmdHistory[cmdHistory.length - 1] : "";
  if (last === t) return;

  cmdHistory.push(t);
  if (cmdHistory.length > 200) cmdHistory.shift();

  try {
    localStorage.setItem(LS_CMD_HISTORY, JSON.stringify(cmdHistory));
  } catch {}
}

function resetHistoryBrowse() {
  cmdHistIndex = -1;
  cmdDraft = "";
}

function applyHistoryAt(index) {
  if (!cmdInput) return;
  if (index < 0 || index >= cmdHistory.length) return;

  cmdInput.value = cmdHistory[index];
  // put caret at end
  queueMicrotask(() => {
    try {
      cmdInput.setSelectionRange(cmdInput.value.length, cmdInput.value.length);
    } catch {}
  });
}

async function sendPanelCmd() {
  if (!cmdInput || !cmdBotSelect) return;

  const text = String(cmdInput.value || "").trim();
  if (!text) return;

  const sendAll = !!(sendAllToggle && sendAllToggle.checked);
  const botName = String(cmdBotSelect.value || "").trim();

  if (!sendAll && !botName) {
    if (cmdMsg) cmdMsg.textContent = "Pick a bot first.";
    return;
  }

  if (cmdMsg) cmdMsg.textContent = "";
  cmdSendBtn && (cmdSendBtn.disabled = true);

  try {
    if (sendAll) {
      // hit broadcast endpoint (fast + consistent)
      const res = await fetch(`/api/mc/sendAll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || out.ok === false) {
        if (cmdMsg) cmdMsg.textContent = out.error || "Broadcast failed";
        return;
      }

      const results = out.results || {};
      const names = Object.keys(results);
      const queued = names.filter((n) => results[n]?.queued).length;
      const failed = names.filter((n) => results[n]?.ok === false).length;

      if (cmdMsg) {
        if (failed > 0) cmdMsg.textContent = `Broadcast sent. (${failed} failed, ${queued} queued)`;
        else if (queued > 0) cmdMsg.textContent = `Broadcast sent. (${queued} queued)`;
        else cmdMsg.textContent = "Broadcast sent.";
      }
    } else {
      // single bot send
      const res = await fetch(`/api/mc/${encodeURIComponent(botName)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      const out = await res.json().catch(() => ({}));

      if (!res.ok || out.ok === false) {
        if (cmdMsg) cmdMsg.textContent = out.error || "Send failed";
        return;
      }

      if (cmdMsg) cmdMsg.textContent = out.queued ? "Queued (bot not ready yet)." : "Sent.";

      // switch console to that bot
      activeBot = botName;
      buildTabs();
      renderLogs();
    }

    // history + clear
    pushCmdHistory(text);
    resetHistoryBrowse();

    cmdInput.value = "";
    cmdInput.focus();
  } catch {
    if (cmdMsg) cmdMsg.textContent = sendAll ? "Broadcast failed" : "Send failed";
  } finally {
    cmdSendBtn && (cmdSendBtn.disabled = false);
  }
}

if (cmdSendBtn) cmdSendBtn.addEventListener("click", () => sendPanelCmd());

if (cmdInput) {
  cmdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendPanelCmd();
      return;
    }

    // terminal-like history browsing
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      // If user is in the middle of text, still allow (like terminals),
      // but prevent cursor movement.
      e.preventDefault();

      if (!cmdHistory.length) return;

      // first time entering history browse: save draft
      if (cmdHistIndex === -1) {
        cmdDraft = cmdInput.value;
        cmdHistIndex = cmdHistory.length; // one past end (draft position)
      }

      if (e.key === "ArrowUp") {
        cmdHistIndex = Math.max(0, cmdHistIndex - 1);
        applyHistoryAt(cmdHistIndex);
      } else {
        // ArrowDown
        cmdHistIndex = Math.min(cmdHistory.length, cmdHistIndex + 1);
        if (cmdHistIndex === cmdHistory.length) {
          // back to draft
          cmdInput.value = cmdDraft;
          queueMicrotask(() => {
            try {
              cmdInput.setSelectionRange(cmdInput.value.length, cmdInput.value.length);
            } catch {}
          });
        } else {
          applyHistoryAt(cmdHistIndex);
        }
      }
    }
  });

  cmdInput.addEventListener("input", () => {
    // if user types while browsing history, exit history mode (like many shells)
    if (cmdHistIndex !== -1) resetHistoryBrowse();
  });
}

/* =========================
   Toggle wiring
========================= */

function loadToggleState() {
  try {
    if (chatOnlyToggle) chatOnlyToggle.checked = localStorage.getItem(LS_CHAT_ONLY) === "1";
    if (sendAllToggle) sendAllToggle.checked = localStorage.getItem(LS_SEND_ALL) === "1";
  } catch {}
}

function saveToggleState() {
  try {
    if (chatOnlyToggle) localStorage.setItem(LS_CHAT_ONLY, chatOnlyToggle.checked ? "1" : "0");
    if (sendAllToggle) localStorage.setItem(LS_SEND_ALL, sendAllToggle.checked ? "1" : "0");
  } catch {}
}

function loadCmdHistory() {
  try {
    const raw = localStorage.getItem(LS_CMD_HISTORY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) cmdHistory = arr.map((x) => String(x)).filter(Boolean).slice(-200);
  } catch {}
}

if (chatOnlyToggle) {
  chatOnlyToggle.addEventListener("change", () => {
    saveToggleState();
    renderLogs();
  });
}

if (sendAllToggle) {
  sendAllToggle.addEventListener("change", () => {
    saveToggleState();
    // optional UX: when send-all is enabled, keep selection but don't force-sync it
    if (cmdMsg) cmdMsg.textContent = sendAllToggle.checked ? "Broadcast mode ON" : "";
  });
}

/* =========================
   Safety helpers
========================= */

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(s) {
  return String(s).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

/* =========================
   Boot
========================= */

setInterval(() => {
  loadStatus().catch(() => {});
}, 3000);

loadToggleState();
loadCmdHistory();

startLogStream();
loadStatus().catch(() => {});
loadBots().catch(() => {});

// expose functions for buttons
window.loadBots = loadBots;
window.saveBots = saveBots;
window.loadStatus = loadStatus;
window.joinBot = joinBot;
window.leaveBot = leaveBot;
