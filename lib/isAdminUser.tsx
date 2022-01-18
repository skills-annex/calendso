const isAdminUser = (userEmail: string) =>
  process.env.THETIS_ADMIN_USER_EMAILS?.split(";").includes(userEmail);

export default isAdminUser;
