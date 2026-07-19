const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!rawApiUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_API_URL environment variable. Copy .env.example to .env.local and set it.",
  );
}

// Shared contract with backend/src/config/schema.ts's JWT_SECRET -- must be
// the exact same value so proxy.ts's `jose`-based verification (Node
// runtime, no jsonwebtoken) accepts tokens the backend actually issued.
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error(
    "Missing JWT_SECRET environment variable. Copy .env.example to .env.local and set it to the same value as backend/.env.",
  );
}

export const env = {
  apiUrl: rawApiUrl.replace(/\/+$/, ""),
  jwtSecret,
};
