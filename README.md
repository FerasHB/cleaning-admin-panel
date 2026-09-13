# Cleaning Employee Management - Admin Panel

This is a production-ready Next.js App Router admin panel for the Cleaning Employee Management System.

## Features

- **Authentication**: Fully protected routes using Supabase Auth
- **Dashboard**: High-level overview of jobs and employees
- **Job Management**: Complete CRUD operations for jobs
- **Employee Assignment**: Assign jobs to existing employees
- **Realtime Updates**: Jobs list automatically refreshes using Supabase Realtime subscriptions
- **UI Design**: Modern, simple, and clean Dark Mode interface built using Tailwind CSS v4 and Lucide React.

## Getting Started

### 1. Prerequisites

Make sure you have Node or another package manager, and access to the TaskOps Staging Supabase project's URL and anon key (see "Backend architecture" below — do not create a separate Supabase project for Web).

### 2. Backend architecture

The Web Admin Panel and the TaskOps Manager mobile app (React Native / Expo)
are two clients of the **same** Supabase backend: same database, same
tables, same Auth, same RLS policies, same RPCs, same Edge Functions, same
Realtime data. The Web Admin Panel does not have its own backend and must
not use its own Supabase project.

**Backend migrations, RPC changes, and Edge Function deployments must come
from the backend/Mobile source-of-truth repository — never from this Web
repository.** This repo does not link a Supabase CLI project and should not
run `supabase db push`, `supabase functions deploy`, or similar commands.

### 3. Local Web development uses Staging

Local development against the real backend must point at **TaskOps
Staging**, never Production. When the app is running against something
other than Production, the sidebar shows a small `STAGING`/`UNKNOWN`
badge next to the workspace name (see `lib/backendEnvironment.ts`) — if you
don't see it, you may be pointed at Production.

### 4. Environment variables

Create a `.env.local` file in the root of the project (see `.env.example`
for the exact variable names). Never commit this file, and never put a
secret/service-role key in it — see `.env.example` for details.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Both must point at the same TaskOps Staging project used by the mobile
app for local development. `lib/supabase/keyGuard.ts` fails fast (throws,
no client is created) if `NEXT_PUBLIC_SUPABASE_ANON_KEY` looks like a
secret/service-role key instead of a public anon/publishable key.

### 5. Database requirements (legacy reference)

The section below documents a simplified reference schema and does not
reflect the full current backend schema (the shared backend has since grown
tables such as `job_assignments`, `employee_absences`, and others managed
by the backend/Mobile repository). Treat the shared backend's real schema —
not this list — as the source of truth.

**Profiles (`profiles`)**
- `id` (uuid, primary key, references auth.users)
- `full_name` (text)
- `role` (text: 'admin' | 'employee')
- `email` (text)

**Jobs (`jobs`)**
- `id` (uuid, primary key)
- `customer_name` (text)
- `location` (text)
- `service` (text)
- `scheduled_start` (timestamp with timezone)
- `status` (text: 'open' | 'in_progress' | 'completed')
- `assigned_to` (uuid, foreign key to profiles)
- `notes` (text)

Make sure you also enable **Realtime** on the `jobs` table to utilize live refresh functionality. You also need an email/password account created with the `role` equal to `admin` in the `profiles` table to log in.

### 6. Installation

Since this has predefined dependencies, install them using:

```bash
npm install
```

### 7. Running the Application

To run the development server locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. You will be automatically redirected to the login page.
