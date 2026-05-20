"use client";

import { useEffect, useState } from "react";

type TimeResponse = {
  nowIso: string;
  formatted: string;
  source: string;
};

export function TehranClock() {
  const [formatted, setFormatted] = useState<string>("در حال دریافت زمان تهران...");
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

        setFormatted(data.formatted);
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
    <p className="text-sm text-zinc-400">
      {hasError ? "نمایش ساعت تهران موقتاً در دسترس نیست." : formatted}
    </p>
  );
}
