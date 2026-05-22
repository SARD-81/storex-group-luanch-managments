"use client";

import { CalendarCheck, Coffee, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";

type MealTarget = "ALL" | "BREAKFAST" | "LUNCH";

function getSelector(target: MealTarget) {
  if (target === "ALL") {
    return 'input[type="checkbox"][data-monthly-meal]';
  }

  return `input[type="checkbox"][data-monthly-meal="${target}"]`;
}

function getEditableCheckboxes(target: MealTarget) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(getSelector(target)),
  ).filter((checkbox) => !checkbox.disabled);
}

function areAllChecked(target: MealTarget) {
  const checkboxes = getEditableCheckboxes(target);

  return (
    checkboxes.length > 0 &&
    checkboxes.every((checkbox) => checkbox.checked)
  );
}

type ToggleState = {
  all: boolean;
  breakfast: boolean;
  lunch: boolean;
};

export function MonthlyAttendanceActions() {
  const [state, setState] = useState<ToggleState>({
    all: false,
    breakfast: false,
    lunch: false,
  });

  function refreshState() {
    setState({
      all: areAllChecked("ALL"),
      breakfast: areAllChecked("BREAKFAST"),
      lunch: areAllChecked("LUNCH"),
    });
  }

  function toggleMeals(target: MealTarget) {
    const shouldCheck = !areAllChecked(target);
    const checkboxes = getEditableCheckboxes(target);

    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldCheck;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      checkbox.dispatchEvent(new Event("input", { bubbles: true }));
    });

    refreshState();
  }

  useEffect(() => {
    refreshState();

    const handleChange = () => {
      refreshState();
    };

    document.addEventListener("change", handleChange);

    return () => {
      document.removeEventListener("change", handleChange);
    };
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="dashboard-action-button inline-flex items-center gap-2"
        onClick={() => toggleMeals("ALL")}
        aria-pressed={state.all}
      >
        <CalendarCheck className="h-4 w-4" />
        {state.all ? "برداشتن تیک کل ماه" : "تیک کل ماه"}
      </button>

      <button
        type="button"
        className="dashboard-action-button inline-flex items-center gap-2"
        onClick={() => toggleMeals("BREAKFAST")}
        aria-pressed={state.breakfast}
      >
        <Coffee className="h-4 w-4" />
        {state.breakfast ? "برداشتن تیک صبحانه‌ها" : "تیک همه صبحانه‌ها"}
      </button>

      <button
        type="button"
        className="dashboard-action-button inline-flex items-center gap-2"
        onClick={() => toggleMeals("LUNCH")}
        aria-pressed={state.lunch}
      >
        <UtensilsCrossed className="h-4 w-4" />
        {state.lunch ? "برداشتن تیک ناهارها" : "تیک همه ناهارها"}
      </button>
    </div>
  );
}