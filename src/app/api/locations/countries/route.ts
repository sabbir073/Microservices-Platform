import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/locations/countries
// Public to logged-in users. Cached server-side for 1 hour with tag
// "locations:countries" — admin writes (PR 3) revalidate this tag.
const getCountries = unstable_cache(
  async () => {
    const rows = await prisma.country.findMany({
      where: { isActive: true },
      select: {
        id: true,
        iso2: true,
        name: true,
        flag: true,
        phoneCode: true,
        enabledLevels: true,
      },
      orderBy: { name: "asc" },
    });
    return rows;
  },
  ["locations:countries"],
  { revalidate: 3600, tags: ["locations:countries"] }
);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const countries = await getCountries();
  return NextResponse.json({ countries });
}
