import type { NextApiRequest, NextApiResponse } from "next";

import { getSession } from "@lib/auth";
import { sendEventReminderEmails } from "@lib/emails/email-manager";
import { CalendarEvent } from "@lib/integrations/calendar/interfaces/Calendar";
import prisma from "@lib/prisma";

import { getTranslation } from "@server/lib/i18n";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const session = await getSession({ req });

  if (!session?.user?.id) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ message: "Invalid method" });
    return;
  }

  const uid = req.body.uid;

  if (!uid) {
    res.status(400).json({ message: "Bad request: Booking uid required." });
  }

  const booking = await prisma.booking.findUnique({
    where: {
      uid,
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

  if (booking) {
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
      await sendEventReminderEmails(evt, eventAttendees);
    }
    res.status(200).json({ message: "Success: Event reminder email sent to all attendees." });
  } else {
    res.status(404).json({ message: `Error: Could not find booking uid: ${uid}` });
  }
}
