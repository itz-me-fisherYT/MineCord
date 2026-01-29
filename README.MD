# MineCord

**MineCord** is an open‑source **multi‑account Discord ↔ Minecraft bridge** built with **Node.js**, **discord.js**, and **Mineflayer**.

It allows you to run **one or many Minecraft Java Edition accounts at the same time**, each linked to its **own Discord channel**, enabling real‑time chat and command relaying between Discord and Minecraft without tabbing into the game.

---

## ✨ Features

* 🔗 Real‑time Discord ↔ Minecraft chat bridge
* 🤖 Supports **multiple Minecraft accounts simultaneously**
* 📢 Each Minecraft account maps to its **own Discord channel**
* 🧱 Relays in‑game chat, system messages, and status updates
* 💬 Send chat messages and commands from Discord into Minecraft
* 🔁 Automatic reconnect with backoff on disconnects
* ⚙️ Simple JSON‑based multi‑bot configuration (`bots.json`)
* 🔐 GitHub‑safe setup (`.env.example`, `bots.example.json`)

---

## 🧰 Tech Stack

* **Node.js**
* **discord.js** – Discord bot API
* **mineflayer** – Minecraft Java Edition client bot
* **dotenv** – Environment variable management

---

## 📁 Project Structure

```text
minecord/
├─ src/
│  ├─ index.js        # App entry point (single + multi‑bot loader)
│  ├─ discord.js      # Discord bot logic
│  ├─ minecraft.js    # Mineflayer client wrapper
│  └─ bridge.js       # Discord ↔ Minecraft router
│
├─ bots.example.json  # Public multi‑bot config template
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
```

---

## 🚀 Getting Started

MineCord is designed to be **easy to run on any OS**. Choose the section that matches your system.

> **Quick overview**
>
> * Windows users use `.bat` files
> * Linux / macOS users use `.sh` files
> * Multi-bot mode uses `bots.json`
> * Single-bot mode falls back to `.env`

> **TL;DR**
>
> * Put your Discord token in `.env`
> * Create `bots.json` for multi‑bot mode (recommended)
> * Run `npm run dev`
> * Type `!mc say hello` in the mapped channel

### 1️⃣ Prerequisites

Before starting, make sure you have:

* **Node.js 18+** installed
* A **Discord bot token**
* One or more **Minecraft Java Edition accounts**
* Permission to use automated clients on the target server

- Node.js **18+**
- A Discord bot token
- One or more **Minecraft Java Edition accounts** (Microsoft accounts recommended)
- Permission to run client bots on the target Minecraft servers

---

### 2️⃣ Installation

Clone the repository and install dependencies.

### 🖥️ Windows

Double-click:

```text
requirements.bat
```

### 🐧 Linux / 🍎 macOS

```bash
chmod +x requirements.sh
./requirements.sh
```

```bash
npm install
```

---

### 3️⃣ Configuration

MineCord supports **two modes** and automatically chooses the right one:

* **If `bots.json` exists → Multi‑Bot Mode**
* **If `bots.json` does NOT exist → Single‑Bot Mode (fallback)**

You never need to toggle a flag in code.

MineCord supports **two modes**:

### 🔹 Multi‑Bot Mode (Recommended)

Multi‑Bot Mode lets you run **one or many Minecraft accounts**, each mapped to **its own Discord channel**.

**When to use this:**

* You want multiple MC accounts online at once
* Each account should have its own Discord channel
* You want clean isolation (no cross‑talk)

Create a `bots.json` file in the project root (**do not commit this file**):

Create a `bots.json` file in the project root (**do not commit this file**):

```json
{
  "bots": [
    {
      "name": "Bot‑1",
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

* Each entry creates **one Minecraft client**
* Each client is bound to **exactly one Discord channel**
* Commands and chat are isolated per channel

Use `bots.example.json` as a reference.

---

### 🔹 Single‑Bot Mode (Fallback)

Single‑Bot Mode is useful for quick testing or very simple setups.

**When to use this:**

* You only need one Minecraft account
* You don’t want a `bots.json` yet
* You’re just testing the bridge

If `bots.json` is **not present**, MineCord falls back to `.env`:

If `bots.json` is **not present**, MineCord falls back to `.env`:

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_channel_id

MC_HOST=play.example.com
MC_PORT=25565
MC_USERNAME=your_minecraft_email
MC_AUTH=microsoft
MC_VERSION=1.20.4
```

---

### 4️⃣ Run the Bot

### 🖥️ Windows

```text
start.bat
```

### 🐧 Linux / 🍎 macOS

```bash
chmod +x start.sh
./start.sh
```

If successful:

* The Discord bot will come online
* One or more Minecraft clients will connect
* Each Discord channel controls its own Minecraft account

```bash
npm run dev
```

**What you should see:**

* Discord bot logs in
* Each configured Minecraft client connects
* Console logs show how many bots started

Example:

```
[MineCord] Started 2 bot(s) (multi mode).
```

```bash
npm run dev
```

If successful:

* The Discord bot will come online
* One or more Minecraft clients will connect
* Each Discord channel will control its assigned Minecraft account

---

## 💬 Discord Commands

> Commands only work **inside a Discord channel that is mapped to a Minecraft bot**.
> Messages in other channels are ignored.

### Send chat to Minecraft

```
!mc say Hello from Discord!
```

> Commands only work **inside a Discord channel that is mapped to a Minecraft bot**.
> Messages in other channels are ignored.

Commands only work inside a channel assigned to a Minecraft bot.

### Send chat to Minecraft

```
!mc say Hello from Discord!
```

### Run a Minecraft command

```
!mc cmd /list
```

```
!mc cmd /list
```

> ⚠️ **Security note**: `!mc cmd` should be restricted to trusted users or admins in production.

---

## 🔐 Security Notes

* ❌ Never commit `.env` or `bots.json`

* 🤖 Always use **dedicated Minecraft accounts**

* 🔁 Never reuse the same MC account across multiple bots

* 🛑 Avoid command spam (can cause kicks or bans)

* 📜 Follow each server’s rules and ToS

* ❌ Never commit `.env` or `bots.json`

* 🤖 Always use **dedicated Minecraft accounts**

* 🔁 Never reuse the same MC account across multiple bots

* 🛑 Avoid command spam (can cause kicks or bans)

* 📜 Follow each server’s rules and ToS

- Never commit `.env` or `bots.json`
- Always use dedicated Minecraft accounts
- Do not reuse the same account across multiple bots
- Avoid spamming commands to prevent kicks or bans
- Follow the rules of every Minecraft server you connect to

---

## 🛣️ Roadmap / Ideas

Planned and community-requested improvements:

* Slash command support (`/mc`)
* Role-based permissions per channel
* Per-bot rate limiting / command queues
* Chat formatting & color stripping
* Hot-reload `bots.json`
* Web dashboard

Planned and community‑requested improvements:

* Slash command support (`/mc`)
* Role‑based permissions per channel
* Per‑bot rate limiting / command queues
* Chat formatting & color stripping
* Hot‑reload `bots.json`
* Web dashboard

- Slash command support (`/mc`)
- Role‑based permissions per channel
- Per‑bot rate limiting / command queues
- Chat formatting & color stripping
- Hot‑reload `bots.json`
- Web dashboard

---

## ⚠️ Disclaimer

MineCord uses automated Minecraft clients.

Some servers (especially large networks with captchas or anti-bot systems) may restrict or block bot connections.

Always ensure you have permission before using MineCord on a server.

MineCord uses automated Minecraft clients.

Some servers (e.g. large networks with captchas or anti‑bot systems) may restrict or block bot connections.

Always ensure you have permission before using MineCord on a server.

MineCord uses automated Minecraft clients. Some servers restrict or prohibit bot connections. Always ensure you have permission before using MineCord on a server.

---

## 📜 License

MIT License

---

Made with ❤️ for bridging **many blocks and many bots**.
