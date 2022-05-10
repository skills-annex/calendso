import type { NextApiRequest, NextApiResponse } from "next";
import getThetisUsers from "services/thetis/getThetisUsers";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { mobilePhone } = req.query;

  try {
    const response = await getThetisUsers({ mobilePhone: mobilePhone as string });
    const usersFound = await response?.json();

    return res.status(200).send(usersFound);
  } catch (e) {
    return res.status(400).send({ message: e.message });
  }
}

export default handler;
