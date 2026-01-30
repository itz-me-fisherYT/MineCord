const botsBox = document.getElementById("bots");
const msg = document.getElementById("msg");
const statusBox = document.getElementById("status");

// Logs box is optional — if you haven't added it to HTML yet, nothing breaks.
const logsBox = document.getElementById("logs");
let logLines = [];

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

async function loadBots() {
  const res = await fetch("/api/bots");
  const json = await res.json();
  botsBox.value = JSON.stringify(json, null, 2);
  msg.innerText = "";
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

async function loadStatus() {
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
}

// ===== Logs =====
function renderLogs() {
  if (!logsBox) return;
  logsBox.textContent = logLines.join("\n");
  logsBox.scrollTop = logsBox.scrollHeight;
}

function clearLogs() {
  logLines = [];
  renderLogs();
}
window.clearLogs = clearLogs;

function formatLog(e) {
  const t = new Date(e.ts).toLocaleTimeString();
  const lvl = (e.level || "log").toUpperCase();
  return `[${t}] ${lvl}: ${e.text}`;
}

function addLogEntry(e) {
  logLines.push(formatLog(e));
  if (logLines.length > 500) logLines.shift();
  renderLogs();
}

function startLogStream() {
  if (!logsBox) return;

  const es = new EventSource("/api/logs/stream");

  es.addEventListener("init", (ev) => {
    try {
      const data = JSON.parse(ev.data);
      const logs = Array.isArray(data.logs) ? data.logs : [];
      logLines = logs.map(formatLog);
      renderLogs();
    } catch {}
  });

  es.addEventListener("log", (ev) => {
    try {
      const e = JSON.parse(ev.data);
      addLogEntry(e);
    } catch {}
  });

  es.onerror = () => {
    // Browser auto-retries; keep quiet.
  };
}

// ===== Helpers =====
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

async function joinBot(name) {
  const res = await fetch(`/api/start/${encodeURIComponent(name)}`, { method: "POST" });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.ok === false) {
    alert(out.error || "Join failed");
    return;
  }
  await loadStatus();
}

async function leaveBot(name) {
  const res = await fetch(`/api/stop/${encodeURIComponent(name)}`, { method: "POST" });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.ok === false) {
    alert(out.error || "Leave failed");
    return;
  }
  await loadStatus();
}

// Auto refresh status
setInterval(() => {
  loadStatus().catch(() => {});
}, 3000);

// Start log stream (only if #logs exists)
startLogStream();

// Initial status load
loadStatus().catch(() => {});
