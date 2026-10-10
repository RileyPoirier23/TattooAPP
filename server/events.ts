// Server-sent events: pushes live updates (notifications, messages, booking changes) to logged-in browsers.
import type { Request, Response } from 'express';

const clients = new Map<string, Set<Response>>();

export function subscribe(req: Request, res: Response, userId: string) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');

  let set = clients.get(userId);
  if (!set) clients.set(userId, (set = new Set()));
  set.add(res);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    set!.delete(res);
    if (set!.size === 0) clients.delete(userId);
  });
}

export type EventName = 'notification' | 'message' | 'bookings' | 'me';

export function emit(userId: string | null | undefined, event: EventName, data: unknown = {}) {
  if (!userId) return;
  const set = clients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(payload);
}
