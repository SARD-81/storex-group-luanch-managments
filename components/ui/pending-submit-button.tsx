"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText: string;
};

export function PendingSubmitButton({ pendingText, children, disabled, ...props }: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button {...props} disabled={disabled || pending}>
      {pending ? pendingText : children}
    </button>
  );
}
