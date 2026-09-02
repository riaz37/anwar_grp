import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton pattern: without this, every hot
// reload would instantiate a new PrismaClient and exhaust Postgres
// connections. In production a single instance is created per process.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
