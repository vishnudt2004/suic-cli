import path from "path";
import fs from "fs";

export function getConfig(cwd: string) {
  const configPath = path.join(cwd, "suic.config.json");
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  }
  return null;
}

export function createConfig({ cwd }: { cwd: string }) {
  const componentsDir = path.join(cwd, "components/suic").replace(/\\/g, "/");
  const config = { cwd: cwd.replace(/\\/g, "/"), componentsDir };
  const configPath = path.join(cwd, "suic.config.json").replace(/\\/g, "/");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return config;
}
