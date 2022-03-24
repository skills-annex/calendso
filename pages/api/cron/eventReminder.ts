import { ReminderType } from "@prisma/client";
import dayjs from "dayjs";
import type { NextApiRequest, NextApiResponse } from "next";

import { sendEventReminderEmails } from "@lib/emails/email-manager";
import { CalendarEvent } from "@lib/integrations/calendar/interfaces/Calendar";
import prisma from "@lib/prisma";

import { getTranslation } from "@server/lib/i18n";

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

  const reminderIntervalMinutes = [24 * 60, 120];
  let notificationsSent = 0;
  let responses: unknown[] = [];

  for (const interval of reminderIntervalMinutes) {
    const bookings = await prisma.booking.findMany({
      where: {
        confirmed: true,
        rejected: false,
        status: {
          equals: "ACCEPTED",
        },
        startTime: {
          lte: dayjs().add(interval, "minutes").toDate(),
          gte: dayjs().toDate(),
        },
      },
      select: {
        title: true,
        description: true,
        location: true,
        startTime: true,
        endTime: true,
        attendees: true,
        references: {
          select: {
            bookingId: true,
            id: true,
            type: true,
            uid: true,
            meetingId: true,
            meetingPassword: true,
            meetingUrl: true,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
            username: true,
            locale: true,
            timeZone: true,
          },
        },
        id: true,
        uid: true,
      },
    });

    const reminders = await prisma.reminderMail.findMany({
      where: {
        reminderType: ReminderType.ATTENDEE_REMINDER,
        referenceId: {
          in: bookings.map(({ id }) => id),
        },
        elapsedMinutes: interval,
      },
    });

    const bookingsNeedingReminders = bookings.filter((b) => !reminders.some((r) => r.referenceId == b.id));

    for (const booking of bookingsNeedingReminders) {
      const { user, attendees } = booking;
      const name = user?.name || user?.username;
      if (!user || !name || !user.timeZone) {
        console.error(`Booking ${booking.id} is missing required properties for event reminder`, { user });
      } else {
        const t = await getTranslation(booking.user?.locale ?? "en", "common");

        const evt: CalendarEvent = {
          type: booking.title,
          title: booking.title,
          description: booking.description || undefined,
          location: booking.location ?? "",
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          references: booking.references,
          organizer: {
            email: user.email,
            name,
            timeZone: user.timeZone,
          },
          attendees: booking.attendees,
          uid: booking.uid,
          language: t,
        };

        const eventAttendees = [{ name, email: user.email, timeZone: user.timeZone }, ...attendees];
        const eventReminderEmailsResponses = await sendEventReminderEmails(evt, eventAttendees);
        responses = [...responses, ...eventReminderEmailsResponses];

        await prisma.reminderMail.create({
          data: {
            referenceId: booking.id,
            reminderType: ReminderType.ATTENDEE_REMINDER,
            elapsedMinutes: interval,
          },
        });
        notificationsSent += eventAttendees.length;
      }
    }
  }
  res.status(200).json({ notificationsSent, responses });
}
