import { Injectable, type MessageEvent } from '@nestjs/common';
import type { NotificationStreamEvent } from '@futzone/contracts';
import { Observable, interval, map, merge } from 'rxjs';
import { RedisService } from '../redis/redis.service';

const channel = (userId: string): string => `notif:${userId}`;
const KEEPALIVE_MS = 30_000;

@Injectable()
export class NotificationStreamService {
  public constructor(private readonly redis: RedisService) {}

  // Called from the delivery worker once the row is committed and visible.
  public async publish(userId: string, event: NotificationStreamEvent): Promise<void> {
    await this.redis.client.publish(channel(userId), JSON.stringify(event));
  }

  // One dedicated subscriber connection per SSE client, torn down on disconnect. A periodic ping
  // keeps intermediaries from closing an idle stream; the browser ignores non-default event types.
  public subscribe(userId: string): Observable<MessageEvent> {
    const events = new Observable<MessageEvent>((subscriber) => {
      const connection = this.redis.client.duplicate();
      connection.on('message', (_channel: string, message: string) => {
        subscriber.next({ data: JSON.parse(message) as NotificationStreamEvent });
      });
      connection.subscribe(channel(userId)).catch((error) => subscriber.error(error));
      return (): void => { connection.disconnect(); };
    });
    const keepalive = interval(KEEPALIVE_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: '' })));
    return merge(events, keepalive);
  }
}
