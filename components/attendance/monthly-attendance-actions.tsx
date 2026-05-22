"use client";

import { Coffee, UtensilsCrossed, CalendarCheck } from "lucide-react";

export function MonthlyAttendanceActions() {
  const checkMeals = (mealType?: "BREAKFAST" | "LUNCH") => {
    const selector = mealType
      ? `input[type="checkbox"][data-monthly-meal="${mealType}"]`
      : 'input[type="checkbox"][data-monthly-meal]';

    const checkboxes = document.querySelectorAll<HTMLInputElement>(selector);

    checkboxes.forEach((checkbox) => {
      if (!checkbox.disabled) {
        checkbox.checked = true;
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="dashboard-action-button" onClick={() => checkMeals()}>
        <CalendarCheck className="h-4 w-4" />
        انتخاب کل ماه
      </button>
      <button type="button" className="dashboard-action-button" onClick={() => checkMeals("BREAKFAST")}>
        <Coffee className="h-4 w-4" />
        فقط صبحانه‌ها
      </button>
      <button type="button" className="dashboard-action-button" onClick={() => checkMeals("LUNCH")}>
        <UtensilsCrossed className="h-4 w-4" />
        فقط ناهارها
      </button>
    </div>
  );
}
