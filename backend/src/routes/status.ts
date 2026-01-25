import { Router } from "express";
import { getNodeStatus } from "../services/nodeStatus.js";

export function statusRouter() {
  const r = Router();

  r.get("/", async (_req, res, next) => {
    try {
      const status = await getNodeStatus();
      res.json(status);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
