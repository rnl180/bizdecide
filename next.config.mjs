/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["firebase-admin"],
  // Skill folders are read at runtime to build the .zip downloads; ship them with the server.
  outputFileTracingIncludes: {
    "/api/skills/**": ["./workbuddy/skills/**/*"],
    "/skills": ["./workbuddy/skills/**/*"],
    // The Claude CFO team runs the skill scripts and reads the market packs from these routes.
    "/api/requests": ["./workbuddy/run_all.py", "./workbuddy/skills/**/*", "./workbuddy/knowledge/**/*"],
    "/api/requests/**": ["./workbuddy/run_all.py", "./workbuddy/skills/**/*", "./workbuddy/knowledge/**/*"],
  },
};
export default nextConfig;
