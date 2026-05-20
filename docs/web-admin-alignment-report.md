# Web Admin Alignment Report

**Date:** 2026-05-21  
**Based on:** Mobile App Reference Report + Admin Panel codebase analysis

---

## Executive Summary

The Admin Panel has a solid structural foundation: routing, Supabase integration, role-based middleware, and all four core pages exist. However, several areas have meaningful gaps relative to the mobile app reference and the product quality bar it describes. This report lists what is already aligned, what is missing or broken, and a prioritized list of what to build next.

---

## 1. Authentication

### What exists
- Login page with email/password form (`app/login/page.tsx`)
- Role check after login — only `admin` role users can proceed
- Middleware in `proxy.ts` / `lib/supabase/middleware.ts` redirects unauthenticated users to `/login` and non-admins to `/login?error=access_denied`
- Error display for both URL-param errors and form errors

### What is missing

| Gap | Severity |
|-----|----------|
| No registration page — admins can only log in if they already have an account | High |
| No company onboarding flow — a new admin with no `company_id` lands on the dashboard with broken data | High |
| No password reset / "forgot password" link | Medium |
| Error messages are reasonable but generic (`"An error occurred during login."`) | Low |
| No loading skeleton or transition — the page shift after login is abrupt | Low |

### Notes
The middleware correctly signs out non-admin users before redirecting. The role check is duplicated on both the client (`login/page.tsx`) and server (middleware), which is good. But there is no guard for the case where an admin has `role === "admin"` but `company_id === null` — this user will reach the dashboard and all queries will silently return nothing because of RLS company scoping.

---

## 2. Company Onboarding

### What exists
- `company_id` field is present on the `profiles` table
- The `companies` table exists with `id`, `name`, `slug`
- A Supabase function `current_user_company_id()` exists
- Job creation correctly reads `company_id` from the admin's profile and attaches it to new jobs

### What is missing

| Gap | Severity |
|-----|----------|
| No company setup page or flow — a new admin with `company_id = null` gets a broken dashboard | High |
| No redirect or guard after login that checks for `company_id` before going to `/dashboard` | High |
| No confirmation screen after company creation | Medium |
| No company name shown anywhere in the UI (sidebar, header, or dashboard) | Medium |

### Notes
The reference report specifies a clear 5-step onboarding: Register → Create Company → Confirm → Dashboard → First Job/Employee. Currently steps 1, 2, and 3 are all missing. The admin with a company sees a functional app; the admin without one sees an empty and confusing dashboard.

---

## 3. Role-Based Access

### What exists
- `role` field on profiles (`admin` | `employee`)
- Middleware blocks non-admin users from all protected routes
- Login page verifies role before navigating to dashboard
- Edit/create job pages re-verify role before writing to Supabase
- Supabase RLS functions (`current_user_role`, `current_user_company_id`) exist in the schema

### What is missing

| Gap | Severity |
|-----|----------|
| No visual role indicator — the UI does not show which company or user is logged in | Low |
| Employees page description reads "Read-only" — no admin action is available | Medium (see Employee section) |
| Company scoping on employee fetches is missing (see below) | High |

---

## 4. Job Management

### What exists
- Jobs list page with table layout, status filter, and client-side search (`app/(admin)/jobs/page.tsx`)
- Create job page with all required fields: customer, service, location, date, status, employee assignment, notes (`jobs/new/page.tsx`)
- Edit job page with the same fields plus delete button (`jobs/[id]/page.tsx`)
- Realtime subscription on the jobs list (re-fetches on any change)
- Status badge using `variant` to visually differentiate statuses
- `scheduled_end` exists in the schema but is not used in any form

### What is missing

| Gap | Severity |
|-----|----------|
| Jobs page fetches **all jobs** with no `company_id` filter — relies entirely on RLS | Medium |
| The search filters on `job.service` but the column is `service_name` — the search by service never matches | High (bug) |
| Dashboard "Recent Jobs" shows `job.service_name` in description but the jobs list shows `job.service` — inconsistent field reference | High (bug) |
| No "today's jobs" view or date filter beyond the status filter | Medium |
| No employee filter on the jobs list | Medium |
| No scheduled end date / duration on job creation or edit | Low |
| Status colors are minimal (outline / secondary / default) — not semantically distinct (e.g., green for completed, amber for in_progress, gray for open) | Low |
| `alert()` is used for all errors — not appropriate for a SaaS product | Medium |
| Delete confirmation uses `confirm()` — should be a proper modal | Low |

---

## 5. Employee Management

### What exists
- Employees page lists all profiles with `role = "employee"` (`app/(admin)/employees/page.tsx`)
- Per-employee stats: total jobs, open count, in-progress count
- Table layout with name, email, role badge

### What is missing

| Gap | Severity |
|-----|----------|
| **No email column in the table** — the `employees` table renders name, then role badge, then job counts, but the email `TableCell` is missing from the rendered JSX (the column header "Email" exists but the cell is skipped) | High (bug) |
| No "Add Employee" button or create employee flow | High |
| Employees are fetched without a `company_id` filter — relies on RLS but risks cross-tenant data if RLS is misconfigured | Medium |
| Employee `is_active` field exists in schema but is not shown or used | Medium |
| No employee detail page | Low |
| Page description still reads "(Read-only)" — should be updated when creation is added | Low |
| The reference report specifies a simple invite flow (name + email → system creates/invites) — this is entirely missing | High |

---

## 6. Dashboard

### What exists
- Stat cards: Open Jobs, In Progress, Completed, Total Employees
- Recent Jobs list (5 most recently scheduled)
- Quick Actions: Create Job, View Employees, View Open Jobs

### What is missing

| Gap | Severity |
|-----|----------|
| No "today's jobs" stat or section | Medium |
| No company name or workspace context visible anywhere on the dashboard | Medium |
| Recent jobs card shows `job.service_name` — but jobs list page references `job.service` — one will be wrong | High (bug, same as above) |
| Stat counts are not scoped by `company_id` in the query — relies entirely on RLS | Medium |
| No empty state for new admins (when there are 0 jobs and 0 employees) — the dashboard just shows all zeros with no guidance | Medium |

---

## 7. Sidebar & Navigation

### What exists
- Fixed sidebar with Dashboard, Jobs, Employees navigation items
- Active state highlight based on `pathname`
- Logout button at the bottom

### What is missing

| Gap | Severity |
|-----|----------|
| No company name or logo in the sidebar header — just the hardcoded text "Cleaning Admin Panels" | Medium |
| No Settings or Company page link | Medium |
| Sidebar is hidden on mobile (`hidden md:flex`) with no mobile menu fallback — the app is unusable on small screens | Medium |
| No user avatar or logged-in user indicator | Low |

---

## 8. Supabase Integration

### What exists
- Server and client Supabase clients set up correctly
- Middleware uses SSR-compatible cookie handling
- Database types are well-defined and used across most of the codebase
- RPC functions `current_user_company_id` and `current_user_role` exist

### What is missing / concerns

| Gap | Severity |
|-----|----------|
| `lib/supabase.ts` exists alongside `lib/supabase/client.ts` — appears to be a leftover file that may cause confusion | Low |
| Jobs page uses `"use client"` and fetches from the client — for a list page, a server component would be more appropriate and more secure | Low |
| No use of `current_user_company_id()` RPC in any frontend query — all company scoping is implicit via RLS | Medium |
| No error boundary or error page — all errors go to `console.error` + `alert()` | Medium |

---

## 9. Code Quality Issues

| Issue | File | Severity |
|-------|------|----------|
| `type Job = any` — loses all type safety | `jobs/page.tsx:9` | Medium |
| `employees` state typed as `any[]` in new job page | `jobs/new/page.tsx:15` | Low |
| `supabase` instance recreated in `useEffect` dependency array, causing potential stale closure issues | `jobs/page.tsx` | Low |
| `alert()` and `confirm()` used for all error/confirm states | multiple files | Medium |
| No `Suspense` or loading skeleton — loading is handled with inline conditional rendering | dashboard, employees | Low |

---

## 10. Alignment Summary Against Reference Report Priorities

| Priority from Reference | Status in Admin Panel |
|-------------------------|----------------------|
| P1: Authentication — clear login, registration, error messages | Login exists. Registration, company setup, and password reset are missing. |
| P2: Company onboarding — workspace setup and redirect | Entirely missing. |
| P3: Employee management — list + create/invite flow | List exists with a bug. Create/invite is missing. |
| P4: Job management — list, create, edit, status filters | Mostly exists. Two field-name bugs. Employee filter missing. |
| P5: Dashboard polish — stats, today's jobs, quick actions | Stat cards exist. Today's jobs missing. Quick actions exist. |
| P6: UI consistency — colors, spacing, typography, status badges | Basic consistency achieved. Status badge colors not semantically distinct. |
| P7: SaaS readiness — company data separation, role protection | Role protection is good. Company context missing from UI. |

---

## 11. Recommended Implementation Order

1. **Fix the two field-name bugs first** — `job.service` vs `job.service_name` in jobs list and dashboard. These cause silent breakage.

2. **Fix the missing email cell in the employees table** — the column exists but the cell is not rendered.

3. **Add registration page** — business-owner focused, leads into company setup.

4. **Add company onboarding flow** — after registration and after login when `company_id` is null. Block dashboard access until company is set up.

5. **Add employee create/invite flow** — simple form: name + email. Use the Supabase server function pattern already used in the mobile app.

6. **Add company name to sidebar and dashboard** — fetch from `companies` table using the admin's `company_id`.

7. **Replace `alert()` / `confirm()` with proper UI** — inline error messages and a confirmation modal for destructive actions.

8. **Add today's jobs to dashboard** — filter by `scheduled_start` date range.

9. **Add employee filter to jobs list** — dropdown alongside the status filter.

10. **Add Settings/Company page** — company name, admin profile, logout.

11. **Add mobile menu** — the app is currently broken on small screens.

12. **Improve status badge colors** — make Open/In Progress/Completed visually distinct with color (not just variant names).
