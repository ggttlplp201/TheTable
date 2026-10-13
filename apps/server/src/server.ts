import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import type { GameAdapter } from './game-adapter.js';
import { TelemetryRoomStoreAdapter, type MatchTelemetry } from './telemetry.js';
import { RoomRuntimeService, type RuntimeOptions } from './runtime.js';

export interface ServerOptions extends RuntimeOptions {
  origin?: string | string[];
  game?: GameAdapter;
  staticDirectory?: string;
}

export interface TableServer {
  app: express.Express;
  http: HttpServer;
  io: Server;
  runtime: RoomRuntimeService;
  /** Trusted in-process beta tooling only; never served over HTTP or Socket.IO. */
  exportAdminTelemetry(roomCode?: string): MatchTelemetry[];
  listen(port?: number, host?: string): Promise<string>;
  close(): Promise<void>;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value?.split(',')[0];
  return first?.trim();
}

/**
 * Accept configured cross-origin clients and the public same-origin host seen
 * through a trusted deployment proxy. The latter keeps generated preview URLs
 * usable without weakening direct WebSocket upgrade checks to allow all origins.
 */
export function isAllowedRequestOrigin(request: IncomingMessage, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) return true;

  const publicHost = firstHeaderValue(request.headers['x-forwarded-host']) ?? firstHeaderValue(request.headers.host);
  if (!publicHost) return false;

  try {
    return new URL(origin).host === publicHost;
  } catch {
    return false;
  }
}

export function createTableServer(options: ServerOptions = {}): TableServer {
  const origin = options.origin ?? 'http://localhost:5173';
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin, credentials: true }));
  app.use(express.json({ limit: '16kb' }));
  const http = createServer(app);
  const allowedOrigins = Array.isArray(origin) ? origin : [origin];
  const io = new Server(http, {
    cors: { origin, credentials: true },
    maxHttpBufferSize: 32_000,
    pingInterval: 25_000,
    pingTimeout: 60_000,
    // CORS alone does not gate a direct WebSocket upgrade.
    allowRequest: (request, done) => done(null, isAllowedRequestOrigin(request, allowedOrigins)),
  });
  const game = options.game ?? new TelemetryRoomStoreAdapter();
  const runtime = new RoomRuntimeService(io, game, options);
  app.get('/health/live', (_req, res) => res.json({ ok: true }));
  app.get('/health/ready', (_req, res) => res.status(runtime.ready ? 200 : 503).json({ ok: runtime.ready }));
  if (options.staticDirectory) {
    app.use(express.static(options.staticDirectory));
    app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: options.staticDirectory }));
  }
  return {
    app, http, io, runtime,
    exportAdminTelemetry: roomCode => game instanceof TelemetryRoomStoreAdapter ? game.telemetry.exportAdminTelemetry(roomCode) : [],
    async listen(port = 0, host = '127.0.0.1'): Promise<string> {
      await new Promise<void>((resolve, reject) => {
        http.once('error', reject);
        http.listen(port, host, () => { http.off('error', reject); resolve(); });
      });
      const address = http.address();
      if (!address || typeof address === 'string') throw new Error('Server did not bind a TCP port.');
      return `http://${host}:${address.port}`;
    },
    async close(): Promise<void> {
      await runtime.close();
      await new Promise<void>(resolve => io.close(() => resolve()));
    },
  };
}
