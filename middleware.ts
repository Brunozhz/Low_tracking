export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/optimizations/:path*", "/api/links/:path*", "/api/meta/:path*"],
};
