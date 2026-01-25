export type JsonRpcRequest = {
  jsonrpc?: "1.0" | "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown[];
};

export type JsonRpcResponse<T = unknown> = {
  result?: T;
  error?: { code: number; message: string } | null;
  id?: string | number | null;
};
