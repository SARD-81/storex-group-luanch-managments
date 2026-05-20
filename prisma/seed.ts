import "dotenv/config";
import { PrismaClient, MealType } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const amir = await prisma.user.upsert({
    where: { email: "amir@example.com" },
    update: {},
    create: {
      name: "Amir",
      email: "amir@example.com",
    },
  });

  const sara = await prisma.user.upsert({
    where: { email: "sara@example.com" },
    update: {},
    create: {
      name: "Sara",
      email: "sara@example.com",
    },
  });

  const reza = await prisma.user.upsert({
    where: { email: "reza@example.com" },
    update: {},
    create: {
      name: "Reza",
      email: "reza@example.com",
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