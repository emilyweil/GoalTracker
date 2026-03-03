# College Tracker

Track college application deadlines and weekly goals.

## Setup

### Step 1: Supabase

Go to supabase.com, create a free project. Open the SQL Editor, paste supabase-setup.sql contents, and hit Run.

Then go to Authentication, Settings and disable Confirm email.

### Step 2: Get your keys

In Supabase go to Settings, API. Copy Project URL and anon public key.

### Step 3: Local setup

```
cd college-tracker
npm install
cp .env.example .env
```

Edit .env with your Supabase values. Run npm run dev to test.

### Step 4: Deploy

```
git init
git add .
git commit -m "Initial commit"
```

Push to GitHub, import in Vercel. Add env vars VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel settings.
