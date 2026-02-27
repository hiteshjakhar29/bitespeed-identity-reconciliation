/**
 * Integration tests for /identify endpoint.
 *
 * Usage:
 *   1. Make sure the server is running (npm run dev)
 *   2. Run: npx ts-node tests/identify.test.ts
 *
 * These tests hit the actual API and database, so they're closer
 * to integration tests than unit tests. They verify the exact
 * scenarios described in the assignment.
 */

const BASE = process.env.API_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

async function post(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/identify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
  }
}

// ── helpers ──

function arraysMatch(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

// ── tests ──

async function testNewCustomer() {
  console.log("\n── Test 1: New customer (no existing matches) ──");

  const res = await post({
    email: "doc@hillvalley.edu",
    phoneNumber: "88888",
  });

  const c = res.contact;
  assert(c.primaryContatctId > 0, "returns a valid primary id");
  assert(arraysMatch(c.emails, ["doc@hillvalley.edu"]), "emails contain only the new email");
  assert(arraysMatch(c.phoneNumbers, ["88888"]), "phoneNumbers contain only the new phone");
  assert(c.secondaryContactIds.length === 0, "no secondary contacts");
}

async function testSecondaryCreation() {
  console.log("\n── Test 2: Same phone, new email (creates secondary) ──");

  const res = await post({
    email: "emmett@hillvalley.edu",
    phoneNumber: "88888",
  });

  const c = res.contact;
  assert(c.emails.includes("doc@hillvalley.edu"), "primary email is present");
  assert(c.emails.includes("emmett@hillvalley.edu"), "new email is present");
  assert(c.emails[0] === "doc@hillvalley.edu", "primary email comes first");
  assert(c.secondaryContactIds.length === 1, "one secondary contact created");
}

async function testPhoneOnlyQuery() {
  console.log("\n── Test 3: Query by phone only (returns consolidated) ──");

  const res = await post({ phoneNumber: "88888" });

  const c = res.contact;
  assert(c.emails.length === 2, "returns both emails");
  assert(c.phoneNumbers.length === 1, "returns one phone");
  assert(c.secondaryContactIds.length === 1, "still one secondary");
}

async function testEmailOnlyQuery() {
  console.log("\n── Test 4: Query by email only ──");

  const res = await post({ email: "emmett@hillvalley.edu" });

  const c = res.contact;
  assert(c.emails.length === 2, "returns both emails from cluster");
  assert(c.phoneNumbers.includes("88888"), "phone is included");
}

async function testMergeTwoPrimaries() {
  console.log("\n── Test 5: Merge two separate primaries ──");

  // create a separate customer first
  const before = await post({
    email: "marty@hillvalley.edu",
    phoneNumber: "77777",
  });
  assert(before.contact.secondaryContactIds.length === 0, "starts as independent primary");

  // now bridge doc's phone with marty's email
  const after = await post({
    email: "marty@hillvalley.edu",
    phoneNumber: "88888",
  });

  const c = after.contact;
  assert(c.emails.includes("doc@hillvalley.edu"), "doc's email in merged result");
  assert(c.emails.includes("marty@hillvalley.edu"), "marty's email in merged result");
  assert(c.phoneNumbers.includes("88888"), "doc's phone in merged result");
  assert(c.phoneNumbers.includes("77777"), "marty's phone in merged result");
  assert(c.secondaryContactIds.length >= 2, "at least 2 secondaries after merge");
}

async function testDuplicateRequest() {
  console.log("\n── Test 6: Duplicate request (no new secondary) ──");

  const first = await post({
    email: "doc@hillvalley.edu",
    phoneNumber: "88888",
  });

  const second = await post({
    email: "doc@hillvalley.edu",
    phoneNumber: "88888",
  });

  assert(
    first.contact.secondaryContactIds.length === second.contact.secondaryContactIds.length,
    "no extra secondary created on duplicate request"
  );
}

async function testEmptyRequest() {
  console.log("\n── Test 7: Empty request (should return 400) ──");

  const res = await fetch(`${BASE}/identify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  assert(res.status === 400, "returns 400 for empty body");
}

// ── runner ──

async function run() {
  console.log("Running tests against:", BASE);

  await testNewCustomer();
  await testSecondaryCreation();
  await testPhoneOnlyQuery();
  await testEmailOnlyQuery();
  await testMergeTwoPrimaries();
  await testDuplicateRequest();
  await testEmptyRequest();

  console.log(`\n═══════════════════════════════`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════\n`);

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});
