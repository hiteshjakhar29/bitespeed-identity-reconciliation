import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  // wipe existing data so we start fresh
  await prisma.contact.deleteMany();

  console.log("Cleared existing contacts.\n");

  // ── scenario from the assignment ──
  // Doc's first order
  const c1 = await prisma.contact.create({
    data: {
      phoneNumber: "123456",
      email: "lorraine@hillvalley.edu",
      linkPrecedence: "primary",
    },
  });
  console.log(`Created primary contact #${c1.id} — lorraine@hillvalley.edu / 123456`);

  // Doc's second order (same phone, different email)
  const c2 = await prisma.contact.create({
    data: {
      phoneNumber: "123456",
      email: "mcfly@hillvalley.edu",
      linkedId: c1.id,
      linkPrecedence: "secondary",
    },
  });
  console.log(`Created secondary contact #${c2.id} — mcfly@hillvalley.edu / 123456 (linked to #${c1.id})`);

  // ── two separate primaries (for merge testing) ──
  const c3 = await prisma.contact.create({
    data: {
      phoneNumber: "919191",
      email: "george@hillvalley.edu",
      linkPrecedence: "primary",
    },
  });
  console.log(`Created primary contact #${c3.id} — george@hillvalley.edu / 919191`);

  const c4 = await prisma.contact.create({
    data: {
      phoneNumber: "717171",
      email: "biffsucks@hillvalley.edu",
      linkPrecedence: "primary",
    },
  });
  console.log(`Created primary contact #${c4.id} — biffsucks@hillvalley.edu / 717171`);

  console.log("\nSeed complete! You can now test these scenarios:");
  console.log('  1. POST /identify {"phoneNumber":"123456"} → should return both lorraine + mcfly emails');
  console.log('  2. POST /identify {"email":"george@hillvalley.edu","phoneNumber":"717171"} → should merge contacts #' + c3.id + " and #" + c4.id);
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
