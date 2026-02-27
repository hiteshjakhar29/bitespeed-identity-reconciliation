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
- Docker (for Postgres) or a Postgres instance running somewhere

### Steps

```bash
# 1. spin up postgres
docker compose up -d

# 2. install dependencies
npm install

# 3. create your .env from the example
cp .env.example .env

# 4. generate prisma client + run migration
npx prisma generate
npx prisma migrate dev --name init

# 5. start the dev server
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
- **Database:** PostgreSQL
- **ORM:** Prisma

## Project structure

```
src/
  index.ts      → Express server, route handler
  identify.ts   → Core reconciliation logic
  prisma.ts     → Prisma client instance
prisma/
  schema.prisma → Database schema
```
