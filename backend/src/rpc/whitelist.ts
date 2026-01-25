/**
 * UI-safe RPC allowlist.
 * 
 * Configuration via environment variables:
 * - RPC_ALLOWLIST_ONLY: If set, ONLY these commands are allowed (comma-separated). Overrides defaults.
 * - RPC_ALLOWLIST_EXTRA: Additional commands to allow on top of defaults (comma-separated).
 * 
 * Examples:
 *   RPC_ALLOWLIST_EXTRA=getrawtransaction,decoderawtransaction
 *   RPC_ALLOWLIST_ONLY=getblockchaininfo,getnetworkinfo,uptime
 */

const DEFAULT_ALLOWLIST = [
  "help",
  // Chain
  "getblockchaininfo",
  "getbestblockhash",
  "getblock",
  "getblockhash",
  "getblockcount",
  "getchaintips",
  "getdifficulty",
  // Network
  "getnetworkinfo",
  "getpeerinfo",
  "getnettotals",
  "getconnectioncount",
  "ping",
  // Mempool
  "getmempoolinfo",
  "getrawmempool",
  // Mining
  "getmininginfo",
  // UTXO / Wallet
  "gettxoutsetinfo",
  "validateaddress",
  // Misc
  "uptime",
  "getmemoryinfo",
  // Control (optional - can be removed via RPC_ALLOWLIST_ONLY for stricter setups)
  "stop"
];

function buildAllowlist(): Set<string> {
  const onlyEnv = process.env.RPC_ALLOWLIST_ONLY?.trim();

  // If ONLY is set, use exclusively those commands
  if (onlyEnv) {
    const commands = onlyEnv.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    console.log(`[RPC] Using strict allowlist from RPC_ALLOWLIST_ONLY: ${commands.join(", ")}`);
    return new Set(commands);
  }

  // Start with defaults
  const allowlist = new Set(DEFAULT_ALLOWLIST);

  // Add extras if specified
  const extraEnv = process.env.RPC_ALLOWLIST_EXTRA?.trim();
  if (extraEnv) {
    const extras = extraEnv.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    extras.forEach(cmd => allowlist.add(cmd));
    console.log(`[RPC] Added extra commands from RPC_ALLOWLIST_EXTRA: ${extras.join(", ")}`);
  }

  return allowlist;
}

export const RPC_ALLOWLIST = buildAllowlist();

export function isAllowedMethod(method: string): boolean {
  return RPC_ALLOWLIST.has(method.toLowerCase());
}
