import type { NextApiRequest, NextApiResponse } from "next";
import getThetisUsers from "services/thetis/getThetisUsers";

import logger from "@lib/logger";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = req.query?.email as string | undefined;
  if (email) {
    try {
      const response = await getThetisUsers(email);
      const usersFound = await response?.json();

      return res.status(200).send(usersFound);
    } catch (e) {
      logger.error({ error: e, message: `failed to get thetis users with email: ${email}` });
      return res.status(400).send({ message: e.message });
    }
  }
  logger.error({ message: "failed to get thetis users, no email provided" });
}

export default handler;
