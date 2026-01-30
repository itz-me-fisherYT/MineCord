const botsBox = document.getElementById("bots");
const msg = document.getElementById("msg");
const statusBox = document.getElementById("status");
const logsBox = document.getElementById("logs");
const tabsBox = document.getElementById("consoleTabs");

let buffers = {};         // bot -> [formatted lines]
let activeBot = "system";
let logSource = null;

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

      const canJoin =
        phase === "idle" ||
        phase === "disconnected" ||
        phase === "stopped";

      const canLeave =
        phase === "connected" ||
        phase === "connecting" ||
        phase === "disconnected";

      const div = document.createElement("div");
      div.className = "statusRow";

      div.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:4px;">
          <b>${escapeHtml(name)}</b>

          <div class="small">
            ${
              entry.host
                ? `${escapeHtml(entry.host)}:${escapeHtml(entry.port || 25565)}`
                : ""
            }
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

          <button ${canJoin ? "" : "disabled"}
            onclick="joinBot('${escapeAttr(name)}')">
            Join
          </button>

          <button ${canLeave ? "" : "disabled"}
            onclick="leaveBot('${escapeAttr(name)}')">
            Leave
          </button>
        </div>
      `;

      statusBox.appendChild(div);
    }

    // Ensure tabs exist for bots we can see
    ensureTabsFor(names);
  } catch {}
}

/* =========================
   Console tabs + logs
========================= */

function formatLog(e) {
  const t = new Date(e.ts).toLocaleTimeString();
  const lvl = (e.level || "log").toUpperCase();

  // Show chat cleaner
  if (e.level === "chat") return `[${t}] ${e.text}`;
  if (e.level === "status") return `[${t}] * ${e.text}`;
  return `[${t}] ${lvl}: ${e.text}`;
}

function renderLogs() {
  if (!logsBox) return;
  const lines = buffers[activeBot] || [];
  logsBox.textContent = lines.join("\n");
  logsBox.scrollTop = logsBox.scrollHeight;
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
  // Ensure system tab always exists
  if (!buffers.system) buffers.system = [];

  for (const name of botNames) {
    if (!buffers[name]) buffers[name] = [];
  }

  if (!buffers[activeBot]) activeBot = botNames[0] || "system";
  buildTabs();
}

function addLogEntry(e) {
  const bot = e.bot || "system";
  if (!buffers[bot]) buffers[bot] = [];

  buffers[bot].push(formatLog(e));
  if (buffers[bot].length > 500) buffers[bot].shift();

  // keep tabs updated if a new bot appears
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
    try { logSource.close(); } catch {}
  }

  logSource = new EventSource("/api/logs/stream");

  logSource.addEventListener("init", (ev) => {
    try {
      const data = JSON.parse(ev.data);
      buffers = {};

      const b = data.buffers || {};
      for (const bot in b) {
        buffers[bot] = (b[bot] || []).map(formatLog);
      }

      if (!buffers.system) buffers.system = [];

      if (!buffers[activeBot]) {
        // Prefer first non-system bot if present
        const keys = Object.keys(buffers).filter(k => k !== "system");
        activeBot = keys[0] || "system";
      }

      buildTabs();
      renderLogs();
    } catch {}
  });

  logSource.addEventListener("log", (ev) => {
    try {
      addLogEntry(JSON.parse(ev.data));
    } catch {}
  });

  logSource.onerror = () => {
    // browser auto-reconnects
  };
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

    // Auto switch console to that bot (minecraftafk feel)
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

startLogStream();
loadStatus().catch(() => {});
loadBots().catch(() => {});

// expose functions for buttons
window.loadBots = loadBots;
window.saveBots = saveBots;
window.loadStatus = loadStatus;
window.joinBot = joinBot;
window.leaveBot = leaveBot;
console.log("Minecord Panel app.js loaded");