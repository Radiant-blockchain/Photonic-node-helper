import { config as loadEnv } from "dotenv";
loadEnv();

import { buildApp } from "./server.js";
import { logger } from "./utils/logger.js";

const port = Number(process.env.PORT ?? "3001");
const app = buildApp();

app.listen(port, () => {
  logger.info({ port }, "backend listening");
});
