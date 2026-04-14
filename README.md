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

Make sure you have Node or another package manager and a Supabase project created.

### 2. Environment Variables

Create a `.env.local` file in the root of the project to add your Supabase credentials. Do not commit this file to version control.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

### 3. Database Requirements

Ensure your Supabase PostgreSQL database has the following tables structure established:

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

### 4. Installation

Since this has predefined dependencies, install them using:

```bash
npm install
```

### 5. Running the Application

To run the development server locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. You will be automatically redirected to the login page.
