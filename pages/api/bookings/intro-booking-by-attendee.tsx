import type { NextApiRequest, NextApiResponse } from "next";

import logger from "@lib/logger";

import prisma from "../../../lib/prisma";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, eventTypeId } = req.query;
  const introPaymentAmount = 100;

  if (email && eventTypeId) {
    const bookings = await prisma.attendee.findMany({
      where: {
        email: String(email),
        AND: [
          {
            booking: {
              payment: {
                some: {
                  amount: {
                    lte: introPaymentAmount,
                  },
                },
              },
            },
          },
          {
            booking: {
              eventTypeId: {
                equals: Number(eventTypeId),
              },
            },
          },
          {
            booking: {
              status: {
                equals: "ACCEPTED",
              },
            },
          },
        ],
      },
      select: {
        name: true,
        email: true,
        booking: {
          select: {
            status: true,
            title: true,
            payment: {
              select: {
                amount: true,
              },
            },
          },
        },
      },
    });

    logger.info(res);
    res.status(200).json(bookings);
  } else res.status(404);

  res.end();
}

export default handler;
