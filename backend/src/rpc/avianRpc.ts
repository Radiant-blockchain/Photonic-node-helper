import type { JsonRpcRequest, JsonRpcResponse } from "./rpcTypes.js";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export class AvianRpcClient {
  private host = process.env.AVIAN_RPC_HOST ?? "127.0.0.1";
  private port = Number(process.env.AVIAN_RPC_PORT ?? "8766");
  private user = requiredEnv("AVIAN_RPC_USER");
  private pass = requiredEnv("AVIAN_RPC_PASS");

  private get url(): string {
    return `http://${this.host}:${this.port}/`;
  }

  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const req: JsonRpcRequest = {
      jsonrpc: "1.0",
      id: "avian-node-helper",
      method,
      params
    };

    const auth = Buffer.from(`${this.user}:${this.pass}`).toString("base64");

    const r = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Basic ${auth}`
      },
      body: JSON.stringify(req)
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`RPC HTTP ${r.status}: ${text}`);
    }

    const data = (await r.json()) as JsonRpcResponse<T>;
    if (data.error) throw new Error(`RPC error ${data.error.code}: ${data.error.message}`);
    return data.result as T;
  }
}
