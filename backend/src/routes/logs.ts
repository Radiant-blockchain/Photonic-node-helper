import { Router, type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";

function isEnabled(): boolean {
    // Enabled by default for local use; set to 0 to disable.
    return (process.env.ENABLE_LOG_VIEW ?? "1") !== "0";
}

function logPath(): string {
    return process.env.AVIAND_DEBUG_LOG_PATH ?? "/data/debug.log";
}

function parseIntParam(v: unknown, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

async function readTail(file: string, tailLines: number, maxBytes: number): Promise<string> {
    const st = await fsp.stat(file);
    const size = st.size;
    const start = Math.max(0, size - maxBytes);

    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
        const rs = fs.createReadStream(file, { start, encoding: "utf8" });
        rs.on("data", (d: string | Buffer) => chunks.push(typeof d === "string" ? d : d.toString("utf8")));
        rs.on("error", reject);
        rs.on("end", () => resolve());
    });

    const text = chunks.join("");
    const lines = text.split(/\r?\n/);
    return lines.slice(Math.max(0, lines.length - tailLines)).join("\n");
}

function writeSse(res: Response, text: string) {
    const normalized = text.replace(/\r\n/g, "\n");
    for (const line of normalized.split("\n")) {
        res.write(`data: ${line}\n`);
    }
    res.write("\n");
}

export function logsRouter() {
    const r = Router();

    r.get("/debug", async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!isEnabled()) return res.status(404).json({ error: "not_found" });

            const file = logPath();
            const tailLines = Math.min(5000, Math.max(1, parseIntParam(req.query.tail, 400)));
            const maxBytes = Math.min(5 * 1024 * 1024, Math.max(4 * 1024, parseIntParam(req.query.maxBytes, 1024 * 1024)));

            const st = await fsp.stat(file);
            const tail = await readTail(file, tailLines, maxBytes);

            res.json({
                ok: true,
                path: file,
                size: st.size,
                mtimeMs: st.mtimeMs,
                tail
            });
        } catch (e: any) {
            if (e?.code === "ENOENT") return res.status(404).json({ error: "not_found" });
            next(e);
        }
    });

    r.get("/debug/stream", async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!isEnabled()) return res.status(404).end();

            const file = logPath();
            const tailLines = Math.min(5000, Math.max(1, parseIntParam(req.query.tail, 200)));
            const maxBytes = Math.min(5 * 1024 * 1024, Math.max(4 * 1024, parseIntParam(req.query.maxBytes, 1024 * 1024)));

            // SSE headers
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            (res as any).flushHeaders?.();

            // Initial tail
            try {
                const st = await fsp.stat(file);
                const tail = await readTail(file, tailLines, maxBytes);
                writeSse(res, tail);
                let offset = st.size;

                const timer = setInterval(async () => {
                    try {
                        const st2 = await fsp.stat(file);
                        if (st2.size < offset) offset = 0;
                        if (st2.size === offset) return;

                        // Cap per-tick read to avoid huge bursts
                        const end = st2.size - 1;
                        const start = Math.max(offset, st2.size - 256 * 1024);

                        const chunks: string[] = [];
                        await new Promise<void>((resolve, reject) => {
                            const rs = fs.createReadStream(file, { start, end, encoding: "utf8" });
                            rs.on("data", (d: string | Buffer) => chunks.push(typeof d === "string" ? d : d.toString("utf8")));
                            rs.on("error", reject);
                            rs.on("end", () => resolve());
                        });

                        offset = st2.size;
                        const text = chunks.join("");
                        writeSse(res, text);
                    } catch {
                        // ignore transient errors
                    }
                }, 1000);

                req.on("close", () => {
                    clearInterval(timer);
                });
            } catch (e: any) {
                if (e?.code === "ENOENT") {
                    writeSse(res, "debug.log not found");
                    return res.end();
                }
                throw e;
            }
        } catch (e) {
            next(e);
        }
    });

    return r;
}
