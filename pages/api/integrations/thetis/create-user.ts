import type { NextApiRequest, NextApiResponse } from "next";
import { createThetisUser } from "services/thetis/createThetisUser";

import { PaymentPageProps } from "@ee/pages/payment/[uid]";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { attendees }: { attendees: PaymentPageProps["booking"]["attendees"] } = req.body;

  const usersCreated: number[] = [];

  if (attendees && attendees.length > 0) {
    attendees?.forEach(async ({ email, name }) => {
      const userCreated = await createThetisUser({ email, firstName: name });
      if (userCreated) {
        usersCreated.push(userCreated);
      }
    });
    return res.status(200).json({ usersCreated: usersCreated });
  }

  return res.status(400).json({ message: `failed to create users from attendees: ${attendees}` });
}

export default handler;
