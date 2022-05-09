import { NextApiRequest, NextApiResponse } from "next";
import updateContact, { HsProperties } from "services/hubspot";

import logger from "@lib/logger";

interface IHsProxy extends NextApiRequest {
  body: { properties: HsProperties };
}

const handler = async (req: IHsProxy, res: NextApiResponse) => {
  const email = req.body?.properties?.email as string;
  const properties = req.body.properties;

  if (email) {
    try {
      const response = await updateContact({ email, data: properties });
      return res.status(200).send({ message: response });
    } catch (e) {
      logger.error(e.message);
      return res.status(500).send({ error: e.message });
    }
  }

  return res.status(500).send({ error: "Unable to update hubspot contact, email is missing" });
};

export default handler;
