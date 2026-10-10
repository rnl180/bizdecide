/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["firebase-admin"],
  // Skill folders are read at runtime to build the .zip downloads; ship them with the server.
  outputFileTracingIncludes: {
    "/api/skills/**": ["./workbuddy/skills/**/*"],
    "/skills": ["./workbuddy/skills/**/*"],
  },
};
export default nextConfig;
