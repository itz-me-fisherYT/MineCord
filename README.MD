# MineCord

**MineCord** is an open-source Discord ↔ Minecraft bridge bot built with **Node.js**, **discord.js**, and **Mineflayer**.

It connects a Discord channel directly to a live Minecraft account, allowing authorized users to relay chat and commands in real time and receive in-game responses without leaving Discord.

---

## ✨ Features

* 🔗 Real-time Discord ↔ Minecraft chat bridge
* 🤖 Uses a real Minecraft client account (via Mineflayer)
* 🧱 Relays in-game chat, system messages, and status updates to Discord
* 💬 Send chat messages and commands from Discord into Minecraft
* 🔁 Automatic reconnect with backoff on disconnects
* 🔐 Environment-based configuration (`.env`)
* 🧼 GitHub-safe setup (`.gitignore`, `.env.example` included)

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
│  ├─ index.js        # App entry point
│  ├─ discord.js      # Discord bot logic
│  ├─ minecraft.js    # Mineflayer client logic
│  └─ bridge.js       # Discord ↔ Minecraft glue
│
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
```

---

## 🚀 Getting Started

### 1️⃣ Prerequisites

* Node.js 18+
* A Discord bot token
* A **dedicated Minecraft Java Edition account** (Microsoft account recommended)
* Permission to run a client bot on the target Minecraft server

---

### 2️⃣ Installation

```bash
npm install
```

---

### 3️⃣ Configuration

Create a `.env` file in the project root (do **not** commit this file):

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_channel_id

MC_HOST=play.example.com
MC_PORT=25565
MC_USERNAME=your_minecraft_email_or_username
MC_AUTH=microsoft
```

Use `.env.example` as a reference.

---

### 4️⃣ Run the Bot

```bash
npm start
```

If successful:

* The Discord bot will come online and post a startup message
* The Minecraft client will connect and begin relaying chat

---

## 💬 Discord Commands

All commands must be sent in the configured Discord channel.

### Send chat to Minecraft

```
!mc say Hello from Discord!
```

### Run a Minecraft command

```
!mc cmd /list
```

> ⚠️ **Security note**: `!mc cmd` is powerful and should be restricted to admins/roles in production.

---

## 🔐 Security Notes

* Never commit your `.env` file
* Always use a dedicated Minecraft account
* Restrict command access by Discord role or user ID
* Rate-limit commands to avoid server kicks
* Follow the rules of the Minecraft server you connect to

---

## 🛣️ Roadmap / Ideas

* Slash command support (`/mc`)
* Role-based permissions
* Command rate limiting
* Chat formatting & color stripping
* Multi-server or multi-channel support
* Web dashboard or config file

---

## ⚠️ Disclaimer

MineCord uses an automated Minecraft client. Some servers may restrict or disallow client bots. Always ensure you have permission to use this software on a server.

---

## 📜 License

MIT License

---

Made with ❤️ for bridging blocks and bots.
