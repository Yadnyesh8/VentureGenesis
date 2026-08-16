import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public: the auth pages, the OAuth callback, the /api proxy, and the policy
// documents. The policies have to be readable by someone who has not signed up
// — terms you can only reach from behind the auth wall are not terms.
// /onboarding requires authentication — unauthenticated users are redirected to sign-in.
const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/api(.*)",
  "/terms",
  "/privacy",
  "/disclaimer",
  "/accessibility",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files unless referenced in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
