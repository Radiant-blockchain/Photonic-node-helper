import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./utils/logger.js";
import { statusRouter } from "./routes/status.js";
import { rpcRouter } from "./routes/rpc.js";
import { controlRouter } from "./routes/control.js";
import { logsRouter } from "./routes/logs.js";
import { discordRouter } from "./routes/discord.js";
import { AvianRpcClient } from "./rpc/avianRpc.js";

export function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  app.use(cors({ origin: corsOrigin }));

  app.use(pinoHttp({ logger }));

  // Health check endpoint for container orchestration
  app.get("/healthz", async (_req, res) => {
    try {
      const rpc = new AvianRpcClient();
      const info = await rpc.call<any>("getblockchaininfo");
      const synced = info?.headers > 0 && info?.blocks >= info?.headers - 1;
      res.json({
        ok: true,
        node: "connected",
        chain: info?.chain,
        blocks: info?.blocks,
        headers: info?.headers,
        synced
      });
    } catch {
      res.status(503).json({ ok: false, node: "unavailable" });
    }
  });

  app.use("/status", statusRouter());
  app.use("/rpc", rpcRouter());
  app.use("/control", controlRouter());
  app.use("/logs", logsRouter());
  app.use("/discord", discordRouter());

  // 404
  app.use((_req, res) => res.status(404).json({ error: "not_found" }));

  // error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, "unhandled_error");
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
