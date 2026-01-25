import { Router } from "express";
import { z } from "zod";
import { dockerRestart, dockerStart, dockerStop } from "../services/dockerControl.js";
import { AvianRpcClient } from "../rpc/avianRpc.js";

export function controlRouter() {
  const r = Router();

  // Container control (optional)
  r.post("/start", async (_req, res, next) => {
    try {
      const out = await dockerStart();
      res.json(out);
    } catch (e) { next(e); }
  });

  r.post("/stop", async (_req, res, next) => {
    try {
      const out = await dockerStop();
      res.json(out);
    } catch (e) { next(e); }
  });

  r.post("/restart", async (_req, res, next) => {
    try {
      const out = await dockerRestart();
      res.json(out);
    } catch (e) { next(e); }
  });

  // RPC stop (works even without docker control, but requires RPC reachable)
  r.post("/rpc-stop", async (_req, res, next) => {
    try {
      const rpc = new AvianRpcClient();
      await rpc.call("stop", []);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // Run a host script (mounted read-only). Only allows known scripts.
  const ScriptSchema = z.object({ name: z.enum(["healthcheck.sh"]) });

  r.post("/script", async (req, res, next) => {
    try {
      const { name } = ScriptSchema.parse(req.body);
      const { spawn } = await import("node:child_process");
      const path = `/app/scripts/${name}`;

      const output = await new Promise<string>((resolve, reject) => {
        const p = spawn("sh", [path], { env: process.env });
        let out = "";
        let err = "";
        p.stdout.on("data", d => out += d.toString());
        p.stderr.on("data", d => err += d.toString());
        p.on("close", code => {
          if (code === 0) return resolve(out.trim());
          reject(new Error(`script failed (${code}): ${err}`));
        });
      });

      res.json({ ok: true, output });
    } catch (e) { next(e); }
  });

  return r;
}
