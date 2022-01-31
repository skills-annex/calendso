import { Attendee, PrismaClient } from "@prisma/client";

const emailToLowerCase = (prisma: PrismaClient) => {
  prisma.$use(async (params, next) => {
    if (
      params?.model === "User" ||
      params?.model === "Attendee" ||
      params?.model === "ResetPasswordRequest" ||
      params?.model === "Booking" ||
      params?.model === "BookingReference"
    ) {
      const {
        args: { data, where, create },
      } = params || { args: {} } || {};
      const attendees = data?.attendees?.createMany?.data;

      if (create?.email) create.email = create.email.toLowerCase();
      if (data?.email) data.email = data.email.toLowerCase();
      if (where?.email) where.email = where.email.toLowerCase();
      if (attendees && attendees.length > 0) {
        const lowerCaseEmails: Attendee[] = attendees.map(({ email, name, timeZone }: Attendee) => ({
          email: email.toLowerCase(),
          name,
          timeZone,
        }));

        data.attendees.createMany.data = lowerCaseEmails;
      }
    }

    return await next(params);
  });
};

export default emailToLowerCase;
