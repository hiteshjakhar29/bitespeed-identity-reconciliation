# Bitespeed Identity Reconciliation

A web service that links customer identities across multiple purchases, even when they use different email addresses and phone numbers.

## How it works

The `/identify` endpoint receives an email and/or phone number and figures out which existing customer (if any) they belong to. It handles three cases:

1. **New customer** — no matches found, creates a fresh primary contact
2. **Known customer, new info** — one field matches but the other is new, creates a secondary contact linked to the existing primary
3. **Merging two customers** — email matches one group and phone matches another, merges them by demoting the newer primary to secondary

All of this runs inside a database transaction to avoid race conditions.

## Setup

### Prerequisites
- Node.js 18+
- A Postgres database (I used [Neon](https://neon.tech) — free tier, no setup needed)

### Steps

```bash
# 1. install dependencies
npm install

# 2. create your .env and paste your database URL
cp .env.example .env
# edit .env → set DATABASE_URL to your Neon connection string

# 3. generate prisma client + run migration
npx prisma generate
npx prisma migrate dev --name init

# 4. start the dev server
npm run dev
```

### Test it

```bash
# first request — creates a new primary
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"lorraine@hillvalley.edu","phoneNumber":"123456"}' | jq

# second request — same phone, new email → creates secondary
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"mcfly@hillvalley.edu","phoneNumber":"123456"}' | jq

# query by phone only — returns the consolidated contact
curl -s -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"123456"}' | jq
```

### Build for production

```bash
npm run build
npm start
```

## Tech stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Database:** PostgreSQL (hosted on [Neon](https://neon.tech))
- **ORM:** Prisma
- **CI/CD:** GitHub Actions

## Project structure

```
src/
  index.ts        → Express server, route handler
  identify.ts     → Core reconciliation logic
  prisma.ts       → Prisma client instance
prisma/
  schema.prisma   → Database schema
  seed.ts         → Seed script with sample data from the assignment
tests/
  identify.test.ts → Integration tests covering all scenarios
postman/
  Bitespeed_Identity.postman_collection.json → Ready-to-import Postman collection
.github/
  workflows/
    ci.yml        → CI pipeline (type check + build)
```

## Seed the database

Pre-populate the database with the sample data from the assignment:

```bash
npm run seed
```

## Run tests

Make sure the server is running in one terminal (`npm run dev`), then in another:

```bash
npm test
```

This runs integration tests against all scenarios — new customer, secondary creation, phone/email-only queries, merging primaries, duplicate handling, and error cases.

## Postman collection

Import `postman/Bitespeed_Identity.postman_collection.json` into Postman. It has pre-configured requests for every scenario. Update the `baseUrl` variable to point to your local or deployed instance.

## Live Endpoint

The service is hosted at: https://bitespeed-identity-3z16.onrender.com/identify
