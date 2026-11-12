import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Urutan = hierarki, paling atas dulu.
const POSITIONS = ["OG", "UNDER OG", "BIG HOMIES", "HOMIES", "LIL HOMIES", "TAMU"];

try {
  for (const [i, name] of POSITIONS.entries()) {
    await prisma.position.upsert({
      where: { name },
      update: { sortOrder: i + 1 },
      create: { name, sortOrder: i + 1 },
    });
  }
  console.log("Seed jabatan selesai:", POSITIONS.join(" > "));
} finally {
  await prisma.$disconnect();
}
