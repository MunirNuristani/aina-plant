const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!rawApiUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_API_URL environment variable. Copy .env.example to .env.local and set it.",
  );
}

export const env = {
  apiUrl: rawApiUrl.replace(/\/+$/, ""),
};
