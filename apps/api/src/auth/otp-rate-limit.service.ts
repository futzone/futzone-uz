import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const script = `
local cooldown = redis.call('TTL', KEYS[1])
if cooldown > 0 then return cooldown end
local phone = tonumber(redis.call('GET', KEYS[2]) or '0')
if phone >= 3 then return redis.call('TTL', KEYS[2]) end
local ip = tonumber(redis.call('GET', KEYS[3]) or '0')
if ip >= 10 then return redis.call('TTL', KEYS[3]) end
redis.call('SET', KEYS[1], '1', 'EX', 60)
local p = redis.call('INCR', KEYS[2]); if p == 1 then redis.call('EXPIRE', KEYS[2], 600) end
local i = redis.call('INCR', KEYS[3]); if i == 1 then redis.call('EXPIRE', KEYS[3], 3600) end
return 0`;

@Injectable()
export class OtpRateLimitService {
  public constructor(private readonly redis: RedisService) {}
  public async consume(phone: string, ip: string): Promise<number> {
    const keyPhone = Buffer.from(phone).toString('base64url');
    const result = await this.redis.client.eval(script, 3, `otp:cooldown:${keyPhone}`, `otp:phone:${keyPhone}`, `otp:ip:${ip}`);
    return Number(result);
  }
}
