import type { NextApiRequest, NextApiResponse } from "next";
import { createThetisUser } from "services/thetis/createThetisUser";

import { OneOnOneAttendee } from "@ee/components/stripe/Payment";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { attendees }: { attendees: OneOnOneAttendee[] } = req.body;

  const usersCreated: number[] = [];

  if (attendees && attendees.length > 0) {
    attendees?.forEach(async ({ email, hasAuthorizedSms, mobilePhone, name }: OneOnOneAttendee) => {
      const fullName = name.split(" ");
      const firstName = fullName.slice(0, -1).join(" ");
      const lastName = fullName.slice(fullName.length - 1).join(" ");
      const userCreated = await createThetisUser({
        email,
        firstName,
        hasAuthorizedSms,
        lastName,
        mobilePhone,
      });

      if (userCreated) {
        usersCreated.push(userCreated.status);
      }
    });
    return res.status(200).json({ usersCreated: usersCreated });
  }

  return res.status(400).json({ message: `failed to create users from attendees: ${attendees}` });
}

export default handler;
