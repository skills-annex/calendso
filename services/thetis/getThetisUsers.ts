import logger from "@lib/logger";

const getThetisUsers = async (email: string) => {
  const thetisSiteHost = process.env.THETIS_SITE_HOST;
  const thetisApiKey = process.env.THETIS_API_KEY;
  const encodedEmail = email ? encodeURIComponent(email) : "";
  if (!thetisSiteHost) {
    logger.error("Missing config value for THETIS_SITE_HOST");
    return;
  }

  if (!thetisApiKey) {
    logger.error("Missing value for THETIS_API_KEY");
    return;
  }

  const result = await fetch(`${thetisSiteHost}/api/users/get-users?email=${encodedEmail}`, {
    method: "GET",
    headers: {
      "x-api-key": thetisApiKey,
      "Content-Type": "application/json",
    },
  });

  return result;
};

export default getThetisUsers;
