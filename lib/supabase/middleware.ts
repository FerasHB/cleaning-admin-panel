import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This prevents the edge function from rendering on every request
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isProtectedPage = request.nextUrl.pathname.startsWith('/dashboard') ||
                          request.nextUrl.pathname.startsWith('/jobs') ||
                          request.nextUrl.pathname.startsWith('/employees')

  if (!user && isProtectedPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // Check if user is an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && isProtectedPage) {
      // Non-admins shouldn't access dashboard at all, we could have an unauth page or send back to somewhere else.
      // We will redirect them to a generic access denied or sign them out. 
      // For now, redirect to /login to avoid loops
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=access_denied', request.url))
    }

    if (isAuthPage) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}
