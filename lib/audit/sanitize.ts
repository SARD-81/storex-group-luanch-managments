export type JsonSafeValue =
  | string
  | number
  | boolean
  | null
  | JsonSafeValue[]
  | { [key: string]: JsonSafeValue };

export const SENSITIVE_AUDIT_KEYS = [
  "password",
  "newPassword",
  "passwordHash",
  "token",
  "tokenHash",
  "session",
  "avatarImage",
] as const;

const SENSITIVE_AUDIT_KEY_SET = new Set(
  SENSITIVE_AUDIT_KEYS.map((key) => key.toLowerCase()),
);

const BINARY_OMITTED = "[binary omitted]";

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFile(value: unknown): boolean {
  return typeof File !== "undefined" && value instanceof File;
}

function isBlob(value: unknown): boolean {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function isBuffer(value: unknown): boolean {
  return typeof Buffer !== "undefined" && Buffer.isBuffer(value);
}

function isBinaryLike(value: unknown): boolean {
  return (
    isFile(value) ||
    isBlob(value) ||
    isBuffer(value) ||
    value instanceof ArrayBuffer ||
    value instanceof Uint8Array ||
    ArrayBuffer.isView(value)
  );
}

function sanitizeObjectEntries(
  value: Record<string, unknown>,
  seen: WeakSet<object>,
): JsonSafeValue {
  const sanitized: { [key: string]: JsonSafeValue } = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (SENSITIVE_AUDIT_KEY_SET.has(key.toLowerCase())) {
      continue;
    }

    sanitized[key] = sanitizeAuditValueInternal(entryValue, seen);
  }

  return sanitized;
}

function sanitizeUnsupportedObject(value: object, seen: WeakSet<object>): JsonSafeValue {
  try {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length > 0) {
      return sanitizeObjectEntries(Object.fromEntries(entries), seen);
    }
  } catch {
    // Fall through to the string representation below.
  }

  try {
    return String(value);
  } catch {
    return "[unserializable omitted]";
  }
}

function sanitizeAuditValueInternal(value: unknown, seen: WeakSet<object>): JsonSafeValue {
  try {
    if (value === null) {
      return null;
    }

    if (value === undefined) {
      return null;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (typeof value === "symbol" || typeof value === "function") {
      return String(value);
    }

    if (isBinaryLike(value)) {
      return BINARY_OMITTED;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === "object") {
      if (seen.has(value)) {
        return "[circular omitted]";
      }

      seen.add(value);

      if (Array.isArray(value)) {
        return value.map((entry) => sanitizeAuditValueInternal(entry, seen));
      }

      if (isPlainObject(value)) {
        return sanitizeObjectEntries(value, seen);
      }

      return sanitizeUnsupportedObject(value, seen);
    }

    return String(value);
  } catch {
    try {
      return String(value);
    } catch {
      return "[unserializable omitted]";
    }
  }
}

export function sanitizeAuditValue(value: unknown): unknown {
  return sanitizeAuditValueInternal(value, new WeakSet<object>());
}
