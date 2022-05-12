import { Attendee, ReminderType } from "@prisma/client";
import dayjs from "dayjs";
import advanced from "dayjs/plugin/advancedFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { NextApiRequest, NextApiResponse } from "next";
import getThetisUsers from "services/thetis/getThetisUsers";
import sendSms from "services/thetis/sendSms";

import { sendEventReminderEmails } from "@lib/emails/email-manager";
import { CalendarEvent } from "@lib/integrations/calendar/interfaces/Calendar";
import logger from "@lib/logger";
import prisma from "@lib/prisma";

import { getTranslation } from "@server/lib/i18n";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advanced);

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

        const sendEventReminderSms = async (attendees: Attendee[], booking: typeof bookings[number]) => {
          const smsResponses = [];
          const eventName = booking?.title;
          const instructorName = booking.user?.name || "";
          const meetingLink = booking?.references[0]?.meetingUrl;

          for (const attendee of attendees) {
            if (attendee?.email) {
              const response = await getThetisUsers({
                email: attendee.email,
              });
              const usersFound = await response?.json();
              const { hasAuthorizedSms, mobilePhone } = (usersFound?.data && usersFound?.data[0]) || {};

              if (hasAuthorizedSms && mobilePhone && meetingLink && eventName) {
                try {
                  const smsResponse = await sendSms({
                    email: attendee.email,
                    eventName,
                    instructorName,
                    meetingLink,
                    mobilePhone,
                    startTime: `${dayjs(booking.startTime)
                      .tz("America/Los_Angeles")
                      .format("dddd MMM D, h:mm A z")}`,
                    timeToEvent: `${interval / 60} Hours`,
                  });
                  smsResponses.push(smsResponse);
                } catch (e) {
                  logger.error(`failed to send event reminder sms to ${attendee?.email}`, e.message);
                }
              }
            } else {
              smsResponses.push({
                message: `attendee id(${attendee.id}) is missing email address for booking: ${booking?.title}`,
              });
            }
          }
          return smsResponses;
        };

        const eventReminderSmsResponses = await sendEventReminderSms(attendees, booking);
        const eventReminderEmailsResponses = await sendEventReminderEmails(evt, eventAttendees);
        responses = [...responses, ...eventReminderEmailsResponses, ...eventReminderSmsResponses];

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
