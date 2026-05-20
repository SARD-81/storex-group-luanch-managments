import { formatPersianDateTime, getServerNow } from "@/lib/date/tehran-time";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  const fallbackNow = getServerNow();

  if (!process.env.TIME_API_URL) {
    return Response.json(
      {
        nowIso: fallbackNow.toISOString(),
        formatted: formatPersianDateTime(fallbackNow),
        source: "server",
      },
      { headers },
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(process.env.TIME_API_URL, {
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error("time api failed");
    }

    const data = (await response.json()) as { nowIso?: unknown };
    const nowIsoValue = typeof data.nowIso === "string" ? data.nowIso : null;
    const externalDate = nowIsoValue ? new Date(nowIsoValue) : null;

    if (!externalDate || Number.isNaN(externalDate.getTime())) {
      throw new Error("invalid time api payload");
    }

    return Response.json(
      {
        nowIso: externalDate.toISOString(),
        formatted: formatPersianDateTime(externalDate),
        source: "external",
      },
      { headers },
    );
  } catch {
    const serverNow = getServerNow();

    return Response.json(
      {
        nowIso: serverNow.toISOString(),
        formatted: formatPersianDateTime(serverNow),
        source: "server",
      },
      { headers },
    );
  }
}
