import { AutomationError } from "./http";
/** Fixed authenticated route: no public access token, query-controlled URL or bot reply workflow. */
export function reporterReviewUrl() {
  try {
    const url = new URL(process.env.STOREX_APP_ORIGIN ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      (url.port && url.port !== "443")
    )
      throw new Error();
    return new URL("/reporter/next-day", url).toString();
  } catch {
    throw new AutomationError("REPORTER_APP_ORIGIN_REQUIRED");
  }
}
