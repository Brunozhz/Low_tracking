import { getInsightQueue, getMetaSyncQueue } from "@/lib/jobs/queues";

export async function enqueueMetaSync(input: {
  workspaceId: string;
  projectId: string;
  adAccountId: string;
  rangeStart: string;
  rangeEnd: string;
}) {
  return getMetaSyncQueue().add("meta-sync-account", input);
}

export async function enqueueInsightsDaily(input: {
  workspaceId: string;
  projectId: string;
}) {
  return getInsightQueue().add("insights-daily", input);
}
