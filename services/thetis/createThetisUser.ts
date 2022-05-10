import logger from "@lib/logger";

export interface ICreateThetisUser {
  email: string;
  firstName?: string;
  hasAllAccess?: boolean;
  hasAuthorizedSms?: boolean;
  hasTemporaryPassword?: boolean;
  lastName?: string;
  mobilePhone?: string;
  password?: string;
}

const createThetisUser = async ({
  email,
  firstName,
  hasAllAccess = false,
  hasAuthorizedSms = false,
  hasTemporaryPassword = true,
  lastName,
  mobilePhone = "",
  password,
}: ICreateThetisUser) => {
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

  if (!email) {
    logger.error("Missing email to create Thetis user");
    return;
  }
  const result = await fetch(`${thetisSiteHost}/api/users`, {
    method: "POST",
    headers: {
      "x-api-key": thetisApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      firstName,
      hasAllAccess,
      hasAuthorizedSms,
      hasTemporaryPassword,
      lastName,
      mobilePhone,
      password,
    }),
  });

  return result;
};

export { createThetisUser };
