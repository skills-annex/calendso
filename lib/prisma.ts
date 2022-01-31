import { PrismaClient } from "@prisma/client";

import { IS_PRODUCTION } from "@lib/config/constants";
import emailToLowerCase from "@lib/hooks/email-to-lower-case";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (!IS_PRODUCTION) {
  globalThis.prisma = prisma;
}

emailToLowerCase(prisma);

export default prisma;
