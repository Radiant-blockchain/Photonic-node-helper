import { RadiantRpcClient } from "../rpc/radiantRpc.js";

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
    relayfee?: number;
    localservices?: string;
    localaddresses?: Array<{ address: string; port: number; score: number }>;
  };
  peers?: {
    count: number;
    inbound: number;
    outbound: number;
  };
  mining?: {
    blocks: number;
    difficulty: number;
    networkhashps: number;
    pooledtx: number;
  };
  uptime?: number;
};

export async function getNodeStatus(rpc = new RadiantRpcClient()): Promise<NodeStatus> {
  const [chain, network, peers, mining, uptime] = await Promise.all([
    rpc.call<any>("getblockchaininfo"),
    rpc.call<any>("getnetworkinfo"),
    rpc.call<any[]>("getpeerinfo"),
    rpc.call<any>("getmininginfo").catch(() => undefined),
    rpc.call<number>("uptime").catch(() => undefined)
  ]);

  const inbound = Array.isArray(peers) ? peers.filter(p => p.inbound).length : 0;
  const outbound = Array.isArray(peers) ? peers.filter(p => !p.inbound).length : 0;

  return {
    chain: chain ? {
      chain: chain.chain,
      blocks: chain.blocks,
      headers: chain.headers,
      bestblockhash: chain.bestblockhash,
      difficulty: chain.difficulty,
      verificationprogress: chain.verificationprogress,
      size_on_disk: chain.size_on_disk,
      pruned: chain.pruned
    } : undefined,
    network: network ? {
      version: network.version,
      subversion: network.subversion,
      protocolversion: network.protocolversion,
      connections: network.connections,
      relayfee: network.relayfee,
      localservices: network.localservices,
      localaddresses: network.localaddresses
    } : undefined,
    peers: {
      count: Array.isArray(peers) ? peers.length : 0,
      inbound,
      outbound
    },
    mining: mining ? {
      blocks: mining.blocks,
      difficulty: mining.difficulty,
      networkhashps: mining.networkhashps,
      pooledtx: mining.pooledtx
    } : undefined,
    uptime
  };
}
