/** Platform (sign-in and shared data) settings. The app still runs without them; only account features are off. */
export type PlatformConfig = { url: string; anonKey: string };

export function readPlatformConfig(env: Record<string, string | undefined> = import.meta.env): PlatformConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !/^https:\/\//.test(url)) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}
