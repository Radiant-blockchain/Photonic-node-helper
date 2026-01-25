import { Router } from "express";
import { createHmac } from "crypto";
import { AvianRpcClient } from "../rpc/avianRpc.js";
import { logger } from "../utils/logger.js";

export function discordRouter() {
    const r = Router();

    const VERIFY_URL = process.env.DISCORD_VERIFY_URL;
    const VERIFY_SECRET = process.env.DISCORD_VERIFY_SECRET;
    const REQUIRED_UPTIME = 7 * 24 * 60 * 60; // 7 days

    // Check eligibility without verifying
    r.get("/eligibility", async (_req, res, next) => {
        try {
            const rpc = new AvianRpcClient();
            const [chain, uptime] = await Promise.all([
                rpc.call<any>("getblockchaininfo"),
                rpc.call<number>("uptime").catch(() => 0)
            ]);

            const blocks = chain?.blocks ?? 0;
            const headers = chain?.headers ?? 0;
            const isSynced = headers > 0 && blocks >= headers - 1;
            const hasUptime = uptime >= REQUIRED_UPTIME;
            const eligible = isSynced && hasUptime;

            res.json({
                eligible,
                synced: isSynced,
                blocks,
                headers,
                uptime,
                requiredUptime: REQUIRED_UPTIME,
                uptimeDays: Math.floor(uptime / 86400),
                requiredDays: 7,
                configured: !!(VERIFY_URL && VERIFY_SECRET)
            });
        } catch (e) {
            next(e);
        }
    });

    // Verify and claim role
    r.post("/verify", async (req, res, next) => {
        try {
            const { discordId } = req.body;

            if (!discordId || !/^\d{17,20}$/.test(discordId)) {
                return res.status(400).json({ error: "Invalid Discord ID format" });
            }

            if (!VERIFY_URL || !VERIFY_SECRET) {
                return res.status(503).json({
                    error: "Discord verification not configured",
                    message: "Set DISCORD_VERIFY_URL and DISCORD_VERIFY_SECRET in .env"
                });
            }

            // Get node status
            const rpc = new AvianRpcClient();
            const [chain, uptime] = await Promise.all([
                rpc.call<any>("getblockchaininfo"),
                rpc.call<number>("uptime").catch(() => 0)
            ]);

            const blocks = chain?.blocks ?? 0;
            const headers = chain?.headers ?? 0;
            const blockHash = chain?.bestblockhash ?? "";

            // Check eligibility locally first
            const isSynced = headers > 0 && blocks >= headers - 1;
            if (!isSynced) {
                return res.status(400).json({
                    error: "not_synced",
                    message: `Node not fully synced (${blocks.toLocaleString()}/${headers.toLocaleString()})`,
                    blocks,
                    headers
                });
            }

            if (uptime < REQUIRED_UPTIME) {
                const daysHave = Math.floor(uptime / 86400);
                const daysNeed = 7 - daysHave;
                return res.status(400).json({
                    error: "insufficient_uptime",
                    message: `Need ${daysNeed} more day(s) of uptime (currently ${daysHave} days)`,
                    uptime,
                    required: REQUIRED_UPTIME
                });
            }

            // Create signed payload
            const timestamp = Math.floor(Date.now() / 1000);
            const payload = `${discordId}:${blocks}:${uptime}:${blockHash}:${timestamp}`;
            const signature = createHmac("sha256", VERIFY_SECRET)
                .update(payload)
                .digest("hex");

            // Send to verification worker
            const verifyResponse = await fetch(VERIFY_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    discordId,
                    blocks,
                    headers,
                    uptime,
                    blockHash,
                    timestamp,
                    signature
                })
            });

            const result = await verifyResponse.json();

            if (!verifyResponse.ok) {
                logger.warn({ discordId, result }, "Discord verification failed");
                return res.status(verifyResponse.status).json(result);
            }

            logger.info({ discordId, blocks, uptime }, "Discord role assigned");
            res.json(result);

        } catch (e) {
            next(e);
        }
    });

    return r;
}
