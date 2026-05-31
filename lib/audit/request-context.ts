import { headers } from "next/headers";

export type AuditRequestContext = {
  requestMethod: string | null;
  requestPath: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

const emptyAuditRequestContext: AuditRequestContext = {
  requestMethod: null,
  requestPath: null,
  ipAddress: null,
  userAgent: null,
};

function firstForwardedIp(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export async function getAuditRequestContext(): Promise<AuditRequestContext> {
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");

    return {
      requestMethod:
        headersList.get("x-forwarded-method") ?? headersList.get("x-method"),
      requestPath:
        headersList.get("x-forwarded-uri") ??
        headersList.get("x-invoke-path") ??
        headersList.get("x-pathname"),
      ipAddress: firstForwardedIp(forwardedFor) ?? headersList.get("x-real-ip"),
      userAgent: headersList.get("user-agent"),
    };
  } catch {
    return emptyAuditRequestContext;
  }
}
