import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // ── 1. Verify calling user via their JWT ─────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401)
    }
    const jwt = authHeader.replace("Bearer ", "")

    // Anon client — used only to verify the JWT (does not set a session for DB queries)
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    )

    const { data: { user: callingUser }, error: userError } =
      await anonClient.auth.getUser(jwt)

    if (userError || !callingUser) {
      return json({ error: "Invalid or expired session" }, 401)
    }

    // Service-role client — bypasses RLS so we can read the admin's profile
    // regardless of the SELECT policy on the profiles table.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // ── 2. Verify the caller is an active admin with a company ───────────
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, company_id, is_active")
      .eq("id", callingUser.id)
      .single()

    if (profileError || !profile) {
      return json({ error: "Admin profile not found" }, 403)
    }
    if (profile.role !== "admin") {
      return json({ error: "Only admins can create employees" }, 403)
    }
    if (!profile.is_active) {
      return json({ error: "Admin account is not active" }, 403)
    }
    if (!profile.company_id) {
      return json({ error: "Admin has no company assigned" }, 403)
    }

    // ── 3. Parse and validate the request body ───────────────────────────
    const body = await req.json()
    const fullName: string = (body.full_name ?? "").trim()
    const email: string = (body.email ?? "").trim().toLowerCase()
    const password: string = body.password ?? ""

    if (!fullName) return json({ error: "full_name is required" }, 400)
    if (!email)    return json({ error: "email is required" }, 400)
    if (password.length < 8) return json({ error: "password must be at least 8 characters" }, 400)

    // ── 4. Create the auth user using the service-role client ────────────
    const { data: newAuth, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // skip email confirmation for employees added by admin
      })

    if (createError) {
      return json({ error: createError.message }, 400)
    }

    const newUserId = newAuth.user.id

    // ── 5. Create/update the employee profile ────────────────────────────
    const { error: profileInsertError } = await adminClient
      .from("profiles")
      .upsert({
        id: newUserId,
        full_name: fullName,
        role: "employee",
        company_id: profile.company_id,
        is_active: true,
      }, { onConflict: "id" })

    if (profileInsertError) {
      // Auth user was created but profile failed. Clean up the auth user
      // so we don't leave an orphaned account.
      await adminClient.auth.admin.deleteUser(newUserId)
      return json({ error: "Profile creation failed: " + profileInsertError.message }, 500)
    }

    // ── 6. Return the new employee ────────────────────────────────────────
    return json({ id: newUserId, full_name: fullName, email }, 200)

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return json({ error: message }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
