import { createApp } from "./app.js";
import { config } from "./config.js";
import { startScheduler } from "./scheduler.js";
import { log } from "./lib/audit.js";

const app = createApp();

app.listen(config.port, () => {
  log("info", `MediRemind API listening on http://localhost:${config.port}`);
  log(
    "info",
    `Session store: in-memory (development). NODE_ENV=${config.nodeEnv}`
  );
  startScheduler();
});
