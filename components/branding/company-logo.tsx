import { prisma } from "@/lib/prisma";
import { getCurrentLogo } from "@/lib/branding/logo";
export async function CompanyLogo() {
  const logo = await getCurrentLogo(prisma);
  if (!logo) return null;
  return (
    <img
      src={`/api/branding/logo?v=${logo.revision}`}
      alt="نشان شرکت"
      width={120}
      height={56}
      className="mb-3 h-14 max-w-40 object-contain"
    />
  );
}
