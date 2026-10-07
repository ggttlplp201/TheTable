import { resolve } from 'node:path';
import { createTableServer } from './server.js';
import { parseVoiceIceServers } from './voice-config.js';

const server = createTableServer({
  origin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map(value => value.trim()),
  voiceEnabled: process.env.VOICE_ENABLED === 'true',
  voiceIceServers: parseVoiceIceServers(process.env.VOICE_ICE_SERVERS),
  ...(process.env.STATIC_DIRECTORY ? { staticDirectory: resolve(process.env.STATIC_DIRECTORY) } : {}),
});
await server.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '0.0.0.0');
console.log(`The Table server listening on :${process.env.PORT ?? 3001}`);
let closing = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => {
  if (closing) return;
  closing = true;
  void server.close().catch(error => { console.error(error); process.exitCode = 1; });
});
