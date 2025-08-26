import path from "path";
import fs from "fs";
import chalk from "chalk";
import { constants } from "../constants";
import { fetchFileData } from "./fetch";
import { buildUrl } from "./url-utils";
import { logger } from "./logger";
import type {
  ComponentsRegistryEntry,
  InstalledRegistryEntry,
} from "../lib/types";

interface LogDependenciesOptions {
  description: string;
  registryDeps: Pick<
    ComponentsRegistryEntry,
    "dependencies" | "devDependencies" | "peerDependencies"
  >;
  cwd: string;
}

function loadInstalledRegistry(cwd: string) {
  const installedRegistryPath = path.join(cwd, constants.INSTALLED_REG_FILE);
  const installedRegistry: Record<string, InstalledRegistryEntry> =
    fs.existsSync(installedRegistryPath)
      ? JSON.parse(fs.readFileSync(installedRegistryPath, "utf-8"))
      : {};
  return { installedRegistryPath, installedRegistry };
}

function updateInstalledRegistry(
  entryOrName: ComponentsRegistryEntry,
  installedRegistryPath: string,
  operation: "add"
): Record<string, InstalledRegistryEntry>;
function updateInstalledRegistry(
  entryOrName: string, // raw component name
  installedRegistryPath: string,
  operation: "remove"
): Record<string, InstalledRegistryEntry>;
function updateInstalledRegistry(
  entryOrName: ComponentsRegistryEntry | string,
  installedRegistryPath: string,
  operation: "add" | "remove"
) {
  let registry: Record<string, InstalledRegistryEntry> = {};

  if (operation === "remove" && typeof entryOrName === "string") {
    if (!fs.existsSync(installedRegistryPath)) return {};

    registry = JSON.parse(fs.readFileSync(installedRegistryPath, "utf-8"));
    const normalizedRegistry = normalizeName(registry);
    const compKey = normalizeName(entryOrName);

    if (normalizedRegistry[compKey]) delete registry[entryOrName];
  } else if (operation === "add" && typeof entryOrName !== "string") {
    if (fs.existsSync(installedRegistryPath)) {
      registry = JSON.parse(fs.readFileSync(installedRegistryPath, "utf-8"));
    }

    registry[entryOrName.name] = {
      files: entryOrName.files ?? [],
      dependencies: entryOrName.dependencies ?? {},
      devDependencies: entryOrName.devDependencies ?? {},
      peerDependencies: entryOrName.peerDependencies ?? {},
    };
  }

  // Save back to file
  fs.mkdirSync(path.dirname(installedRegistryPath), { recursive: true });
  fs.writeFileSync(installedRegistryPath, JSON.stringify(registry, null, 2));

  return registry;
}

async function installFiles(
  registryFiles: string[],
  baseUrl: string,
  targetDir: string
): Promise<void> {
  for (const file of registryFiles) {
    const destPath = path.join(targetDir, file);
    const fileUrl = buildUrl(baseUrl, file);
    const content = await fetchFileData(fileUrl);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content, "utf-8");
  }
}

function removeFiles(registryFiles: string[], targetDir: string) {
  for (const file of registryFiles) {
    const destPath = path.join(targetDir, file);
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
  }
}

function removeEmptyDirs(
  targetDir: string,
  registryFiles: string[],
  protectedDirs: string[] = []
) {
  // Normalize protected dirs as absolute paths
  const absProtected = protectedDirs.map((d) =>
    path.resolve(d).replace(/[/\\]+$/, "")
  );

  for (const file of registryFiles) {
    let dir = path.dirname(path.join(targetDir, file));

    while (dir.startsWith(targetDir)) {
      try {
        // skip if protected
        if (absProtected.includes(path.resolve(dir))) break;

        const entries = fs.readdirSync(dir);
        if (entries.length > 0) break; // stop if not empty

        fs.rmdirSync(dir);
        dir = path.dirname(dir); // move one level up
      } catch {
        break;
      }
    }
  }
}

function addPathAlias(
  cwd: string,
  { alias, value }: { alias: string; value: string }
): void {
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    const tsconfigRaw = fs.readFileSync(tsconfigPath, "utf-8");
    const tsconfig = JSON.parse(tsconfigRaw);

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};

    if (!tsconfig.compilerOptions.paths[alias]) {
      tsconfig.compilerOptions.paths[alias] = [value];
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify(tsconfig, null, 2),
        "utf-8"
      );
    }
  } else logger.warn("tsconfig.json not found. Skipping path alias.");
}

function logDependencies({
  description,
  registryDeps,
  cwd,
}: LogDependenciesOptions): void {
  const { dependencies, devDependencies, peerDependencies } = registryDeps;

  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) {
    logger.warn(
      "package.json not found. Cannot detect installed dependencies."
    );
  }

  const pkg = fs.existsSync(pkgPath)
    ? JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
    : { dependencies: {}, devDependencies: {} };

  const installedDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const printDeps = (
    deps: Record<string, string> | undefined,
    label: string
  ) => {
    if (!deps || !Object.keys(deps).length) return;

    logger.info(`${label}:`);

    for (const [dep, version] of Object.entries(deps)) {
      const installedVersion = installedDeps[dep];
      const reqd = `${chalk.cyanBright(dep)}@${version}`;
      const installed = installedVersion
        ? ` (${chalk.dim(`installed: ${installedVersion}`)})`
        : "";
      logger.log(`${reqd}${installed}`, { level: 1 }, "●");
    }

    logger.break();
  };

  const hasAnyDeps = [dependencies, devDependencies, peerDependencies].some(
    (d) => Object.keys(d || {}).length > 0
  );

  if (hasAnyDeps) {
    logger.break();
    logger.warn(description);
    logger.break();
  }

  printDeps(dependencies, "Dependencies");
  printDeps(devDependencies, "Dev Dependencies");
  printDeps(peerDependencies, "Peer Dependencies");
}

function normalizeName(property: string): string;
function normalizeName<T extends { name: string }>(property: T[]): T[];
function normalizeName<T extends Record<string, any>>(
  property: T
): Record<string, any>;
function normalizeName(property: any): any {
  // raw string
  if (typeof property === "string") return property.toLowerCase();

  // "name" property
  if (Array.isArray(property))
    return property.map((i) => ({ ...i, name: i.name.toLowerCase() }));

  // key
  if (typeof property === "object" && property !== null)
    return Object.fromEntries(
      Object.entries(property).map(([k, v]) => [k.toLowerCase(), v])
    );

  return property; // fallback
}

export {
  loadInstalledRegistry,
  updateInstalledRegistry,
  installFiles,
  removeFiles,
  removeEmptyDirs,
  addPathAlias,
  logDependencies,
  normalizeName,
};
