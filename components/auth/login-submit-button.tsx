"use client";

import { useFormStatus } from "react-dom";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="login-primary-button group mt-2 flex w-full items-center justify-center rounded-2xl bg-foreground px-5 py-3.5 text-sm font-bold text-background shadow-lg shadow-black/15 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          در حال ورود...
        </span>
      ) : (
        <span className="inline-flex items-center justify-center gap-2">
          ورود
          <span className="transition duration-200 group-hover:-translate-x-0.5">
            ←
          </span>
        </span>
      )}
    </button>
  );
}
