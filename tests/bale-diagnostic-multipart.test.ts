import { test } from "node:test";
import assert from "node:assert/strict";
import { buildKnownLengthBaleDocumentMultipart } from "../lib/automation/bale-diagnostic-multipart";
import { probePdf } from "../lib/automation/capability-probe";

test("known-length document upload contains exactly one unmodified PDF part", () => {
  const pdf = probePdf();
  const result = buildKnownLengthBaleDocumentMultipart("123456", pdf);
  assert.match(result.contentType, /^multipart\/form-data; boundary=----storex-[a-f0-9]{32}$/);
  assert.equal(result.body.length, result.contentLength);
  assert.ok(result.body.includes(pdf));
  const raw = result.body.toString("latin1");
  const boundary = result.contentType.split("boundary=")[1];
  assert.ok(raw.startsWith("--" + boundary + "\r\n"));
  assert.ok(raw.endsWith("\r\n--" + boundary + "--\r\n"));
  assert.match(raw, /name="chat_id"\r\n\r\n123456\r\n/);
  assert.match(raw, /name="document"; filename="storex-diagnostic\.pdf"\r\nContent-Type: application\/pdf\r\n\r\n%PDF-/);
  assert.equal(raw.split('name="document"').length, 2);
});

test("known-length multipart rejects invalid recipient, filename and oversize file", () => {
  assert.throws(
    () => buildKnownLengthBaleDocumentMultipart("-123", probePdf()),
    /BALE_RECIPIENT_INVALID/,
  );
  assert.throws(
    () => buildKnownLengthBaleDocumentMultipart("123", probePdf(), "../bad.pdf"),
    /BALE_DIAGNOSTIC_FILENAME_INVALID/,
  );
  assert.throws(
    () => buildKnownLengthBaleDocumentMultipart("123", Buffer.alloc(0)),
    /BALE_DIAGNOSTIC_SIZE_INVALID/,
  );
  assert.throws(
    () => buildKnownLengthBaleDocumentMultipart("123", Buffer.alloc(50_000_001)),
    /BALE_DIAGNOSTIC_SIZE_INVALID/,
  );
});
