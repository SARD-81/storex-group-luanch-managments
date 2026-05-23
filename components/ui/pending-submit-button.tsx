"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    pendingText?: string;
  };

export function PendingSubmitButton({
  children,
  pendingText = "در حال انجام...",
  className,
  type = "submit",
  disabled,
  name,
  value,
  ...props
}: PendingSubmitButtonProps) {
  const { pending, data } = useFormStatus();

  // بررسی اینکه آیا این دکمهِ خاص باعث ارسال فرم شده است یا دکمه کل ماه
  const targetDate = data?.get("targetDate");
  let isThisSpecificButton = false;

  if (name) {
    // اگر دکمه مربوط به یک روز خاص باشد (مقدار value دارد)
    isThisSpecificButton = targetDate === value;
  } else {
    // اگر دکمهِ "ذخیره کل ماه" باشد (name و value ندارد)
    isThisSpecificButton = !targetDate;
  }

  // فقط دکمه‌ای که کلیک شده حالت اسپینر می‌گیرد
  const isSpecificallyPending = pending && isThisSpecificButton;

  return (
    <button
      {...props}
      type={type}
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={isSpecificallyPending}
      className={className}
    >
      {isSpecificallyPending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}