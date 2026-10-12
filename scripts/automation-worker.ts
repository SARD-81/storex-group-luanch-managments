import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  withWorkerLock,
  workerTick,
  workerCleanupTick,
} from "../lib/automation/worker";
import { cleanError } from "../lib/automation/jobs";
async function main() {
  if (
    process.argv.slice(2).some((a) => !["--once", "--cleanup-only"].includes(a))
  )
    throw new Error("UNSUPPORTED_WORKER_ARGUMENT");
  console.log(
    JSON.stringify({
      worker: await withWorkerLock(async () =>
        process.argv.includes("--cleanup-only")
          ? await workerCleanupTick(prisma)
          : await workerTick(prisma),
      ),
    }),
  );
}
main()
  .catch((e) => {
    console.error(JSON.stringify({ worker: "FAILED", ...cleanError(e) }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
