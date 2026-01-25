# Avian Node Helper

A simple web UI for running and monitoring an **Avian blockchain node** using Docker.

![Screenshot](docs/screenshot.png)

## Features

- 🟢 **Live node status** — chain info, peers, mempool, uptime
- ⛏️ **Mining info** — dual-algo (X16RT + MinotaurX) hashrate and difficulty
- 🔧 **RPC commands** — run whitelisted commands from the UI
- 🐳 **Docker control** — start/stop/restart the node (optional)
- 📜 **Debug log viewer** — tail the node's log in real-time (optional)
- 🎖️ **Discord roles** — claim "Node Operator" (7d) and "Elite Node Operator" (90d) roles

---

## Requirements

- **Docker** and **Docker Compose**
  - Windows/macOS: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - Linux: Install [Docker Engine](https://docs.docker.com/engine/install/)

---

## Quick Start

### 1. Download `aviand`

Download the latest **Linux** release from:  
👉 **https://github.com/AvianNetwork/Avian/releases**

Extract and copy the `aviand` binary to:

```
./aviand/aviand
```

> ⚠️ You need the **Linux** binary, not Windows — Docker runs Linux containers.

### 2. Configure

Copy the example environment file:

```bash
# Linux / macOS / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env

# Windows CMD
copy .env.example .env
```

Edit `.env` and change the RPC password:

```env
AVIAN_RPC_PASS=your_secure_password_here
```

### 3. Start

```bash
docker compose up --build -d
```

### 4. Open the UI

- **UI:** http://localhost:3000
- **API:** http://localhost:3001/status

That's it! 🎉

---

## Configuration Options

Edit `.env` to customize:

| Variable                | Default     | Description                                              |
| ----------------------- | ----------- | -------------------------------------------------------- |
| `AVIAN_RPC_USER`        | `avianrpc`  | RPC username                                             |
| `AVIAN_RPC_PASS`        | `change_me` | RPC password (**change this!**)                          |
| `AVIAN_UPNP`            | `0`         | Set to `1` for automatic port forwarding (inbound peers) |
| `AVIAN_DISABLE_WALLET`  | `1`         | Set to `0` to enable wallet RPC commands                 |
| `ENABLE_DOCKER_CONTROL` | `0`         | Set to `1` to enable start/stop/restart buttons          |
| `ENABLE_LOG_VIEW`       | `0`         | Set to `1` to enable debug log viewer                    |

---

## Optional: Enable Docker Control

To start/stop/restart the node from the UI:

1. In `.env`, set:

   ```env
   ENABLE_DOCKER_CONTROL=1
   ```

2. The Docker socket mount is already configured in `docker-compose.yml`

3. Restart:
   ```bash
   docker compose up -d
   ```

---

## Ports

| Port | Service                     |
| ---- | --------------------------- |
| 3000 | Web UI                      |
| 3001 | Backend API                 |
| 7895 | Avian P2P (blockchain sync) |
| 7896 | Avian RPC (internal only)   |

---

## Updating

Pull latest code and rebuild:

```bash
git pull
docker compose up --build -d
```

---

## Troubleshooting

**Node won't start?**

- Check the `aviand` binary is the Linux version (not Windows `.exe`)
- On Linux/macOS, ensure it's executable: `chmod +x ./aviand/aviand`

**No inbound connections?**

- Set `AVIAN_UPNP=1` in `.env` and restart
- Or manually forward port `7895` on your router

**RPC errors?**

- Verify `AVIAN_RPC_PASS` matches in `.env`

**Docker issues on Windows?**

- Make sure Docker Desktop is running
- Enable WSL 2 backend in Docker Desktop settings

---

## Discord Node Operator Roles

Node operators can claim Discord roles based on uptime:

| Role                    | Requirement                  |
| ----------------------- | ---------------------------- |
| **Node Operator**       | Synced node + 7 days uptime  |
| **Elite Node Operator** | Synced node + 90 days uptime |

Users keep both roles as they progress — they're cumulative achievements!

### Setup (Server Admins)

1. Create a Discord bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable "Manage Roles" permission and add bot to your server
3. Create the roles in Discord:
   - "Node Operator" (for 7-day operators)
   - "Elite Node Operator" (for 90-day veterans)
   - **Important:** Bot's role must be above both roles in the hierarchy
4. Deploy the verification worker (see `discord-worker/README.md`)
5. Set secrets in your worker:
   ```bash
   wrangler secret put DISCORD_BOT_TOKEN
   wrangler secret put DISCORD_GUILD_ID
   wrangler secret put DISCORD_ROLE_ID           # Node Operator role ID
   wrangler secret put DISCORD_ROLE_ID_ELITE     # Elite Node Operator role ID
   wrangler secret put VERIFY_SECRET
   ```
6. Add to your `.env`:
   ```env
   DISCORD_VERIFY_URL=https://your-worker.workers.dev/verify
   DISCORD_VERIFY_SECRET=your_shared_secret
   ```

### Usage (Node Operators)

1. Run your node (synced) for 7+ days → claim **Node Operator** role
2. Keep running for 90+ days → claim **Elite Node Operator** role
3. Get your Discord User ID (Enable Developer Mode → Right-click name → Copy User ID)
4. Enter your ID in the UI and click "Verify & Claim"

> 💡 At 90 days, you'll receive both roles if you don't already have them!

---

## Development

For local development without Docker:

```bash
# Backend
cd backend && npm i && npm run dev

# Frontend (separate terminal)
cd frontend && npm i && npm run dev
```

---

## Links

- [Avian Network](https://avn.network)
- [Avian Releases](https://github.com/AvianNetwork/Avian/releases)
- [Avian GitHub](https://github.com/AvianNetwork/Avian)
