# AutoScheduler

AI-powered calendar assistant that automatically schedules your tasks around your existing events.

## Quick Start (Windows)

### Option A: Clone from GitHub
```
git clone https://github.com/TeamRoseyCo/autoscheduler.git
cd autoscheduler
```
Then double-click **`SETUP.bat`** — it installs everything automatically.

### Option B: Got a zip file?
Extract it, then double-click **`SETUP.bat`**.

That's it. The setup wizard handles Node.js, Git, dependencies, and database — no technical knowledge needed.

## Usage

1. Double-click **"Start AutoScheduler"** on your Desktop (created by setup), or run `start.bat`
2. Choose **Launch in Browser** (option 2)
3. Sign in with Google
4. Go to **Settings** → enter your AI API key (Gemini or OpenAI)

The app auto-updates every time you launch it.

## Features

- Week / 4-day / Day / Month calendar views
- AI auto-scheduling based on your availability and energy levels
- Google Calendar sync (two-way)
- Projects and task management with drag & drop
- Transport buffer estimation (Google Maps)
- Stats dashboard with metric tracking
- Chat assistant sidebar

## For Developers

```bash
npm install
npx prisma migrate deploy
npm run dev
```

The app runs at `http://localhost:3000`.

### Tech Stack
- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- SQLite + Prisma ORM
- NextAuth v5 (Google OAuth)
- OpenAI / Gemini for AI scheduling
