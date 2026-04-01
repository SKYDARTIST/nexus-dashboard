# Nexus Dashboard

Internal analytics dashboard for Anti-Gravity: Private AI PDF.

**[Live Dashboard →](https://nexus-dashboard-dusky.vercel.app)**

---

## What It Tracks

- **Users** — total, active (5min / 1hr / 24hr), new today
- **Payments** — real-time success/failure rate, failed count (last 24h), revenue by product
- **Transactions** — live feed with status, amount, error messages
- **Failure Analysis** — top 5 payment failure reasons

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + Realtime)
- **Deployment**: Vercel

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Add Supabase URL + anon key
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

## Database Setup

Run `schema-migration.sql` in your Supabase SQL Editor to add:

- `status` column — `success | failed | pending`
- `error_message` column — failure reason
- `amount` / `currency` columns — transaction value
- Performance indexes + optional `daily_metrics` view

## Troubleshooting

**No data showing?**
- Check Supabase connection in `.env`
- Verify RLS policies allow reads

**Metrics showing 0?**
- Run `schema-migration.sql` to add missing columns

**Real-time not updating?**
- Ensure Supabase Realtime is enabled on the tables
- Check Network tab for websocket connections
