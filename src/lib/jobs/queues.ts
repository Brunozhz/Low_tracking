import { Queue } from "bullmq";

import { JOB_NAMES } from "@/lib/constants";
import { env } from "@/lib/env";

const redisUrl = new URL(env.REDIS_URL);

export const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};

let metaSyncQueue: Queue | null = null;
let insightQueue: Queue | null = null;

export function getMetaSyncQueue() {
  if (!metaSyncQueue) {
    metaSyncQueue = new Queue(JOB_NAMES.META_SYNC, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });
  }

  return metaSyncQueue;
}

export function getInsightQueue() {
  if (!insightQueue) {
    insightQueue = new Queue(JOB_NAMES.INSIGHTS_DAILY, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }

  return insightQueue;
}
