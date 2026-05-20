# Mobile App Reference Report for Admin Panel Alignment

## Context

This report describes the current state of the mobile app.

The mobile app is a React Native + Expo + TypeScript cleaning employee management app connected to Supabase.

The app includes:
- authentication
- registration
- login
- session handling
- role system: admin / employee
- company onboarding
- jobs management
- employee assignment
- job status tracking
- realtime updates
- offline sync basics
- push notification basics

The goal of this report is to use the mobile app as a product and design reference for improving the Admin Panel web application.

The web app should not copy mobile layouts directly.  
Instead, it should adapt the same product logic, visual language, terminology, status system, and business workflows into a proper web admin experience.

---

# 1. Authentication & Registration

## Current mobile behavior

The mobile app has:
- login flow
- registration flow
- Supabase session handling
- persistent mobile session via AsyncStorage
- AuthContext for user/session/profile state
- profile loading after authentication
- role detection through the user profile
- logout handling

## Strengths

- Auth is centralized in AuthContext
- Supabase auth session is used properly
- Session persistence is configured for mobile
- Login and registration screens are understandable
- Logout clears local auth state

## Weak points

- Registration can become fragile if Supabase requires email confirmation
- Profile loading errors can create broken or unclear app states
- If a session exists but profile loading fails, the app can become stuck
- Error messages are still too generic
- Password reset / recovery is missing
- Broken states after failed registration or failed company setup are not handled strongly enough

## Admin Panel alignment

The web admin panel should have a clearer and more robust auth flow:
- clear login
- clear registration for business owners
- clear profile loading state
- clear company setup state
- no indefinite loading screens
- clear error messages
- password reset flow
- strong redirect logic after login

---

# 2. Company Onboarding

## Current mobile behavior

The mobile app checks whether the authenticated user has a company_id.

If no company_id exists, the user is redirected to company setup.

Company creation is handled through a Supabase RPC.

## Strengths

- Company setup is separated from normal app usage
- company_id is treated as a key part of the user profile
- Supabase RPC is a reasonable approach for creating company data safely

## Weak points

- Company onboarding is not polished enough yet
- The setup screen does not fully match the main app design
- The flow can feel like a fallback instead of a professional onboarding experience
- Broken states are possible if company creation fails
- The app needs clearer success and failure states

## Admin Panel alignment

The web admin panel should treat company onboarding as a professional business-owner setup flow.

Recommended flow:
1. Register account
2. Create company / workspace
3. Confirm company setup
4. Continue to dashboard
5. Add first employee or first job

The web app should make it very clear that the user is creating a company workspace.

---

# 3. Role-Based Behavior

## Current mobile behavior

The app uses roles:
- admin
- employee

The profile role controls which actions and screens are available.

Admins can manage jobs and employees.  
Employees mainly view and update assigned jobs.

## Strengths

- Role concept is already implemented
- Admin-only behavior exists in several places
- Profile role is available through AuthContext
- Supabase RLS is expected to protect actual data access

## Weak points

- Client-side role checks are not consistent everywhere
- Some actions rely heavily on Supabase RLS without enough UI-level clarity
- Access-denied states should be clearer
- Employee/admin separation should become more explicit in UX

## Admin Panel alignment

The web admin panel should focus on the admin/business-owner experience.

The web admin should clearly support:
- admin dashboard
- jobs management
- employees management
- company/workspace context
- role-protected admin actions

The web app must rely on Supabase RLS for real security, not only frontend checks.

---

# 4. Job Management

## Current mobile behavior

The mobile app supports:
- creating jobs
- assigning employees
- editing jobs
- deleting jobs
- starting jobs
- completing jobs
- tracking job status

Main job statuses:
- open
- in_progress
- completed

## Strengths

- The job lifecycle is simple and understandable
- Status transitions are clear
- Job cards are visually useful
- Employee assignment already exists
- Offline start/complete actions are supported as a foundation

## Weak points

- Some job actions need stronger company/user scoping
- Status transitions should ideally also be validated on the server side
- Realtime currently refreshes broadly
- Offline sync is useful but partial
- Error states should be more specific

## Admin Panel alignment

The web admin panel should make job management stronger and more business-friendly.

Recommended web pages:
- Jobs overview
- Create job
- Edit job
- Job status overview
- Assigned employee display
- Filter by status
- Filter by date
- Filter by employee
- Search by customer/location/service

The web app should use the same job terminology as the mobile app:
- Open
- In Progress
- Completed

Or, if German UI is used:
- Offen
- In Arbeit
- Abgeschlossen

Status colors should match the mobile app.

---

# 5. Employee Management

## Current mobile behavior

The mobile app supports:
- loading active employees
- selecting employees for job assignment
- employee creation through a Supabase function

## Strengths

- Employees are already connected to job assignment
- Employee loading is scoped through Supabase logic
- Secure employee creation through a server function is a good direction

## Weak points

- Employee onboarding is not polished yet
- Manual password handling is not ideal for non-technical employees
- There is no strong invite flow yet
- There is no clear employee activation or onboarding message
- Employee management still feels functional, not SaaS-polished

## Admin Panel alignment

The web admin panel should make employee management one of the main features.

Recommended web flow:
1. Admin opens Employees page
2. Admin clicks “Add employee”
3. Admin enters name and email
4. System creates or invites employee
5. Admin gets a clear success message
6. Employee appears in the list
7. Employee can be assigned to jobs

Important:
The flow must be simple for cleaning business owners.

Avoid complicated technical language.

---

# 6. Supabase Integration

## Current mobile behavior

The mobile app uses Supabase for:
- authentication
- profiles
- companies
- jobs
- employees
- realtime updates
- RPC/company setup
- server function/employee creation

## Strengths

- Supabase is the shared backend source of truth
- Auth integration is already working
- Role and company concepts exist
- RLS is expected to protect tenant/company data
- Server-side employee creation is a good architecture decision

## Weak points

- The frontend should not rely too much on implicit behavior
- Company scoping should be handled clearly
- Error handling should become more user-friendly
- Realtime and offline sync should not make core flows unstable

## Admin Panel alignment

The web admin panel should use the same Supabase backend model.

Important concepts:
- profiles
- companies
- jobs
- employees
- company_id
- role
- RLS
- admin permissions

The web app must respect the same multi-tenant logic:
An admin should only see and manage data from their own company.

---

# 7. Mobile UI Design Reference

## Current mobile strengths

The mobile app has:
- clean card-based layout
- readable job cards
- useful status badges
- clear spacing
- simple forms
- good loading and empty state foundation
- mobile-first structure
- understandable status filtering

## Current mobile weaknesses

- Some screens do not fully follow the same theme
- Some buttons and forms are styled locally instead of consistently
- The company setup screen needs stronger visual alignment
- Some animations feel decorative instead of necessary
- The design feels like a strong prototype, but not fully polished SaaS yet

## Admin Panel alignment

The web admin panel should reuse the mobile app’s visual language conceptually:

Reuse:
- same status meanings
- same status colors
- same terminology
- same clean card style
- same business-focused simplicity
- same job lifecycle logic

Adapt for web:
- use tables where tables make sense
- use dashboard stats
- use sidebar or top navigation
- use wider layouts
- show more data at once
- keep actions easy to find

Do not make the web app look like a stretched mobile app.

---

# 8. SaaS Product Quality

## What already feels professional in the mobile app

- role-based system
- company-based logic
- job lifecycle
- Supabase integration
- realtime idea
- offline sync foundation
- status-based workflow
- employee assignment concept

## What still feels unfinished

- registration robustness
- company onboarding polish
- employee onboarding
- consistent role protection
- polished error handling
- stronger business-owner UX
- consistent UI components
- clearer SaaS onboarding flow

## What should stay

- simple job status model
- admin/employee role system
- company_id-based data model
- card-based job presentation
- Supabase backend approach
- mobile-first simplicity

## What should improve

- auth/profile stability
- company setup flow
- employee creation/invitation
- job scoping and validation
- UI consistency
- error handling
- onboarding clarity

---

# 9. Recommended Web Admin Direction Based on Mobile App

The admin panel should become the professional control center for the same product.

Recommended core pages:

## Dashboard
Purpose:
Give the business owner a fast overview.

Should show:
- today’s jobs
- open jobs
- jobs in progress
- completed jobs
- active employees
- quick actions

## Jobs
Purpose:
Manage all cleaning jobs.

Should support:
- list/table view
- status filters
- employee filter
- create job
- edit job
- delete job
- status visibility
- assigned employee display

## Employees
Purpose:
Manage staff.

Should support:
- employee list
- active/inactive status
- create/invite employee
- assign employee to jobs
- simple employee details

## Company / Settings
Purpose:
Manage company workspace.

Should support:
- company name
- admin profile
- basic account settings
- logout

---

# 10. Design Alignment Rules for the Web Admin Panel

The web admin panel should follow these rules:

1. Use the same product terminology as the mobile app
2. Use the same job status model
3. Use consistent status colors
4. Keep the interface clean and business-friendly
5. Avoid unnecessary visual effects
6. Avoid overcomplicated dashboards
7. Make employee creation very simple
8. Make job creation fast and clear
9. Show company/workspace context
10. Make errors and empty states understandable

The web app should feel like the same SaaS product, but adapted properly for desktop/web usage.

---

# 11. Priority Roadmap for the Admin Panel

## Priority 1: Authentication and registration
- Make login clear
- Make registration business-owner focused
- Add company setup after registration
- Avoid broken redirect states
- Add good error messages

## Priority 2: Company onboarding
- Create clear company/workspace setup
- Show confirmation after setup
- Redirect to dashboard after success

## Priority 3: Employee management
- Build clean employee list
- Build simple employee creation/invite flow
- Avoid technical language
- Show success state after employee creation

## Priority 4: Job management
- Build strong jobs overview
- Add create/edit/delete job flow
- Add status filters
- Add employee assignment
- Show job status clearly

## Priority 5: Dashboard polish
- Add business-relevant stats
- Add today’s jobs
- Add active employees
- Add quick actions

## Priority 6: UI consistency
- Use consistent colors, spacing, typography, cards, buttons, badges
- Match the mobile app’s product language
- Adapt layout properly for web

## Priority 7: SaaS readiness
- Ensure company data separation
- Respect role-based access
- Show company context
- Keep flows simple for real cleaning businesses

---

# Best Next Step for the Admin Panel

The best next step is:

Build or improve the web admin authentication + company onboarding flow first.

Reason:
If login, registration, profile loading, and company setup are not stable, the dashboard, jobs, and employee management will always feel fragile.

After that, improve employee management and job management.
