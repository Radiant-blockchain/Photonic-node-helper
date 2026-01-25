export type NodeStatus = {
  chain?: {
    chain: string;
    blocks: number;
    headers: number;
    bestblockhash: string;
    difficulty?: number;
    verificationprogress?: number;
    size_on_disk?: number;
    pruned?: boolean;
  };
  network?: {
    version: number;
    subversion: string;
    protocolversion: number;
    connections: number;
  };
  peers?: { count: number; inbound: number; outbound: number };
  mining?: {
    blocks: number;
    difficulty_x16rt: number;
    difficulty_minotaurx: number;
    networkhashps_x16rt: number;
    networkhashps_minotaurx: number;
    pooledtx: number;
  };
  uptime?: number;
};

export const API_BASE = ((import.meta as any).env?.VITE_API_BASE as string | undefined) || "http://localhost:3001";

export async function getStatus(): Promise<NodeStatus> {
  const r = await fetch(`${API_BASE}/status`);
  if (!r.ok) throw new Error(`status HTTP ${r.status}`);
  return r.json();
}

export async function rpcCall(method: string, params: unknown[] = []): Promise<any> {
  const r = await fetch(`${API_BASE}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error ?? `rpc HTTP ${r.status}`);
  return data.result;
}

export async function control(action: "start" | "stop" | "restart" | "rpc-stop"): Promise<any> {
  const r = await fetch(`${API_BASE}/control/${action}`, { method: "POST" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error ?? `control HTTP ${r.status}`);
  return data;
}

export type DebugLogTail = {
  ok: true;
  path: string;
  size: number;
  mtimeMs: number;
  tail: string;
};

export async function getDebugLogTail(tailLines = 400): Promise<DebugLogTail> {
  const url = new URL(`${API_BASE}/logs/debug`);
  url.searchParams.set("tail", String(tailLines));
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error ?? `logs HTTP ${r.status}`);
  return data as DebugLogTail;
}

export function streamDebugLog(
  onData: (text: string) => void,
  onError: (err: unknown) => void,
  tailLines = 200
): () => void {
  const url = new URL(`${API_BASE}/logs/debug/stream`);
  url.searchParams.set("tail", String(tailLines));

  const es = new EventSource(url.toString());
  es.onmessage = (ev) => {
    onData(ev.data);
  };
  es.onerror = (e) => {
    onError(e);
  };

  return () => es.close();
}

// Discord verification
export type DiscordEligibility = {
  eligible: boolean;
  eligibleElite: boolean;
  synced: boolean;
  blocks: number;
  headers: number;
  uptime: number;
  requiredUptime: number;
  requiredUptimeElite: number;
  uptimeDays: number;
  requiredDays: number;
  requiredDaysElite: number;
  configured: boolean;
};

export async function getDiscordEligibility(): Promise<DiscordEligibility> {
  const r = await fetch(`${API_BASE}/discord/eligibility`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error ?? `discord HTTP ${r.status}`);
  return data as DiscordEligibility;
}

export type DiscordRoleCheck = {
  hasRole: boolean;
  hasEliteRole: boolean;
  inServer: boolean;
  configured: boolean;
  message?: string;
};

export async function checkDiscordRole(discordId: string): Promise<DiscordRoleCheck> {
  const r = await fetch(`${API_BASE}/discord/check-role?discordId=${encodeURIComponent(discordId)}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error ?? `check-role HTTP ${r.status}`);
  return data as DiscordRoleCheck;
}

export async function verifyDiscord(discordId: string): Promise<{ success: boolean; message: string }> {
  const r = await fetch(`${API_BASE}/discord/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ discordId })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.message ?? data?.error ?? `verify HTTP ${r.status}`);
  }
  return data;
}
