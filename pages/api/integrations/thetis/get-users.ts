import type { NextApiRequest, NextApiResponse } from "next";
import getThetisUsers from "services/thetis/getThetisUsers";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, id, mobilePhone, name } = req.body;

  const fullName = name?.split(" ");
  const firstName = fullName?.slice(0, -1).join(" ");
  const lastName = fullName?.slice(fullName.length - 1).join(" ");
  try {
    const response = await getThetisUsers({
      email,
      firstName,
      id,
      lastName,
      mobilePhone,
    });
    const usersFound = await response?.json();

    return res.status(200).send(usersFound);
  } catch (e) {
    return res.status(400).send({ message: e.message });
  }
}

export default handler;
