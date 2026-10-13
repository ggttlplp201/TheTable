import { expect, type Page } from '@playwright/test';
import type { AnyRoomView } from '../../apps/web/src/protocol';

/** Observe actual browser frames, rather than reading private engine state. */
export function observeViews(page: Page) {
  const views: AnyRoomView[] = [];
  const frames: string[] = [];
  page.on('websocket', socket => socket.on('framereceived', frame => {
    const text = String(frame.payload);
    frames.push(text);
    if (!text.startsWith('42[')) return;
    const [event, view] = JSON.parse(text.slice(2)) as [string, AnyRoomView];
    if (event === 'room:view') views.push(view);
  }));
  return {
    views, frames,
    latest: () => views.at(-1)!,
    async revision(revision: number, timeout = 5_000) {
      await expect.poll(() => views.at(-1)?.public.revision, { timeout }).toBeGreaterThanOrEqual(revision);
    },
  };
}

type WireReply = { ok: boolean; error?: { code: string }; data?: unknown };
type ProbeWindow = Window & { tableWireProbe: (event: string, payload: unknown) => Promise<WireReply> };

/** Test-only probe on the real browser socket for commands the UI correctly hides. */
export async function installWireProbe(page: Page) {
  await page.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    let transport: WebSocket;
    let nextAck = 900_000;
    window.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (String(url).includes('/socket.io/')) transport = this;
      }
    };
    (window as unknown as ProbeWindow).tableWireProbe = (event, payload) => new Promise(resolve => {
      const id = ++nextAck;
      const prefix = `43${id}`;
      const receive = (message: MessageEvent) => {
        if (typeof message.data !== 'string' || !message.data.startsWith(prefix + '[')) return;
        transport.removeEventListener('message', receive);
        resolve(JSON.parse(message.data.slice(prefix.length))[0] as WireReply);
      };
      transport.addEventListener('message', receive);
      transport.send(`42${id}${JSON.stringify([event, payload])}`);
    });
  });
}

export function probe(page: Page, event: string, payload: unknown = {}): Promise<WireReply> {
  return page.evaluate(({ event, payload }) => (window as unknown as ProbeWindow).tableWireProbe(event, payload), { event, payload });
}
