
const BASE = "https://api.api-tennis.com/tennis/";

export async function apiTennis<T>(method: string, params: Record<string, string> = {}, revalidate = 300): Promise<T> {
  const key = process.env.API_TENNIS_KEY;
  if (!key) throw new Error("API_TENNIS_KEY is not configured");

  const url = new URL(BASE);
  url.searchParams.set("method", method);
  url.searchParams.set("APIkey", key);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url, { next: { revalidate } });
  if (!response.ok) throw new Error(`API-Tennis request failed: ${response.status}`);
  const json = (await response.json()) as { success?: number; result?: T; error?: string };
  if (!json.success || json.result === undefined) throw new Error(json.error || `API-Tennis ${method} returned no result`);
  return json.result;
}
