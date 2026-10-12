import { test } from "node:test";
import assert from "node:assert/strict";
import { reporterReviewUrl } from "../lib/automation/reminder-link";
test("reminder links use a fixed authenticated Reporter route and reject credentials, query, fragments and insecure origins", () => {
  const prior = process.env.STOREX_APP_ORIGIN;
  try {
    for (const invalid of [
      "",
      "http://example.test",
      "https://user:password@example.test",
      "https://example.test/path",
      "https://example.test/?token=secret",
      "https://example.test/#fragment",
      "https://example.test:444",
    ]) {
      process.env.STOREX_APP_ORIGIN = invalid;
      assert.throws(reporterReviewUrl, /REPORTER_APP_ORIGIN_REQUIRED/);
    }
    process.env.STOREX_APP_ORIGIN = "https://storex.example.test";
    assert.equal(
      reporterReviewUrl(),
      "https://storex.example.test/reporter/next-day",
    );
  } finally {
    if (prior === undefined) delete process.env.STOREX_APP_ORIGIN;
    else process.env.STOREX_APP_ORIGIN = prior;
  }
});
