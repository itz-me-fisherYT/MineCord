# **MineCord**

**MineCord** is an open-source **multi-account Discord ↔ Minecraft bridge** built with **Node.js**, **discord.js**, and **Mineflayer**.

It allows you to run **one or many Minecraft Java Edition accounts at the same time**, each linked to its **own Discord channel**, enabling real-time chat and command relaying between Discord and Minecraft — without tabbing into the game.

---

## **✨ Features**

* 🔗 **Real-time Discord ↔ Minecraft chat bridge**
* 🤖 Supports **multiple Minecraft accounts simultaneously**
* 📢 Each Minecraft account maps to its **own Discord channel**
* 🧱 Relays in-game chat, system messages, and status updates
* 💬 Send chat messages and commands from Discord into Minecraft
* 🔁 Automatic reconnect with delay + jitter
* ⚙️ Simple JSON-based multi-bot configuration (`bots.json`)
* 🔐 GitHub-safe setup (`.env.example`, `bots.example.json`)
* 🌐 Built-in **web control panel**

---

## **🧰 Tech Stack**

* **Node.js**
* **discord.js** — Discord bot API
* **mineflayer** — Minecraft Java Edition client bot
* **dotenv** — Environment variable management

---

## **📁 Project Structure**

```text
minecord/
├─ src/
│  ├─ index.js        # App entry point (single + multi-bot loader)
│  ├─ discord.js      # Discord bot logic
│  ├─ minecraft.js    # Mineflayer client wrapper
│  └─ bridge.js       # Discord ↔ Minecraft router
│
├─ minecord-panel/    # Web panel (browser UI)
├─ bots.example.json  # Multi-bot config template
├─ .env.example
├─ setup.bat
├─ setup.sh
├─ start.bat
├─ start.sh
├─ package.json
└─ README.md
```

---

## **🚀 Getting Started**

MineCord works on **Windows**, **macOS**, and **Linux**.

### **Quick overview**

* **Windows** → `.bat` files
* **macOS / Linux** → `.sh` files
* **Multi-bot mode** → `bots.json`
* **Single-bot mode** → automatic fallback

---

## **1️⃣ Prerequisites**

Before starting, make sure you have:

* **Node.js 18+**
  [https://nodejs.org/](https://nodejs.org/)
* A **Discord bot token**
* One or more **Minecraft Java Edition accounts**
* Permission to use bots on the target Minecraft server

> 💡 **VS Code is strongly recommended**
> [https://code.visualstudio.com/](https://code.visualstudio.com/)
> It prevents breaking config files.

---

## **2️⃣ Installation**

### **🪟 Windows**

Double-click:

```text
setup.bat
```

---

### **🍎 macOS / 🐧 Linux**

```bash
chmod +x setup.sh
./setup.sh
```

This installs all required dependencies.

---

## **3️⃣ Configuration**

MineCord automatically chooses the correct mode:

* **If `bots.json` exists → Multi-Bot Mode**
* **If `bots.json` does NOT exist → Single-Bot Mode**

No flags. No code edits.

---

## **🔹 Multi-Bot Mode (Recommended)**

Run **one or many Minecraft accounts**, each mapped to its **own Discord channel**.

Create a `bots.json` file in the project root
(**do not commit this file**):

```json
{
  "bots": [
    {
      "name": "Bot-1",
      "channelId": "DISCORD_CHANNEL_ID",
      "host": "example.server.net",
      "port": 25565,
      "username": "email@example.com",
      "auth": "microsoft",
      "version": "1.20.4"
    }
  ]
}
```

* Each entry = **one Minecraft client**
* Each client = **one Discord channel**
* No cross-talk between bots

Use `bots.example.json` as a reference.

---

## **🔹 Single-Bot Mode (Fallback)**

If `bots.json` does not exist, MineCord falls back to `.env`.

Edit **`.env`**:

```env
DISCORD_TOKEN=PASTE_YOUR_DISCORD_BOT_TOKEN

# Optional (safe to ignore)
BOT_START_DELAY_MS=20000
BOT_START_JITTER_MS=5000
```

Only **DISCORD_TOKEN** is required.

---

## **4️⃣ Running MineCord**

### **🪟 Windows**

```text
start.bat
```

---

### **🍎 macOS / 🐧 Linux**

```bash
chmod +x start.sh
./start.sh
```

If successful:

* Discord bot comes online
* Minecraft bot(s) connect
* Web panel becomes available

---

## **🌐 Web Panel**

### **On the same PC**

```
http://localhost:3000
```

### **On phone / another PC (same network)**

```
http://YOUR_LAN_IP:3000
```

The panel lets you:

* View bot status
* See Minecraft chat
* Send commands
* Broadcast to all bots
* Use command history (↑ / ↓)

---

## **💬 Discord Commands**

Commands only work **inside a Discord channel mapped to a Minecraft bot**.

### **Send chat**

```
!mc say Hello from Discord!
```

### **Run a Minecraft command**

```
!mc cmd /list
```

> ⚠️ Restrict command usage to trusted users.

---

## **🔐 Security Notes**

* ❌ Never commit `.env` or `bots.json`
* 🤖 Always use **dedicated Minecraft accounts**
* 🔁 Never reuse the same account across multiple bots
* 🛑 Avoid command spam (can cause kicks or bans)
* 📜 Follow the rules of every server you connect to

---

## **🛣️ Roadmap / Ideas**

* Slash commands (`/mc`)
* Role-based permissions
* Per-bot rate limiting
* Chat formatting & colors
* Hot-reload `bots.json`
* Public access + auth
* Docker support

---

## **⚠️ Disclaimer**

MineCord uses automated Minecraft clients.

Some servers restrict or block bots.
**Always make sure you have permission before using MineCord.**

---

## **📜 License**

**MIT License**

---

**Made with ❤️ for bridging many blocks and many bots.**