"use client";

import { CalendarCheck2, Coffee, Eraser, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";

type WeeklyMealTarget = "ALL" | "BREAKFAST" | "LUNCH";

function getSelector(target: WeeklyMealTarget) {
  if (target === "ALL") {
    return 'input[type="checkbox"][data-weekly-preference]';
  }

  return `input[type="checkbox"][data-weekly-preference][data-weekly-meal="${target}"]`;
}

function getEditableCheckboxes(target: WeeklyMealTarget) {
  return Array.from(document.querySelectorAll<HTMLInputElement>(getSelector(target))).filter((checkbox) => !checkbox.disabled);
}

function areAllChecked(target: WeeklyMealTarget) {
  const checkboxes = getEditableCheckboxes(target);

  return checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
}

type ToggleState = {
  all: boolean;
  breakfast: boolean;
  lunch: boolean;
};

export function WeeklyPlanActions() {
  const [state, setState] = useState<ToggleState>({ all: false, breakfast: false, lunch: false });

  function refreshState() {
    setState({
      all: areAllChecked("ALL"),
      breakfast: areAllChecked("BREAKFAST"),
      lunch: areAllChecked("LUNCH"),
    });
  }

  function toggleTarget(target: WeeklyMealTarget) {
    const shouldCheck = !areAllChecked(target);
    const checkboxes = getEditableCheckboxes(target);

    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldCheck;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      checkbox.dispatchEvent(new Event("input", { bubbles: true }));
    });

    refreshState();
  }

  function clearAll() {
    const checkboxes = getEditableCheckboxes("ALL");

    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
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
      <button type="button" className="dashboard-action-button inline-flex items-center gap-2" aria-pressed={state.all} onClick={() => toggleTarget("ALL")}>
        <CalendarCheck2 className="h-4 w-4" />
        تیک کل برنامه
      </button>

      <button type="button" className="dashboard-action-button inline-flex items-center gap-2" aria-pressed={state.breakfast} onClick={() => toggleTarget("BREAKFAST")}>
        <Coffee className="h-4 w-4" />
        تیک همه صبحانه‌ها
      </button>

      <button type="button" className="dashboard-action-button inline-flex items-center gap-2" aria-pressed={state.lunch} onClick={() => toggleTarget("LUNCH")}>
        <UtensilsCrossed className="h-4 w-4" />
        تیک همه ناهارها
      </button>

      <button type="button" className="dashboard-action-button inline-flex items-center gap-2" onClick={clearAll}>
        <Eraser className="h-4 w-4" />
        پاک کردن همه
      </button>
    </div>
  );
}
