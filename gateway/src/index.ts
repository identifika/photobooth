import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { closeDispatcher } from './http.js';

const config = loadConfig();
const app = createApp(config);

const server = serve({
  fetch: app.fetch,
  port: config.port,
  hostname: config.host,
}, (info) => {
  console.log(`photobooth-gateway listening on http://${info.address}:${info.port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await closeDispatcher();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
