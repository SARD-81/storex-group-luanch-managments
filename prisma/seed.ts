import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const INITIAL_USERS = [
  {
    username: "a.zand",
    name: "علی زند",
  },
  {
    username: "h.moinei",
    name: "حمید معینی",
  },
  {
    username: "m.barzegar",
    name: "مهدی برزگر",
  },
  {
    username: "m.nasab",
    name: "بهروز محمدی نسب",
  },
  {
    username: "a.jeddi",
    name: "محمد حسین جدی",
  },
  {
    username: "a.rasouli",
    name: "امیر علی رسولی",
  },
  {
    username: "a.zare",
    name: "امیر حسین زارع",
  },
  {
    username: "a.davarzani",
    name: "سید امیررضا داورزنی",
  },
  {
    username: "m.nobaqi",
    name: "محمد نوباغی",
  },
  {
    username: "m.poor",
    name: "ملک پور",
  },
  {
    username: "k.karami",
    name: "خدا کرمی",
  },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed is destructive and must not run in production.");
  }

  const passwordHash = await bcrypt.hash("abc123456", 10);

  await prisma.$transaction([
    prisma.mealAttendance.deleteMany(),
    prisma.weeklyMealPreference.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),

    prisma.user.create({
      data: {
        username: "admin",
        name: "مدیر سیستم",
        email: "admin@example.com",
        role: UserRole.ADMIN,
        passwordHash,
        isActive: true,
      },
    }),

    prisma.user.createMany({
      data: INITIAL_USERS.map((user) => ({
        username: user.username,
        name: user.name,
        email: null,
        role: UserRole.USER,
        passwordHash,
        isActive: true,
      })),
    }),
  ]);

  console.log("Database seeded successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });