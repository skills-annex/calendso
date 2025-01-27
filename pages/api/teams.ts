import type { NextApiRequest, NextApiResponse } from "next";

import { getSession } from "@lib/auth";
import prisma from "@lib/prisma";
import slugify from "@lib/slugify";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req: req });

  if (!process.env.SKILLS_ENABLE_TEAM_SETTINGS) {
    res.status(403).json({ message: "This setting not enabled for The Skills" });
    return;
  }

  if (!session?.user?.id) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  if (req.method === "POST") {
    const slug = slugify(req.body.name);

    const nameCollisions = await prisma.team.count({
      where: {
        OR: [{ name: req.body.name }, { slug: slug }],
      },
    });

    if (nameCollisions > 0) {
      return res.status(409).json({ errorCode: "TeamNameCollision", message: "Team name already taken." });
    }

    const createTeam = await prisma.team.create({
      data: {
        name: req.body.name,
        slug: slug,
      },
    });

    await prisma.membership.create({
      data: {
        teamId: createTeam.id,
        userId: session.user.id,
        role: "OWNER",
        accepted: true,
      },
    });

    return res.status(201).json({ message: "Team created" });
  }

  res.status(404).json({ message: "Team not found" });
}
