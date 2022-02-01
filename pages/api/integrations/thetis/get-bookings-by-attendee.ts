import type { NextApiRequest, NextApiResponse } from "next";

import logger from "@lib/logger";
import prisma from "@lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    // Check that requested is authenticated
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.THETIS_API_KEY) {
      logger.info("Access denied!");
      return res.status(403).json({ error: "Access denied!" });
    }

    const { email }: { email: string } = req.body;

    if (!email) {
      logger.error("Could not get bookings for this attendee: missing email");
      return res.status(400).json({ message: "Could not get bookings for this attendee: missing email" });
    }

    const bookingsByAttendee = await prisma.booking.findMany({
      where: {
        attendees: {
          some: {
            email,
          },
        },
      },
      select: {
        confirmed: true,
        createdAt: true,
        dailyRef: true,
        description: true,
        eventType: true,
        startTime: true,
        status: true,
        title: true,
      },
    });
    console.log({ bookingsByAttendee });
    return res.status(200).json(bookingsByAttendee);
  }
}
