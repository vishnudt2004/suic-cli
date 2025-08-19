export function buildUrl(base: string, ...paths: string[]): string {
  let url = new URL(base);

  for (const p of paths) {
    url = new URL(p.replace(/^\/+/, ""), url); // strip leading slashes, then append
  }

  return url.toString();
}
