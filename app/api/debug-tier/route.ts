
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const supabaseCookies = allCookies.filter(c => c.name.includes("supabase") || c.name.includes("sb-"))
  
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  let profile = null
  let profileError = null
  if (user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, subscription_status, consumer_tier")
      .eq("id", user.id)
      .single()
    profile = data
    profileError = error
  }

  return NextResponse.json({
    cookieCount: allCookies.length,
    supabaseCookieNames: supabaseCookies.map(c => c.name),
    userId: user?.id ?? null,
    userError: userError?.message ?? null,
    profile,
    profileError: profileError?.message ?? null,
  })
}
