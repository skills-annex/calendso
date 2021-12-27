import type { NextApiRequest, NextApiResponse } from "next";
import syncDailycoEvents from "workers/sync-dailyco-events";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = req.headers.authorization || req.query.apiKey;

  if (process.env.CRON_API_KEY !== apiKey) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ message: "Invalid method" });
    return;
  }

  await syncDailycoEvents.add("syncDailycoEventsJob", {});

  res.json({ ok: true });
}
