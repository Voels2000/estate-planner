
import { getUserAccess } from "@/lib/get-user-access"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const access = await getUserAccess()
  return NextResponse.json(access)
}
