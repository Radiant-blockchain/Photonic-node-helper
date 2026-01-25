# Avian Node Operator Discord Verification Worker

A Cloudflare Worker that verifies node operators and assigns Discord roles.

## Setup

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → Name it "Avian Node Verifier"
3. Go to "Bot" tab → Click "Add Bot"
4. Copy the **Bot Token** (keep this secret!)
5. Under "Privileged Gateway Intents", enable **Server Members Intent**
6. Go to "OAuth2" → "URL Generator"
   - Scopes: `bot`
   - Bot Permissions: `Manage Roles`
7. Copy the URL and open it to invite the bot to your server

### 2. Get Role ID

1. In Discord, enable Developer Mode (Settings → Advanced → Developer Mode)
2. Right-click the "Node Operator" role → Copy ID
3. **Important:** Make sure the bot's role is ABOVE "Node Operator" in the role hierarchy

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
# Enter: 904209882947932160

wrangler secret put DISCORD_ROLE_ID
# Paste the role ID from step 2

wrangler secret put VERIFY_SECRET
# Paste the secret from step 3

# Deploy
wrangler deploy
```

### 5. Configure Node Helper

Add to your `.env` file:

```env
DISCORD_VERIFY_URL=https://avian-node-verify.<your-account>.workers.dev/verify
DISCORD_VERIFY_SECRET=<same secret from step 3>
```

### 6. Optional: Custom Domain

In Cloudflare dashboard:

1. Go to Workers & Pages → your worker
2. Settings → Triggers → Custom Domains
3. Add `verify.avn.network` (or whatever subdomain)

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
  "message": "Node Operator role assigned!",
  "discordId": "123456789012345678"
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
- Node must have **7+ days uptime**
- User must be a **member of the Discord server**
- Request must be signed with the shared secret
