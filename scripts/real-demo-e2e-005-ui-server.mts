process.env.VIBE_DIRECTOR_RUNTIME_API_PORT ||= process.env.REAL_DEMO_E2E_005_UI_SERVER_PORT || "";
process.env.VIBE_DIRECTOR_RUNTIME_API_HOST ||= process.env.REAL_DEMO_E2E_005_UI_SERVER_HOST || "";
process.env.VIBE_CORE_RUNTIME_API_PORT ||= process.env.VIBE_DIRECTOR_RUNTIME_API_PORT;
process.env.VIBE_CORE_RUNTIME_API_HOST ||= process.env.VIBE_DIRECTOR_RUNTIME_API_HOST;

await import("./local-runtime-api-server.mjs");
