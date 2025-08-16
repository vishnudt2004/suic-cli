import fs from "fs";
import path from "path";
import fetch from "node-fetch";

export interface ComponentEntry {
  component_name: string;
  file_name: string;
}

export async function fetchRegistry(
  REGISTRY_URL: string
): Promise<ComponentEntry[]> {
  const res = await fetch(REGISTRY_URL);
  if (!res.ok) throw new Error("Failed to fetch component registry");
  const components = (await res.json()) as ComponentEntry[];
  if (
    !Array.isArray(components) ||
    !components.every((c) => c.component_name && c.file_name)
  ) {
    throw new Error(
      "Component registry format is invalid. Please try again later."
    );
  }

  return components;
}

export async function addComponents(
  components: ComponentEntry[],
  config: any,
  options: { cwd: string },
  GITHUB_RAW_BASE: string
): Promise<{ added: string[]; failed: string[] }> {
  const destDir = config.componentsDir || path.join(options.cwd, "components");
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const added: string[] = [];
  const failed: string[] = [];

  for (const entry of components) {
    try {
      const url = `${GITHUB_RAW_BASE}/${entry.file_name}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");

      const code = await res.text();
      fs.writeFileSync(path.join(destDir, entry.file_name), code);
      added.push(entry.component_name);
    } catch (err: any) {
      failed.push(entry.component_name);
    }
  }

  return { added, failed };
}
