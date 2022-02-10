import type { NextApiRequest, NextApiResponse } from "next";

import logger from "@lib/logger";
import prisma from "@lib/prisma";

interface IIntroductoryOfferParams {
  id: string;
  instructorPublicName: string;
  instructorHandle: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    // Check that request is authenticated
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.THETIS_API_KEY) {
      logger.info("Access denied!");
      return res.status(403).json({ error: "Access denied!" });
    }

    const { id, instructorHandle }: IIntroductoryOfferParams = req.body;
    let newIntroductoryOfferEventType;

    if (!id) {
      logger.error("Could not update event type for this user: missing id");
      return res.status(400).json({ message: "Could not update event type for this user: missing id" });
    }

    // get event types for user
    const introductoryOfferEventType = await prisma.eventType.findFirst({
      where: {
        slug: { equals: `intro-${instructorHandle}` },
      },
    });

    // if event type exists do nothing, return 200 w/ message
    if (introductoryOfferEventType) {
      return res.status(200).json({ message: "Introductory offer event type already exists" });
    }
    // if no intro offer event type, create it
    else {
      const vulcanUser = await prisma.user.findUnique({ where: { thetisId: id }, select: { id: true } });
      if (!vulcanUser?.id) return res.status(404).json({ message: "User not found in Vulcan" });
      // create event type
      newIntroductoryOfferEventType = await prisma.eventType.create({
        data: {
          title: "Introductory 1-on-1",
          slug: `intro-${instructorHandle}`,
          hidden: true,
          price: 100,
          locations: [{ type: "integrations:daily" }],
          length: 15,
          userId: vulcanUser.id,
        },
      });
    }

    logger.info(newIntroductoryOfferEventType);

    return res.status(200).json({ message: "Introductory offer event type created" });
  }
}
