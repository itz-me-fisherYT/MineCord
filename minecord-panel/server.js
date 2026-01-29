const express = require("express");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");

const app = express();
const PORT = 3000;

// IMPORTANT: use the ROOT bots.json, not minecord-panel/bots.json
const BOTS_FILE = path.join(__dirname, "..", "bots.json");

// If a bot hasn't heartbeated in this time, show it as offline
const ONLINE_TTL_MS = 20_000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Helpers ----------
async function readBotsFile() {
  try {
    const data = await fs.readJson(BOTS_FILE);

    // Support BOTH formats:
    // 1) { bots: [ {...}, {...} ] }
    // 2) [ {...}, {...} ]
    const botsArr = Array.isArray(data) ? data : (Array.isArray(data?.bots) ? data.bots : []);
    const names = botsArr
      .map((b) => String(b?.name || "").trim())
      .filter(Boolean);

    return { raw: data, botsArr, names };
  } catch {
    return { raw: {}, botsArr: [], names: [] };
  }
}

// ---------- Health ----------
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// ---------- Bots.json (reads/writes ROOT file) ----------
app.get("/api/bots", async (req, res) => {
  const { raw } = await readBotsFile();
  res.json(raw);
});

app.post("/api/bots", async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, error: "Body must be JSON" });
    }

    // Allow either format; just save what the UI sends.
    await fs.writeJson(BOTS_FILE, body, { spaces: 2 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Status (bots.json list + heartbeat) ----------
let status = {};

// Heartbeat: POST /api/heartbeat/Fisher-2
app.post("/api/heartbeat/:botName", (req, res) => {
  const botName = String(req.params.botName || "").trim();
  if (!botName) return res.status(400).json({ ok: false, error: "Missing bot name" });

  status[botName] = {
    lastSeen: Date.now(),
    ...(req.body && typeof req.body === "object" ? req.body : {})
  };

  res.json({ ok: true });
});

// Status returns ALL bots from root bots.json, even if never heartbeated
app.get("/api/status", async (req, res) => {
  const now = Date.now();
  const { names } = await readBotsFile();

  const out = {};

  for (const name of names) {
    const lastSeen = status[name]?.lastSeen || 0;
    out[name] = {
      online: lastSeen ? (now - lastSeen <= ONLINE_TTL_MS) : false,
      lastSeen: lastSeen || null
    };
  }

  // Include any extra heartbeating bots not listed in bots.json (optional)
  for (const name of Object.keys(status)) {
    if (out[name]) continue;
    const lastSeen = status[name]?.lastSeen || 0;
    out[name] = {
      online: lastSeen ? (now - lastSeen <= ONLINE_TTL_MS) : false,
      lastSeen: lastSeen || null
    };
  }

  res.json(out);
});

// ---------- Restart (still stub) ----------
app.post("/api/restart/:botName", (req, res) => {
  const botName = String(req.params.botName || "").trim();
  console.log("Restart requested:", botName);
  res.json({ ok: true });
});

app.post("/api/restart-all", (req, res) => {
  console.log("Restart ALL requested");
  res.json({ ok: true });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Web Panel running at http://localhost:${PORT}`);
  console.log(`Using bots file: ${BOTS_FILE}`);
});
