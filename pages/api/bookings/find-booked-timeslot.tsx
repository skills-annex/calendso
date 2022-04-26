import type { NextApiRequest, NextApiResponse } from "next";

import logger from "@lib/logger";

import prisma from "../../../lib/prisma";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { eventTypeId, username, startTime } = req.body;
  if (eventTypeId && username && startTime) {
    const booking = await prisma.booking.findFirst({
      where: {
        eventType: {
          id: {
            equals: Number(eventTypeId),
          },
        },
        startTime: {
          equals: new Date(startTime as string),
        },
        status: {
          equals: "ACCEPTED",
        },
        user: {
          username: {
            equals: String(username),
          },
        },
      },
    });

    if (booking) {
      logger.info(res);
      res.status(200).json({ isBooked: true, booking });
    }
    logger.info(res);
    res.status(200).json({ isBooked: false, message: "No matching record found" });
  } else res.status(404).json({ message: "Missing parameters" });

  res.end();
}

export default handler;
