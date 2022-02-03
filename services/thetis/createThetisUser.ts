import logger from "@lib/logger";

export interface ICreateThetisUser {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  hasAllAccess?: boolean;
}

const createThetisUser = async ({
  email,
  firstName,
  hasAllAccess = false,
  lastName,
  password,
}: ICreateThetisUser) => {
  const thetisSiteHost = process.env.THETIS_SITE_HOST;
  if (!thetisSiteHost) {
    logger.error("Missing config value for THETIS_SITE_HOST");
    return;
  }

  if (!process.env.THETIS_API_KEY) {
    logger.error("Missing value for THETIS_API_KEY");
    return;
  }

  if (!email) {
    logger.error("Missing email to create Thetis user");
    return;
  }
  const result = await fetch(`${thetisSiteHost}/api/common/user/create-user`, {
    method: "POST",
    headers: {
      "x-api-key": thetisSiteHost,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, firstName, lastName, hasAllAccess, password }),
  });

  return result.status;
};

export { createThetisUser };
