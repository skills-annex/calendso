import type { NextApiRequest, NextApiResponse } from "next";
import sendSms from "services/thetis/sendSms";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, eventName, instructorName, meetingLink, mobilePhone } = req.body;

  if (eventName && meetingLink && (mobilePhone || email)) {
    try {
      const response = await sendSms({
        email,
        eventName,
        instructorName,
        meetingLink,
        mobilePhone,
      });
      const sentSms = await response?.json();

      return res.status(200).send(sentSms);
    } catch (e) {
      return res.status(400).send({ message: e.message });
    }
  }
  return res.status(500).send({ message: "missing required parameters" });
}

export default handler;
