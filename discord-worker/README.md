# Radiant Node Operator Discord Verification Worker

A Cloudflare Worker that verifies Radiant node operators and assigns Discord roles.

**Discord Server:** https://discord.gg/radiantblockchain

## Roles

| Role                    | Requirement    |
| ----------------------- | -------------- |
| **Node Operator**       | 7 days uptime  |
| **Elite Node Operator** | 90 days uptime |

Users accumulate both roles as they progress.

## Setup

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → Name it "Radiant Node Verifier"
3. Go to "Bot" tab → Click "Add Bot"
4. Copy the **Bot Token** (keep this secret!)
5. Under "Privileged Gateway Intents", enable **Server Members Intent**
6. Go to "OAuth2" → "URL Generator"
   - Scopes: `bot`
   - Bot Permissions: `Manage Roles`
7. Copy the URL and open it to invite the bot to your server

### 2. Create & Get Role IDs

1. Create two roles in your Discord server:
   - **Node Operator** (for 7-day operators)
   - **Elite Node Operator** (for 90-day veterans)
2. Enable Developer Mode (Settings → Advanced → Developer Mode)
3. Right-click each role → Copy ID
4. **Important:** Make sure the bot's role is ABOVE both roles in the role hierarchy

### 3. Generate Verify Secret

Generate a random secret for HMAC signing:

```bash
openssl rand -hex 32
```

### 4. Deploy Worker

```bash
cd discord-worker

# Install Wrangler CLI if needed
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Set secrets
wrangler secret put DISCORD_BOT_TOKEN
# Paste your bot token

wrangler secret put DISCORD_GUILD_ID
# Enter your Radiant Discord server ID

wrangler secret put DISCORD_ROLE_ID
# Paste the "Node Operator" role ID

wrangler secret put DISCORD_ROLE_ID_ELITE
# Paste the "Elite Node Operator" role ID

wrangler secret put VERIFY_SECRET
# Paste the secret from step 3

# Deploy
wrangler deploy
```

### 5. Configure Node Helper

Add to your `.env` file:

```env
DISCORD_VERIFY_URL=https://radiant-node-verify.<your-account>.workers.dev/verify
DISCORD_VERIFY_SECRET=<same secret from step 3>
```

### 6. Optional: Custom Domain

In Cloudflare dashboard:

1. Go to Workers & Pages → your worker
2. Settings → Triggers → Custom Domains
3. Add `verify.radiantblockchain.org` (or whatever subdomain)

## API

### POST /verify

Verifies a node and assigns the Discord role.

**Request:**

```json
{
  "discordId": "123456789012345678",
  "blocks": 4557785,
  "headers": 4557785,
  "uptime": 604800,
  "blockHash": "000000000000123...",
  "timestamp": 1706100000,
  "signature": "hmac-sha256-hex"
}
```

**Response (success):**

```json
{
  "success": true,
  "message": "Node Operator + Elite Node Operator roles assigned!",
  "discordId": "123456789012345678",
  "rolesAssigned": ["Node Operator", "Elite Node Operator"],
  "hasRole": true,
  "hasEliteRole": true
}
```

**Response (error):**

```json
{
  "error": "insufficient_uptime",
  "message": "Need 3 more day(s) of uptime",
  "uptime": 345600,
  "required": 604800
}
```

## Requirements

- Node must be **fully synced** (blocks ≥ headers - 1)
- Node must have **7+ days uptime** for Node Operator role
- Node must have **90+ days uptime** for Elite Node Operator role
- User must be a **member of the Radiant Discord server** (discord.gg/radiantblockchain)
- Request must be signed with the shared secret

> 💡 At 90 days, users automatically receive both roles if they don't already have them!
