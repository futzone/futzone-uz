import { QUEUE_NAMES } from '@futzone/contracts';
import { Queue } from 'bullmq';
import { bullConnection } from '../src/users/avatar/avatar-queue.service';

const redisUrl = process.env.REDIS_URL;
const prefix = process.env.BULLMQ_PREFIX;

if (!redisUrl || !prefix) {
  throw new Error('REDIS_URL and BULLMQ_PREFIX must be set before BullMQ e2e cleanup');
}

const cleanSuiteQueues = async (): Promise<void> => {
  for (const queueName of Object.values(QUEUE_NAMES)) {
    const queue = new Queue(queueName, {
      connection: bullConnection(redisUrl),
      prefix,
    });
    try {
      await queue.drain(true);
      await queue.obliterate({ force: true });
    } finally {
      await queue.close();
    }
  }
};

beforeAll(cleanSuiteQueues);
afterAll(cleanSuiteQueues);
