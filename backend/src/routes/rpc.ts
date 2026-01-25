import { Router } from "express";
import { z } from "zod";
import { AvianRpcClient } from "../rpc/avianRpc.js";
import { isAllowedMethod } from "../rpc/whitelist.js";

const BodySchema = z.object({
  method: z.string().min(1),
  params: z.array(z.any()).optional().default([])
});

export function rpcRouter() {
  const r = Router();
  const rpc = new AvianRpcClient();

  r.post("/", async (req, res, next) => {
    try {
      const body = BodySchema.parse(req.body);

      if (!isAllowedMethod(body.method)) {
        return res.status(403).json({ error: "method_not_allowed", method: body.method });
      }

      const result = await rpc.call(body.method, body.params);
      res.json({ ok: true, result });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
