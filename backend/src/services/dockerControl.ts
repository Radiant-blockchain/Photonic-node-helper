/**
 * Optional: container control using Docker Engine API over a mounted Unix socket.
 * This is OFF by default. Enable by setting:
 *   ENABLE_DOCKER_CONTROL=1
 * and mounting the socket into backend container:
 *   - /var/run/docker.sock:/var/run/docker.sock
 */
import { logger } from "../utils/logger.js";

function enabled(): boolean {
  return (process.env.ENABLE_DOCKER_CONTROL ?? "0") === "1";
}

function containerName(): string {
  return process.env.RADIANT_CONTAINER_NAME ?? "radiantd";
}

async function dockerPost(path: string): Promise<void> {
  const sockPath = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
  const url = `http://localhost${path}`;

  // Node fetch doesn't support unix sockets directly; use undici dispatcher? Keep boilerplate simple:
  // We'll call Docker via `curl` if available.
  const { spawn } = await import("node:child_process");

  await new Promise<void>((resolve, reject) => {
    const args = ["--unix-socket", sockPath, "-X", "POST", url];
    const p = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));

    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`docker control failed (curl exit ${code}): ${stderr}`));
    });
  });
}

export async function dockerStart(): Promise<{ ok: boolean; note?: string }> {
  if (!enabled()) return { ok: false, note: "Docker control disabled" };
  const name = containerName();
  logger.info({ name }, "dockerStart");
  await dockerPost(`/containers/${encodeURIComponent(name)}/start`);
  return { ok: true };
}

export async function dockerStop(): Promise<{ ok: boolean; note?: string }> {
  if (!enabled()) return { ok: false, note: "Docker control disabled" };
  const name = containerName();
  logger.info({ name }, "dockerStop");
  await dockerPost(`/containers/${encodeURIComponent(name)}/stop`);
  return { ok: true };
}

export async function dockerRestart(): Promise<{ ok: boolean; note?: string }> {
  if (!enabled()) return { ok: false, note: "Docker control disabled" };
  const name = containerName();
  logger.info({ name }, "dockerRestart");
  await dockerPost(`/containers/${encodeURIComponent(name)}/restart`);
  return { ok: true };
}
