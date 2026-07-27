const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);
const INSTAGRAM_MEDIA_PATHS = ["/reel/", "/p/", "/tv/"];
const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;

export function extractInstagramMediaUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN) ?? [];
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const normalized = normalizeInstagramMediaUrl(match);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    urls.push(normalized);
  }

  return urls;
}

export function normalizeInstagramMediaUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim().replace(/[.,;!?]+$/g, ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    const host = url.hostname.toLowerCase();
    if (!INSTAGRAM_HOSTS.has(host)) {
      return null;
    }

    if (!INSTAGRAM_MEDIA_PATHS.some((path) => url.pathname.startsWith(path))) {
      return null;
    }

    url.protocol = "https:";
    url.hostname = "www.instagram.com";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
