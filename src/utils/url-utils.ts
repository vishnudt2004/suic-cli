export function buildUrl(base: string, ...paths: string[]): string {
  let url = new URL(base);

  for (const p of paths) {
    url = new URL(p.replace(/^\/+/, ""), url); // strip leading slashes, then append
  }

  return url.toString();
}

export function extractFilePathFromUrl(url: string): string {
  const { pathname } = new URL(url);

  const parts = pathname.split("/main/");
  if (parts.length < 2) {
    throw new Error(`Could not extract file path from url: ${url}`);
  }

  return parts[1];
}
