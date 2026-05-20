import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  MealType,
  PrismaClient,
  UserRole,
} from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const [adminPasswordHash, userPasswordHash] = await Promise.all([
    bcrypt.hash("Admin_123456", 10),
    bcrypt.hash("User_123456", 10),
  ]);

  const admin = await prisma.user.upsert({
  where: { username: "admin" },
  update: {
    name: "مدیر سیستم",
    email: "admin@example.com",
    role: UserRole.ADMIN,
    passwordHash: adminPasswordHash,
    isActive: true,
  },
  create: {
    username: "admin",
    name: "مدیر سیستم",
    email: "admin@example.com",
    role: UserRole.ADMIN,
    passwordHash: adminPasswordHash,
    isActive: true,
  },
});

  const amir = await prisma.user.upsert({
  where: { username: "amir" },
  update: {
    name: "Amir",
    email: "amir@example.com",
    role: UserRole.USER,
    passwordHash: userPasswordHash,
    isActive: true,
  },
  create: {
    username: "amir",
    name: "Amir",
    email: "amir@example.com",
    role: UserRole.USER,
    passwordHash: userPasswordHash,
    isActive: true,
  },
});

  const sara = await prisma.user.upsert({
  where: { username: "sara" },
  update: {
    name: "Sara",
    email: "sara@example.com",
    role: UserRole.USER,
    passwordHash: userPasswordHash,
    isActive: true,
  },
  create: {
    username: "sara",
    name: "Sara",
    email: "sara@example.com",
    role: UserRole.USER,
    passwordHash: userPasswordHash,
    isActive: true,
  },
});

  const reza = await prisma.user.upsert({
  where: { username: "reza" },
  update: {
    name: "Reza",
    email: "reza@example.com",
    role: UserRole.USER,
    passwordHash: userPasswordHash,
    isActive: true,
  },
  create: {
    username: "reza",
    name: "Reza",
    email: "reza@example.com",
    role: UserRole.USER,
    passwordHash: userPasswordHash,
    isActive: true,
  },
});

  await prisma.weeklyMealPreference.createMany({
    data: [
      {
        userId: amir.id,
        dayOfWeek: 0,
        mealType: MealType.BREAKFAST,
        isEnabled: true,
      },
      {
        userId: amir.id,
        dayOfWeek: 0,
        mealType: MealType.LUNCH,
        isEnabled: true,
      },
      {
        userId: amir.id,
        dayOfWeek: 1,
        mealType: MealType.LUNCH,
        isEnabled: true,
      },
      {
        userId: sara.id,
        dayOfWeek: 0,
        mealType: MealType.LUNCH,
        isEnabled: true,
      },
      {
        userId: sara.id,
        dayOfWeek: 2,
        mealType: MealType.BREAKFAST,
        isEnabled: true,
      },
      {
        userId: reza.id,
        dayOfWeek: 1,
        mealType: MealType.BREAKFAST,
        isEnabled: true,
      },
      {
        userId: reza.id,
        dayOfWeek: 1,
        mealType: MealType.LUNCH,
        isEnabled: true,
      },
      {
        userId: admin.id,
        dayOfWeek: 0,
        mealType: MealType.BREAKFAST,
        isEnabled: true,
      },
    ],
    skipDuplicates: true,
  });

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
