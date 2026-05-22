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
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
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
