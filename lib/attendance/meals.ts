import { MealType } from "@/app/generated/prisma/client";

export const MEAL_TYPES = [MealType.BREAKFAST, MealType.LUNCH] as const;

export const MEAL_LABELS = {
  [MealType.BREAKFAST]: "صبحانه",
  [MealType.LUNCH]: "ناهار",
};