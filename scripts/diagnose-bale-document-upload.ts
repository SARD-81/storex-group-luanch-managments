/**
 * Controlled, one-shot Bale document upload diagnostic.
 * Distinguishes PDF/content rejection from Node FormData multipart encoding.
 * Never runs under the worker, never retries, never stores business data.
 */
import "dotenv/config";
import { chromium } from "playwright";
import { prisma } from "../lib/prisma";
import { getAutomationConfig } from "../lib/automation/config";
import { BaleClient, classifyBaleDocumentBadRequest } from "../lib/automation/integrations";
import { validateBalePdf } from "../lib/automation/integrations";
import { safeFetch, AutomationError } from "../lib/automation/http";
import { buildKnownLengthBaleDocumentMultipart } from "../lib/automation/bale-diagnostic-multipart";
import { createHash } from "node:crypto";

type BaleResult = { ok?: unknown; result?: {
  message_id?: unknown;
  chat?: { id?: unknown; type?: unknown };
}; error_code?: unknown; description?: unknown };

async function makeSyntheticPdf(): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<!doctype html><html><head><meta charset="UTF-8"></head>' +
      '<body style="font:18px Arial,sans-serif; padding:24px">' +
      '<h1>StoreX PDF transport test</h1>' +
      '<p>Synthetic diagnostic PDF. No company or employee data.</p>' +
      '<p>Used only to diagnose Bale sendDocument file delivery.</p>' +
      '</body></html>',
      { waitUntil: "load" },
    );
    const pdf = Buffer.from(await page.pdf({ format: "A5", printBackground: true }));
    validateBalePdf({
      bytes: pdf,
      filename: "storex-diagnostic.pdf",
      mimeType: "application/pdf",
      sha256: createHash("sha256").update(pdf).digest("hex"),
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

async function main() {
  const mode = process.argv[2] ?? "--check";
  if (!["--check", "--send-once", "--send-with-caption-once"].includes(mode) || process.argv.length > 3)
    throw new Error("INVALID_DIAGNOSTIC_ARGUMENT");
  if (process.env.STOREX_ENVIRONMENT !== "staging")
    throw new Error("CONTROLLED_STAGING_REQUIRED");
  const config = await getAutomationConfig(prisma);
  if (config.reporterEnabled)
    throw new Error("PAUSE_REPORTER_DURING_PROBE");

  const bale = new BaleClient();
  await bale.health();
  await bale.privateChat(config.reportRecipient);
  const pdf = await makeSyntheticPdf();
  console.log(JSON.stringify({
    stage: "KNOWN_LENGTH_UPLOAD_READY",
    success: true,
    mode,
    source: "playwright-synthetic-a5",
    pdfBytes: pdf.byteLength,
    recipientValidated: true,
    includesEmployeeData: false,
  }));
  if (mode === "--check") return;

  const token = process.env.BALE_BOT_TOKEN;
  if (!token) throw new Error("BALE_NOT_CONFIGURED");
  const input = buildKnownLengthBaleDocumentMultipart(
    config.reportRecipient,
    pdf,
    "storex-diagnostic.pdf",
    mode === "--send-with-caption-once"
      ? "آزمون فایل PDF استورکس؛ این متن صرفاً کپشن آزمایشی است و هیچ اطلاعاتی از کارکنان ندارد."
      : undefined,
  );
  // Use the same pinned-host HTTPS transport as production, but write a
  // fixed-length multipart body instead of the standard FormData encoder.
  // A single request only: no fallback, redirects or automatic retry.
  const response = await safeFetch(
    `https://tapi.bale.ai/bot${token}/sendDocument`,
    {
      method: "POST",
      headers: {
        "Content-Type": input.contentType,
        "Content-Length": String(input.contentLength),
      },
      body: new Uint8Array(input.body),
    },
    ["tapi.bale.ai"],
  );
  const value = await response.json().catch(() => null) as BaleResult | null;
  if (!response.ok || value?.ok !== true) {
    const description = typeof value?.description === "string" ? value.description : "";
    const code = response.status === 400
      ? classifyBaleDocumentBadRequest(description)
      : "BALE_DOCUMENT_DIAGNOSTIC_REJECTED";
    console.log(JSON.stringify({
      stage: "KNOWN_LENGTH_UPLOAD_RESPONSE",
      success: false,
      code,
      httpStatus: response.status,
      providerDescriptionLength: description.length,
      // This identifies when Bale returns no meaningful explanation,
      // without printing arbitrary third-party response content.
      providerDescriptionGeneric: /^(?:bad request|bad request: bad request|invalid parameters?)\.?$/i.test(description.trim()),
      rawProviderDescriptionExposed: false,
    }));
    process.exitCode = 1;
    return;
  }

  const result = value?.result;
  if (
    !/^[1-9]\d{0,15}$/.test(String(result?.message_id ?? "")) ||
    result?.chat?.type !== "private" ||
    String(result.chat.id) !== config.reportRecipient
  ) throw new AutomationError("BALE_DOCUMENT_RECEIPT_INVALID", null, true);
  console.log(JSON.stringify({
    stage: "KNOWN_LENGTH_UPLOAD_ACCEPTED",
    success: true,
    messageId: String(result.message_id),
    manualReceptionConfirmationRequired: true,
    automaticDeletion: false,
    includedCaption: mode === "--send-with-caption-once",
  }));
}

main().catch(e => {
  console.error(JSON.stringify({
    success: false,
    code: e instanceof AutomationError ? e.code :
      e instanceof Error && /^[A-Z0-9_]+$/.test(e.message) ? e.message : "DIAGNOSTIC_INTERNAL_FAILURE",
    uncertain: e instanceof AutomationError ? e.uncertain : true,
  }));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
