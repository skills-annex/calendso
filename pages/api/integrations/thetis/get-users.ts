import type { NextApiRequest, NextApiResponse } from "next";
import getThetisUsers from "services/thetis/getThetisUsers";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = req.query?.email as string | undefined;
  const mobilePhone = req.query?.mobilePhone as string | undefined;

  try {
    const response = await getThetisUsers({
      email,
      mobilePhone,
    });
    const usersFound = await response?.json();

    return res.status(200).send(usersFound);
  } catch (e) {
    return res.status(400).send({ message: e.message });
  }
}

export default handler;
