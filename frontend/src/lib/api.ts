import { env } from "./env";

export function apiUrl(path: string): string {
  return `${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
