import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Server Action calls (POSTs carrying this header) re-check auth
  // themselves — every action in this app either calls requireAdmin() or
  // checks auth.getUser() directly, and RLS enforces the real access
  // control regardless. Re-validating the session here too on every single
  // form submission/button click across the app (on top of the identical
  // check each action already does) was a big chunk of unnecessary Supabase
  // Auth traffic for no added protection.
  if (request.headers.get("next-action")) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
