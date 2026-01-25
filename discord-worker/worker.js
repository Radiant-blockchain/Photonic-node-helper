/**
 * Avian Node Operator Verification Worker
 *
 * Deploy to Cloudflare Workers. Set these secrets:
 *   - DISCORD_BOT_TOKEN: Your Discord bot token
 *   - DISCORD_GUILD_ID: 904209882947932160
 *   - DISCORD_ROLE_ID: The "Node Operator" role ID
 *   - VERIFY_SECRET: A shared secret for HMAC verification
 *
 * Endpoint: POST /verify
 */

const REQUIRED_UPTIME_SECONDS = 7 * 24 * 60 * 60; // 7 days

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/verify" && request.method === "POST") {
      return handleVerify(request, env);
    }

    if (url.pathname === "/status" && request.method === "GET") {
      return jsonResponse({ ok: true, service: "avian-node-verify" });
    }

    return jsonResponse({ error: "not_found" }, 404);
  },
};

async function handleVerify(request, env) {
  try {
    const body = await request.json();
    const {
      discordId,
      blocks,
      headers,
      uptime,
      blockHash,
      timestamp,
      signature,
    } = body;

    // Validate required fields
    if (
      !discordId ||
      !blocks ||
      !uptime ||
      !blockHash ||
      !timestamp ||
      !signature
    ) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    // Validate timestamp (must be within last 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      return jsonResponse(
        { error: "request_expired", message: "Timestamp too old or in future" },
        400,
      );
    }

    // Verify HMAC signature
    const payload = `${discordId}:${blocks}:${uptime}:${blockHash}:${timestamp}`;
    const expectedSig = await hmacSha256(env.VERIFY_SECRET, payload);
    if (signature !== expectedSig) {
      return jsonResponse({ error: "invalid_signature" }, 403);
    }

    // Check eligibility
    if (headers > 0 && blocks < headers - 1) {
      return jsonResponse(
        {
          error: "not_synced",
          message: `Node not fully synced (${blocks}/${headers})`,
        },
        400,
      );
    }

    if (uptime < REQUIRED_UPTIME_SECONDS) {
      const daysNeeded = Math.ceil((REQUIRED_UPTIME_SECONDS - uptime) / 86400);
      return jsonResponse(
        {
          error: "insufficient_uptime",
          message: `Need ${daysNeeded} more day(s) of uptime`,
          uptime,
          required: REQUIRED_UPTIME_SECONDS,
        },
        400,
      );
    }

    // Optional: Verify block hash against public explorer
    // const explorerValid = await verifyBlockWithExplorer(blockHash, blocks);
    // if (!explorerValid) {
    //   return jsonResponse({ error: "block_mismatch" }, 400);
    // }

    // Assign Discord role
    const discordResult = await assignDiscordRole(env, discordId);
    if (!discordResult.success) {
      return jsonResponse(
        {
          error: "discord_error",
          message: discordResult.message,
        },
        500,
      );
    }

    // Store verification (optional: use KV for tracking)
    // await env.VERIFICATIONS.put(discordId, JSON.stringify({ verified: now, blocks, uptime }));

    return jsonResponse({
      success: true,
      message: "Node Operator role assigned!",
      discordId,
    });
  } catch (e) {
    console.error("Verify error:", e);
    return jsonResponse({ error: "internal_error", message: e.message }, 500);
  }
}

async function assignDiscordRole(env, userId) {
  const url = `https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${userId}/roles/${env.DISCORD_ROLE_ID}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 204 || response.status === 200) {
    return { success: true };
  }

  // Handle common errors
  if (response.status === 404) {
    return {
      success: false,
      message:
        "User not found in Discord server. Make sure you've joined the Avian Discord.",
    };
  }
  if (response.status === 403) {
    return {
      success: false,
      message: "Bot lacks permission to assign this role.",
    };
  }

  const errorBody = await response.text();
  console.error("Discord API error:", response.status, errorBody);
  return { success: false, message: `Discord API error: ${response.status}` };
}

async function hmacSha256(secret, message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, msgData);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}
