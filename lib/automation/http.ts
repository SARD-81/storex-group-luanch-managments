import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
export class AutomationError extends Error {
  constructor(
    public code: string,
    public httpStatus: number | null = null,
    public uncertain = false,
  ) {
    super(code);
  }
}
export function isPrivateAddress(address: string) {
  const a = address.toLowerCase();
  if (a.includes(":"))
    return (
      a === "::" ||
      a === "::1" ||
      a.startsWith("fc") ||
      a.startsWith("fd") ||
      /^(fe8|fe9|fea|feb)/.test(a) ||
      a.startsWith("::ffff:") ||
      a.startsWith("ff")
    );
  const [x, y] = a.split(".").map(Number);
  return (
    x === 0 ||
    x === 10 ||
    x === 127 ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && y === 168) ||
    (x === 100 && y >= 64 && y <= 127) ||
    (x === 192 && y === 0) ||
    (x === 192 && y === 2) ||
    (x === 198 && [18, 19, 51].includes(y)) ||
    (x === 203 && y === 0) ||
    x >= 224
  );
}
export async function safeFetch(
  urlValue: string,
  init: RequestInit = {},
  allowedHosts: string[],
  allowPrivateHosts: string[] = [],
) {
  let url = new URL(urlValue);
  for (let redirects = 0; redirects < 4; redirects++) {
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !allowedHosts.includes(url.hostname) ||
      (url.port && url.port !== "443")
    )
      throw new AutomationError("UNTRUSTED_URL");
    const addresses = isIP(url.hostname)
      ? [{ address: url.hostname }]
      : await lookup(url.hostname, { all: true }).catch(() => {
          throw new AutomationError("DNS_UNAVAILABLE");
        });
    if (
      !allowPrivateHosts.includes(url.hostname) &&
      addresses.some((a) => isPrivateAddress(a.address))
    )
      throw new AutomationError("PRIVATE_ADDRESS_BLOCKED");
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new AutomationError(
        "REMOTE_UNAVAILABLE",
        null,
        init.method === "POST",
      );
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      // Never follow credential-bearing redirects, or mutation redirects.
      if (init.headers || (init.method && init.method !== "GET"))
        throw new AutomationError("REDIRECT_BLOCKED");
      const location = response.headers.get("location");
      if (!location) throw new AutomationError("BAD_REDIRECT");
      url = new URL(location, url);
      continue;
    }
    return response;
  }
  throw new AutomationError("TOO_MANY_REDIRECTS");
}
export async function boundedBytes(response: Response, max = 20 * 1024 * 1024) {
  const reader = response.body?.getReader();
  if (!reader) throw new AutomationError("EMPTY_RESPONSE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new AutomationError("RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
