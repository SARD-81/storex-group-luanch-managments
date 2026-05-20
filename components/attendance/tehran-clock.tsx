"use client";

import { useEffect, useState } from "react";

type TimeResponse = {
  nowIso: string;
  formatted: string;
  source: string;
  time?: string;
};

export function TehranClock() {
  const [formatted, setFormatted] = useState<string>("--:--");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchTime = async () => {
      try {
        const response = await fetch("/api/time", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("failed");
        }

        const data = (await response.json()) as TimeResponse;
        if (!mounted) {
          return;
        }

        setFormatted(data.time ?? data.formatted);
        setHasError(false);
      } catch {
        if (!mounted) {
          return;
        }

        setHasError(true);
      }
    };

    void fetchTime();
    const interval = setInterval(() => {
      void fetchTime();
    }, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <p className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-200 backdrop-blur dark:bg-white/[0.04]">
      {hasError ? "ساعت تهران --:--" : `ساعت تهران ${formatted}`}
    </p>
  );
}
