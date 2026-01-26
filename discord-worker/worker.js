/**
 * Radiant Node Operator Verification Worker
 *
 * Deploy to Cloudflare Workers. Set these secrets:
 *   - DISCORD_BOT_TOKEN: Your Discord bot token
 *   - DISCORD_GUILD_ID: Your Radiant Discord server ID
 *   - DISCORD_ROLE_ID: The "Node Operator" role ID (7 days)
 *   - DISCORD_ROLE_ID_ELITE: The "Elite Node Operator" role ID (90 days)
 *   - VERIFY_SECRET: A shared secret for HMAC verification
 *
 * Discord: https://discord.gg/radiantblockchain
 * Endpoint: POST /verify
 */

const REQUIRED_UPTIME_SECONDS = 7 * 24 * 60 * 60; // 7 days
const REQUIRED_UPTIME_ELITE = 90 * 24 * 60 * 60; // 90 days

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

    if (url.pathname === "/check-role" && request.method === "GET") {
      return handleCheckRole(url, env);
    }

    if (url.pathname === "/status" && request.method === "GET") {
      return jsonResponse({ ok: true, service: "radiant-node-verify" });
    }

    return jsonResponse({ error: "not_found" }, 404);
  },
};

async function handleCheckRole(url, env) {
  const discordId = url.searchParams.get("discordId");

  if (!discordId || !/^\d{17,20}$/.test(discordId)) {
    return jsonResponse({ error: "invalid_discord_id" }, 400);
  }

  const roles = await checkUserRoles(env, discordId);

  if (roles === null) {
    return jsonResponse({
      hasRole: false,
      hasEliteRole: false,
      inServer: false,
      message: "User not found in Discord server",
    });
  }

  return jsonResponse({
    hasRole: roles.hasRole,
    hasEliteRole: roles.hasEliteRole,
    inServer: true,
    message: roles.hasEliteRole
      ? "User has Elite Node Operator role"
      : roles.hasRole
        ? "User has Node Operator role"
        : "User does not have any Node Operator roles",
  });
}

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

    // Determine which tier(s) user is eligible for
    const eligibleForBasic = uptime >= REQUIRED_UPTIME_SECONDS;
    const eligibleForElite = uptime >= REQUIRED_UPTIME_ELITE;

    if (!eligibleForBasic) {
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

    // Check which roles user already has
    const currentRoles = await checkUserRoles(env, discordId);
    if (currentRoles === null) {
      return jsonResponse(
        {
          error: "user_not_found",
          message:
            "User not found in Discord server. Make sure you've joined the Radiant Discord (discord.gg/radiantblockchain).",
        },
        404,
      );
    }

    // Track what we'll assign
    const rolesToAssign = [];
    const rolesAssigned = [];

    // Assign basic role if eligible and doesn't have it
    if (eligibleForBasic && !currentRoles.hasRole) {
      rolesToAssign.push({ id: env.DISCORD_ROLE_ID, name: "Node Operator" });
    }

    // Assign elite role if eligible, configured, and doesn't have it
    if (
      eligibleForElite &&
      env.DISCORD_ROLE_ID_ELITE &&
      !currentRoles.hasEliteRole
    ) {
      rolesToAssign.push({
        id: env.DISCORD_ROLE_ID_ELITE,
        name: "Elite Node Operator",
      });
    }

    // If already has all eligible roles
    if (rolesToAssign.length === 0) {
      const hasAll =
        currentRoles.hasEliteRole ||
        (currentRoles.hasRole && !eligibleForElite);
      return jsonResponse({
        success: true,
        message: hasAll
          ? "You already have all eligible roles!"
          : "You already have the Node Operator role!",
        discordId,
        alreadyHadRole: true,
        hasRole: currentRoles.hasRole,
        hasEliteRole: currentRoles.hasEliteRole,
      });
    }

    // Assign each role
    for (const role of rolesToAssign) {
      const result = await assignDiscordRole(env, discordId, role.id);
      if (result.success) {
        rolesAssigned.push(role.name);
      } else {
        console.error(`Failed to assign ${role.name}:`, result.message);
      }
    }

    if (rolesAssigned.length === 0) {
      return jsonResponse(
        {
          error: "discord_error",
          message: "Failed to assign roles. Bot may lack permissions.",
        },
        500,
      );
    }

    // Store verification (optional: use KV for tracking)
    // await env.VERIFICATIONS.put(discordId, JSON.stringify({ verified: now, blocks, uptime }));

    return jsonResponse({
      success: true,
      message: `${rolesAssigned.join(" + ")} role${rolesAssigned.length > 1 ? "s" : ""} assigned!`,
      discordId,
      rolesAssigned,
      hasRole: currentRoles.hasRole || rolesAssigned.includes("Node Operator"),
      hasEliteRole:
        currentRoles.hasEliteRole ||
        rolesAssigned.includes("Elite Node Operator"),
    });
  } catch (e) {
    console.error("Verify error:", e);
    return jsonResponse({ error: "internal_error", message: e.message }, 500);
  }
}

async function checkUserRoles(env, userId) {
  const url = `https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${userId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    },
  });

  if (response.status === 404) {
    return null; // User not in server
  }

  if (!response.ok) {
    console.error("Discord member lookup error:", response.status);
    return { hasRole: false, hasEliteRole: false };
  }

  const member = await response.json();
  return {
    hasRole: member.roles?.includes(env.DISCORD_ROLE_ID) ?? false,
    hasEliteRole: env.DISCORD_ROLE_ID_ELITE
      ? (member.roles?.includes(env.DISCORD_ROLE_ID_ELITE) ?? false)
      : false,
  };
}

async function assignDiscordRole(env, userId, roleId) {
  const url = `https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`;

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
        "User not found in Discord server. Make sure you've joined the Radiant Discord (discord.gg/radiantblockchain).",
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
