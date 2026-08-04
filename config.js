// API origin the app talks to. EXPO_PUBLIC_* vars are inlined into the JS
// bundle at build time (Expo SDK 49+), so this works correctly across
// `expo start`, `eas build --profile preview`, and `eas build --profile
// production` — each can set its own value via eas.json's `env` block, or a
// local .env for `expo start`.
//
// Defaults to the deployed Render backend so a build never silently points
// at a LAN IP that's unreachable off the developer's network (the earlier
// bug: builds would hang on requests until they timed out, then fail).
// Override locally (.env) only when you deliberately want to hit a backend
// running on your own machine.
const API_ORIGIN =
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://property-survey-backend.onrender.com";

const API_BASE_URL = `${API_ORIGIN}/api`;

const ENV = process.env.EXPO_PUBLIC_ENV || "PRODUCTION";

export { API_ORIGIN, API_BASE_URL, ENV };
