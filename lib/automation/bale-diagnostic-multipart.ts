import { randomBytes } from "node:crypto";

export function buildKnownLengthBaleDocumentMultipart(
  recipient: string,
  pdf: Buffer,
  filename = "storex-diagnostic.pdf",
) {
  if (!/^[1-9]\d{0,15}$/.test(recipient) ||
      !Number.isSafeInteger(Number(recipient)))
    throw new Error("BALE_RECIPIENT_INVALID");
  if (!/^[a-zA-Z0-9_-]+\.pdf$/.test(filename))
    throw new Error("BALE_DIAGNOSTIC_FILENAME_INVALID");
  if (!pdf.length || pdf.length > 50_000_000)
    throw new Error("BALE_DIAGNOSTIC_SIZE_INVALID");
  const boundary = "----storex-" + randomBytes(16).toString("hex");
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="chat_id"\r\n\r\n' +
    `${recipient}\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n` +
    "Content-Type: application/pdf\r\n\r\n",
    "utf8",
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([prefix, pdf, suffix]);
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
    contentLength: body.byteLength,
  };
}
