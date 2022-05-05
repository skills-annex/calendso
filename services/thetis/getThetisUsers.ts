import logger from "@lib/logger";

export interface IGetThetisUser {
  email?: string;
  firstName?: string;
  id?: string;
  lastName?: string;
  mobilePhone?: string;
}

const getThetisUsers = async ({ email, firstName, id, lastName, mobilePhone }: IGetThetisUser) => {
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

  const result = await fetch(`${thetisSiteHost}/api/users/get-users`, {
    method: "POST",
    headers: {
      "x-api-key": thetisApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      firstName,
      id,
      lastName,
      mobilePhone,
    }),
  });

  return result;
};

export default getThetisUsers;
