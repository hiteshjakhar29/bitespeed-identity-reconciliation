import { Prisma } from "@prisma/client";
import prisma from "./prisma";

// ── tiny helpers ──────────────────────────────────────────────

/** phoneNumber can arrive as a number from JSON, so coerce to string */
function cleanPhone(raw?: string | number | null): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function cleanEmail(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  return s.length > 0 ? s : null;
}

/** dedupe while preserving order */
function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// ── main handler ──────────────────────────────────────────────

export async function handleIdentify(body: {
  email?: string | null;
  phoneNumber?: string | number | null;
}) {
  const email = cleanEmail(body.email);
  const phone = cleanPhone(body.phoneNumber);

  if (!email && !phone) {
    throw new Error("Need at least an email or phoneNumber");
  }

  // wrap everything in a transaction so concurrent calls don't create
  // duplicate primaries or half-finished merges
  return prisma.$transaction(async (tx) => {
    // ── step 1: find any existing rows that share email or phone ──

    const conditions: Prisma.ContactWhereInput[] = [];
    if (email) conditions.push({ email });
    if (phone) conditions.push({ phoneNumber: phone });

    const matches = await tx.contact.findMany({
      where: { deletedAt: null, OR: conditions },
      orderBy: { createdAt: "asc" },
    });

    // ── step 2: brand new customer — nothing in DB matches ──

    if (matches.length === 0) {
      const fresh = await tx.contact.create({
        data: {
          email,
          phoneNumber: phone,
          linkPrecedence: "primary",
        },
      });

      return buildResponse(fresh.id, [fresh]);
    }

    // ── step 3: figure out which primary(ies) these matches belong to ──
    //
    // a matched row might itself be secondary, so we look up its linkedId
    // to get the actual primary it belongs to.

    const primaryIds = unique(
      matches.map((c) =>
        c.linkPrecedence === "primary" ? c.id : (c.linkedId as number)
      )
    );

    // pull in the full cluster — the primaries themselves + all their secondaries
    const cluster = await tx.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          { id: { in: primaryIds } },
          { linkedId: { in: primaryIds } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // ── step 4: if the request bridges two separate groups, merge them ──
    //
    // the oldest primary wins; younger primaries get demoted to secondary
    // and all their children get re-pointed to the winner.

    const allPrimaries = cluster
      .filter((c) => c.linkPrecedence === "primary")
      .sort((a, b) => {
        // oldest first; break ties with lower id
        const diff = a.createdAt.getTime() - b.createdAt.getTime();
        return diff !== 0 ? diff : a.id - b.id;
      });

    const winner = allPrimaries[0];
    const losers = allPrimaries.slice(1);

    if (losers.length > 0) {
      const loserIds = losers.map((l) => l.id);

      // demote the losing primaries themselves
      await tx.contact.updateMany({
        where: { id: { in: loserIds } },
        data: {
          linkPrecedence: "secondary",
          linkedId: winner.id,
        },
      });

      // re-point any secondaries that were under the losers
      await tx.contact.updateMany({
        where: { linkedId: { in: loserIds } },
        data: { linkedId: winner.id },
      });
    }

    // ── step 5: maybe create a new secondary ──
    //
    // only if the incoming request actually carries info the cluster
    // doesn't already know about. no point creating a duplicate row.

    const refreshed = await tx.contact.findMany({
      where: {
        deletedAt: null,
        OR: [{ id: winner.id }, { linkedId: winner.id }],
      },
      orderBy: { createdAt: "asc" },
    });

    const knownEmails = new Set(
      refreshed.map((c) => c.email).filter(Boolean) as string[]
    );
    const knownPhones = new Set(
      refreshed.map((c) => c.phoneNumber).filter(Boolean) as string[]
    );

    const emailIsNew = email !== null && !knownEmails.has(email);
    const phoneIsNew = phone !== null && !knownPhones.has(phone);

    if (emailIsNew || phoneIsNew) {
      await tx.contact.create({
        data: {
          email,
          phoneNumber: phone,
          linkedId: winner.id,
          linkPrecedence: "secondary",
        },
      });
    }

    // ── step 6: final read — build the response ──

    const final = await tx.contact.findMany({
      where: {
        deletedAt: null,
        OR: [{ id: winner.id }, { linkedId: winner.id }],
      },
      orderBy: { createdAt: "asc" },
    });

    return buildResponse(winner.id, final);
  });
}

// ── response builder ──────────────────────────────────────────

function buildResponse(
  primaryId: number,
  rows: {
    id: number;
    email: string | null;
    phoneNumber: string | null;
    linkPrecedence: string;
  }[]
) {
  const primary = rows.find((r) => r.id === primaryId)!;

  // collect all unique emails & phones, but make sure the primary's
  // values come first in the array (requirement from the spec)
  let emails = unique(
    rows.map((r) => r.email).filter(Boolean) as string[]
  );
  let phones = unique(
    rows.map((r) => r.phoneNumber).filter(Boolean) as string[]
  );

  if (primary.email) {
    emails = [primary.email, ...emails.filter((e) => e !== primary.email)];
  }
  if (primary.phoneNumber) {
    phones = [
      primary.phoneNumber,
      ...phones.filter((p) => p !== primary.phoneNumber),
    ];
  }

  const secondaryIds = rows
    .filter((r) => r.id !== primaryId)
    .map((r) => r.id);

  return {
    contact: {
      primaryContatctId: primaryId, // yes, the typo is intentional — matches the spec
      emails,
      phoneNumbers: phones,
      secondaryContactIds: secondaryIds,
    },
  };
}
