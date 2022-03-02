import type { NextApiRequest, NextApiResponse } from "next";

import logger from "@lib/logger";
import prisma from "@lib/prisma";

interface IThetisUser {
  id: string;
  isActive: boolean;
  price: number;
  introductoryPrice: number;
  instructorPublicName: string;
  instructorHandle: string;
  instructorImage: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    // Check that requested is authenticated
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.THETIS_API_KEY) {
      logger.info("Access denied!");
      return res.status(403).json({ error: "Access denied!" });
    }

    const {
      id,
      isActive,
      price,
      introductoryPrice,
      instructorPublicName,
      instructorHandle,
      instructorImage,
    }: IThetisUser = req.body;

    if (!id) {
      logger.error("Could not update event type for this user: missing id");
      return res
        .status(400)
        .json({ message: "Could not update default event type for this user: missing id" });
    }

    if (!price) {
      logger.error("Could not update event type for this user: missing price");
      return res
        .status(400)
        .json({ message: "Could not update default event type for this user: missing price" });
    }

    const currentUser = await prisma.user.findUnique({
      where: {
        thetisId: id,
      },
    });

    if (!currentUser) {
      logger.info(`Could not update default event type. Thetis user id: ${id} does not exist in Vulcan.`);
      return res
        .status(200)
        .json({ message: `Could not update event type. Thetis user id: ${id} does not exist in Vulcan.` });
    }

    const eventTypes = await prisma.eventType.findMany({
      where: {
        users: {
          every: {
            thetisId: id,
          },
        },
      },
      select: {
        id: true,
        slug: true,
      },
    });

    const DEFAULT_EVENT_TYPE_SLUG = "30min";
    const DEFAULT_INTRO_EVENT_TYPE_SLUG = `intro-${currentUser.username}`;
    const INACTIVE_MODIFIER = "inactive";

    const defaultEventTypeActive = eventTypes.find((et) => et.slug === DEFAULT_EVENT_TYPE_SLUG);
    const defaultEventTypeInactive = eventTypes.find(
      (et) => et.slug === `${DEFAULT_EVENT_TYPE_SLUG}-${INACTIVE_MODIFIER}`
    );

    const defaultEventType = defaultEventTypeActive || defaultEventTypeInactive;

    if (!defaultEventType) {
      logger.error(
        `Default EventType with slug: ${DEFAULT_EVENT_TYPE_SLUG} does not exist for Vulcan user with id: ${currentUser.id}.\n
        If Vulcan user has already been onboarded OR Vulcan user hasn't been onboarded but has other event types,
        manual action is required to create the default event type with slug: ${DEFAULT_EVENT_TYPE_SLUG}.`
      );
      return res.status(200).json({
        message: `A default EventType with slug: ${DEFAULT_EVENT_TYPE_SLUG} does not exist for Vulcan user with id: ${currentUser.id}. See application logs for more information on how to resolve this.`,
      });
    }

    const updatedDefaultEventType = await prisma.eventType.update({
      where: {
        id: defaultEventType.id,
      },
      data: {
        description: `1on1 Meeting with ${instructorPublicName}`,
        price: price,
        slug: isActive ? DEFAULT_EVENT_TYPE_SLUG : `${DEFAULT_EVENT_TYPE_SLUG}-${INACTIVE_MODIFIER}`,
      },
    });

    logger.info(
      `Default EventType updated with id: ${updatedDefaultEventType.id} (slug: ${updatedDefaultEventType.slug}) with price: $${price}.`
    );

    const defaultIntroEventTypeActive = eventTypes.find((et) => et.slug === DEFAULT_INTRO_EVENT_TYPE_SLUG);
    const defaultIntroEventTypeInactive = eventTypes.find(
      (et) => et.slug === `${DEFAULT_INTRO_EVENT_TYPE_SLUG}-${INACTIVE_MODIFIER}`
    );

    const defaultIntroEventType = defaultIntroEventTypeActive || defaultIntroEventTypeInactive;

    logger.info("defaultIntroEventType", defaultIntroEventType);

    const introEventTypeSlug =
      isActive && introductoryPrice && introductoryPrice > 0
        ? DEFAULT_INTRO_EVENT_TYPE_SLUG
        : `${DEFAULT_INTRO_EVENT_TYPE_SLUG}-${INACTIVE_MODIFIER}`;

    const updatedDefaultEventTypeWithoutId = { ...updatedDefaultEventType, id: undefined };

    const updatedIntroDefaultEventType = await prisma.eventType.upsert({
      where: {
        id: defaultIntroEventType?.id || 0,
      },
      update: {
        description: `1on1 Meeting with ${instructorPublicName}`,
        price: introductoryPrice,
        slug: introEventTypeSlug,
        users: {
          connect: {
            id: currentUser.id,
          },
        },
      },
      create: {
        ...updatedDefaultEventTypeWithoutId,
        locations: [{ type: "integrations:daily" }],
        title: "15 Min Intro Meeting",
        length: 15,
        description: `1on1 Meeting with ${instructorPublicName}`,
        price: introductoryPrice,
        slug: introEventTypeSlug,
      },
    });

    // upsert doesn't permit update of users with connect, so re-updating the EventType here to be extra sure
    await prisma.eventType.update({
      where: {
        id: updatedIntroDefaultEventType?.id,
      },
      data: {
        users: {
          connect: {
            id: currentUser.id,
          },
        },
      },
    });

    logger.info(
      `Default intro EventType updated with id: ${updatedIntroDefaultEventType.id} (slug: ${updatedIntroDefaultEventType.slug}) with price ${introductoryPrice}.`
    );

    const user = await prisma.user.update({
      where: { thetisId: id },
      data: {
        name: instructorPublicName,
        username: instructorHandle,
        avatar: instructorImage,
      },
      select: {
        id: true,
        name: true,
        username: true,
      },
    });
    logger.info(`User updated with id: ${user.id} with username ${user.username} and name ${user.name}`);

    return res.status(200).json({ message: "EventTypes and User updated" });
  }
}
