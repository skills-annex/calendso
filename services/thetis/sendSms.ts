import logger from "@lib/logger";

export interface ISendSms {
  email?: string;
  eventName?: string;
  instructorName?: string;
  meetingLink?: string;
  mobilePhone?: string;
}

const sendSms = async ({ email, eventName, instructorName, meetingLink, mobilePhone }: ISendSms) => {
  const thetisSiteHost = process.env.THETIS_SITE_HOST;
  const thetisApiKey = process.env.THETIS_API_KEY;
  if (!thetisSiteHost) {
    logger.error("Missing config value for THETIS_SITE_HOST");
    return;
  }

  if (!thetisApiKey) {
    logger.error("Missing value for THETIS_API_KEY");
    return;
  }

  const result = await fetch(`${thetisSiteHost}/api/twilio/send-sms`, {
    method: "POST",
    headers: {
      "x-api-key": thetisApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      eventName,
      instructorName,
      meetingLink,
      mobilePhone,
    }),
  });

  return result;
};

export default sendSms;
