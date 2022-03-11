import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { NextApiRequest, NextApiResponse } from "next";
import updateContact, { getContact } from "services/hubspot";

import logger from "@lib/logger";
import prisma from "@lib/prisma";

dayjs.extend(utc);

interface IDailyMeeting {
  id: string;
  room: string;
  start_time: number;
  duration: number;
  ongoing: boolean;
  max_participants: number;
  participants: {
    user_id: string | null;
    participant_id: string;
    user_name: string;
    join_time: number;
    duration: number;
  }[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const apiKey = req.headers.authorization || req.query.apiKey;
  if (process.env.CRON_API_KEY !== apiKey) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ message: "Invalid method" });
    return;
  }

  const DAILY_API_KEY = process.env.DAILY_API_KEY;
  if (!DAILY_API_KEY) {
    throw Error("DAILY_API_KEY env var missing");
  }
  const timestamp24HrsAgo = dayjs().subtract(24, "hours").unix();
  const timestampNow = dayjs().unix();
  const dailyApi = `https://api.daily.co/v1/meetings?timeframe_start=${timestamp24HrsAgo}&timeframe_end=${timestampNow}&limit=100`; // 100 is a hard limit on their end
  const configOptions: RequestInit = {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DAILY_API_KEY}` },
  };
  const updateParticipantHubspotData = async (booking: typeof bookings[0]) => {
    const { ongoing, attendees, eventType, participants, start_time } = booking;
    const participantSeconds = participants
      .map(({ duration }) => duration)
      .reduce((prev, curr) => prev + curr, 0);
    const totalVideoParticipantsExpected = attendees?.length || 1 + 1; // attendees leaves out the host
    const likelySuccessfulMeeting =
      eventType &&
      !ongoing &&
      participantSeconds > (eventType.length * 60 * totalVideoParticipantsExpected) / 2; // if video time is more than 50% of expected total time

    if (likelySuccessfulMeeting && attendees) {
      await Promise.all(
        attendees.map(async ({ email }) => {
          const existingContact = await getContact(email);
          const existing_n1on1_completed_count = existingContact?.properties["n1on1_completed_count"] || "0";
          const n1on1_completed_count = Number(existing_n1on1_completed_count) + 1 || 1;
          const n1on1_last_completed_at = dayjs.unix(start_time).utc().startOf("day").unix() * 1000; // hubspot's api only takes ms

          if (
            n1on1_last_completed_at !==
            Number(existingContact?.properties["n1on1_last_completed_at"]?.value || 1 * 1000)
          ) {
            // we only want to update the contact if their last_completed_at is different than what is already there
            // this assures we do not increment if a successful meeting has already been reported to hubspot
            // this doesn't work if a user completes 2 1on1s in one day. This could will not increment more than 1x per day.
            // 2 ways to resolve: 1. If we update the hubspot property last_completed_at to use a timestamp instead of just a date 2. Keep track of hubspot sync status in the DB
            logger.info(
              `Updating hubspot contact for ${email} with properties { n1on1_completed_count: ${n1on1_completed_count}, n1on1_last_completed_at: ${n1on1_last_completed_at}} `
            );
            await updateContact({
              email,
              data: {
                n1on1_completed_count,
                n1on1_last_completed_at,
              },
            });
          }
        })
      );
    }
  };

  const response = await fetch(dailyApi, configOptions);
  const { data: meetings }: { data: IDailyMeeting[] } = await response.json();

  const bookings = await Promise.all(
    meetings.map(async (meeting) => {
      const booking = await prisma.bookingReference.findFirst({
        where: { meetingId: { equals: meeting.room } },
        select: {
          booking: {
            select: { attendees: { select: { email: true } }, eventType: { select: { length: true } } },
          },
        },
      });
      return { ...meeting, ...booking?.booking };
    })
  );

  await Promise.all(bookings.map(async (booking) => await updateParticipantHubspotData(booking)));

  res.status(200).json({ message: "Completed 1on1 data sent to hubspot" });
}
