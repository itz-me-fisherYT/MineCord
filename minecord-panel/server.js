// server.js
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer } from "ws";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BOTS_PATH = path.join(__dirname, "bots.json"); // user-local config file
const botProcs = new Map(); // botId -> child process
const wsClients = new Set();

function readBotsConfig() {
  if (!fs.existsSync(BOTS_PATH)) {
    // fall back to example if first run
    const example = path.join(__dirname, "bots.example.json");
    if (fs.existsSync(example)) fs.copyFileSync(example, BOTS_PATH);
    else fs.writeFileSync(BOTS_PATH, JSON.stringify({ bots: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(BOTS_PATH, "utf8"));
}

function sendToAll(msgObj) {
  const data = JSON.stringify(msgObj);
  for (const ws of wsClients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function emitLog(botId, level, message) {
  sendToAll({
    type: "log",
    botId,
    level,
    message: String(message).slice(0, 10000),
    ts: Date.now(),
  });
}

function emitStatus(botId, status) {
  sendToAll({ type: "status", botId, status, ts: Date.now() });
}

function startBot(botId) {
  if (botProcs.has(botId)) return;

  const cfg = readBotsConfig();
  const bot = cfg.bots?.find((b) => b.id === botId);
  if (!bot) throw new Error(`Bot not found: ${botId}`);

  // Start bot as its own process
  const child = spawn(process.execPath, ["src/index.js", "--botId", botId], {
    cwd: __dirname,
    env: {
      ...process.env,
      BOT_ID: botId,
      // You can also pass bot config via env if you want:
      // SERVER_IP: bot.serverIp, etc...
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  botProcs.set(botId, child);
  emitStatus(botId, "starting");

  child.stdout.on("data", (d) => emitLog(botId, "info", d.toString()));
  child.stderr.on("data", (d) => emitLog(botId, "error", d.toString()));

  child.on("close", (code, signal) => {
    botProcs.delete(botId);
    emitLog(botId, "warn", `Bot exited (code=${code}, signal=${signal})`);
    emitStatus(botId, "stopped");
  });

  emitStatus(botId, "running");
}

function stopBot(botId) {
  const child = botProcs.get(botId);
  if (!child) return;

  emitStatus(botId, "stopping");

  // Gentle shutdown first
  child.kill("SIGTERM");

  // Force-kill after 5s if needed
  setTimeout(() => {
    if (botProcs.get(botId)) child.kill("SIGKILL");
  }, 5000);
}

wss.on("connection", (ws) => {
  wsClients.add(ws);

  // send initial bots list + running statuses
  const cfg = readBotsConfig();
  ws.send(JSON.stringify({ type: "bots", bots: cfg.bots ?? [] }));
  ws.send(JSON.stringify({
    type: "running",
    running: Array.from(botProcs.keys()),
  }));

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "start" && msg.botId) {
      try { startBot(msg.botId); } catch (e) { emitLog(msg.botId, "error", e.message); }
    }

    if (msg.type === "stop" && msg.botId) {
      stopBot(msg.botId);
    }
  });

  ws.on("close", () => wsClients.delete(ws));
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`MineCord panel: http://localhost:${process.env.PORT || 3000}`);
});
