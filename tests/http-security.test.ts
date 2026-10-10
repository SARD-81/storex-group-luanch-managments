import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { fetch } from "undici";
import { safeFetch, pinnedDispatcher } from "../lib/automation/http";

test("a mixed public/private DNS answer and an empty answer are rejected before connection", async () => {
  let resolutions = 0;
  await assert.rejects(
    () =>
      safeFetch(
        "https://pinning.invalid",
        {},
        ["pinning.invalid"],
        [],
        async () => {
          resolutions++;
          return [
            { address: "93.184.216.34", family: 4 },
            { address: "127.0.0.1", family: 4 },
          ];
        },
      ),
    /PRIVATE_ADDRESS_BLOCKED/,
  );
  assert.equal(resolutions, 1);
  await assert.rejects(
    () =>
      safeFetch(
        "https://pinning.invalid",
        {},
        ["pinning.invalid"],
        [],
        async () => [],
      ),
    /DNS_UNAVAILABLE/,
  );
});

test("a real TLS socket uses the pinned address while preserving SNI, certificate trust and hostname validation", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "automation-tls-"));
  const certPath = path.join(directory, "cert.pem"),
    keyPath = path.join(directory, "key.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=pinning.invalid",
      "-addext",
      "subjectAltName=DNS:pinning.invalid",
      "-keyout",
      keyPath,
      "-out",
      certPath,
    ],
    { stdio: "ignore" },
  );
  const certificate = await readFile(certPath, "utf8");
  let connections = 0,
    observedSni = "";
  const server = createServer(
    { key: await readFile(keyPath), cert: certificate },
    (request, response) => {
      observedSni =
        (request.socket as import("node:tls").TLSSocket).servername || "";
      response.end("pinned TLS response");
    },
  );
  server.on("connection", () => connections++);
  server.on("tlsClientError", () => {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as import("node:net").AddressInfo).port;
  const addresses = [{ address: "127.0.0.1", family: 4 }];
  const trusted = pinnedDispatcher(addresses, certificate);
  const untrusted = pinnedDispatcher(addresses);
  // Changing resolver-owned data after verification must not redirect the connection.
  addresses[0].address = "192.0.2.1";
  try {
    const response = await fetch(`https://pinning.invalid:${port}/`, {
      dispatcher: trusted,
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(await response.text(), "pinned TLS response");
    assert.equal(observedSni, "pinning.invalid");
    assert.ok(
      connections >= 1,
      "an unresolvable hostname must reach the pinned socket",
    );
    await assert.rejects(
      () =>
        fetch(`https://wrong.invalid:${port}/`, {
          dispatcher: trusted,
          signal: AbortSignal.timeout(5000),
        }),
      (error: Error & { cause?: { code?: string } }) =>
        error.cause?.code === "ERR_TLS_CERT_ALTNAME_INVALID",
    );
    await assert.rejects(
      () =>
        fetch(`https://pinning.invalid:${port}/`, {
          dispatcher: untrusted,
          signal: AbortSignal.timeout(5000),
        }),
      (error: Error & { cause?: { code?: string } }) =>
        error.cause?.code === "DEPTH_ZERO_SELF_SIGNED_CERT",
    );
  } finally {
    await trusted.destroy();
    await untrusted.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
