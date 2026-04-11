# Trade Journal — Setup Guide

## 1. Create a Supabase Project

1. Go to https://supabase.com and sign in (or create a free account).
2. Click **New Project**, fill in name and database password, choose a region.
3. Wait ~2 minutes for your project to be provisioned.

## 2. Configure Environment Variables

1. In your Supabase dashboard go to **Settings → API**.
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key
3. In this project root, copy `.env.local.example` to `.env.local`:
   ```
   cp .env.local.example .env.local
   ```
4. Fill in the values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## 3. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**.
2. Click **New Query**.
3. Open `supabase/schema.sql` from this project and paste the entire contents.
4. Click **Run** (or press Ctrl+Enter).
5. Confirm that the tables `trades`, `journal_entries`, `psychology_checkins`, and `account_settings` appear in the **Table Editor**.

## 4. Create the Storage Bucket

1. In your Supabase dashboard, go to **Storage**.
2. Click **Create a new bucket**.
3. Set the name to exactly: `journal-images`
4. Leave **Public bucket** UNCHECKED (private bucket so only authenticated users can access their own images).
5. Click **Create bucket**.
6. (Optional) If you want image upload in the journal to work, also set a storage policy:
   - Go to **Storage → Policies** → select `journal-images` bucket.
   - Add a policy: allow authenticated users to INSERT and SELECT on objects where `auth.uid()::text = (storage.foldername(name))[1]`.

## 5. Enable Email Auth (if not already)

1. Go to **Authentication → Providers**.
2. Make sure **Email** is enabled (it is by default).
3. For development, you may want to disable "Confirm email" under **Authentication → Settings** so signups work without email confirmation.

## 6. Start the Dev Server

```bash
npm run dev
```

Open http://localhost:3000. You will be redirected to `/login`. Sign up with any email/password, then start adding trades.

## 7. (Optional) Deploy to Vercel

1. Push to a GitHub repo.
2. Import the project in https://vercel.com.
3. Add the same environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings under **Environment Variables**.
4. Deploy.

## Route Reference

| Route | Description |
|-------|-------------|
| `/` | Dashboard — equity curve, P&L stats, prop firm rules |
| `/trades` | Trade log — add/edit/delete trades |
| `/calendar` | Calendar view — P&L by day |
| `/journal` | Rich text journal with Tiptap editor + templates |
| `/analysis` | Analysis tabs — overview, by contract, by time, by setup |
| `/psychology` | Daily check-in sliders + mood calendar + streak |
| `/settings` | Account name, starting balance, prop firm limits |
| `/login` | Sign in |
| `/signup` | Create account |
