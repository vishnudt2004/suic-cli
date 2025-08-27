import path from "path";
import fs from "fs";
import chalk from "chalk";
import { constants } from "../constants";
import { fetchFileData } from "./fetch";
import { buildUrl } from "./url-utils";
import { logger } from "./logger";
import { CLIError } from "./error-handler";
import type {
  ComponentsRegistryEntry,
  InstalledRegistryEntry,
} from "../lib/types";
const semver = require("semver");

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

type LogDeps = {
  description: string;
  registryDeps: Pick<
    ComponentsRegistryEntry,
    "dependencies" | "devDependencies" | "peerDependencies"
  >;
  cwd: string;
  action: "install" | "uninstall";
};

function logDependencies({
  description,
  registryDeps,
  cwd,
  action,
}: LogDeps): void {
  const { dependencies, devDependencies, peerDependencies } = registryDeps;

  const pkgPath = path.join(cwd, "package.json");
  const pkgNotFound = !fs.existsSync(pkgPath);

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

    type Status =
      | "ok"
      | "minorMismatch"
      | "majorMismatch"
      | "missing"
      | "default";
    type Indicator = Record<Status, string>;
    const indicator: Indicator = {
      default: chalk.gray("●"),
      ok: chalk.green("●"),
      minorMismatch: chalk.yellow("◑"),
      majorMismatch: chalk.red("◑"),
      missing: chalk.red("●"),
    };

    for (const [dep, version] of Object.entries(deps)) {
      const installedVersion = installedDeps[dep];
      const reqd = `${chalk.cyanBright(dep)}@${version}`;
      const installed =
        action === "install" && installedVersion
          ? ` (${chalk.dim(`installed: ${installedVersion}`)})`
          : "";
      const cleanInstalled = installedVersion?.replace(/^[\^~]/, "");
      const cleanReqd = version?.replace(/^[\^~]/, "");

      let status: Status;
      if (action === "install") {
        if (pkgNotFound || (label === "Peer Dependencies" && !installedVersion))
          status = "default";
        else if (!installedVersion) status = "missing";
        else {
          const installedMajor = semver.major(cleanInstalled);
          const requiredMajor = semver.major(cleanReqd);

          if (semver.eq(cleanInstalled, cleanReqd)) status = "ok";
          else if (installedMajor !== requiredMajor) status = "majorMismatch";
          else status = "minorMismatch";
        }
      } else status = "default";

      logger.log(`${reqd}${installed}`, { level: 1 }, indicator[status]);
    }

    logger.break();
  };

  const hasAnyDeps = [dependencies, devDependencies, peerDependencies].some(
    (d) => Object.keys(d || {}).length > 0
  );

  if (hasAnyDeps) {
    if (action === "install" && pkgNotFound) {
      logger.warn(
        "package.json not found. Cannot detect installed dependencies."
      );
    }

    logger.break();
    logger.warn(description);
    logger.break();
  }

  printDeps(dependencies, "Dependencies");
  printDeps(devDependencies, "Dev Dependencies");
  printDeps(peerDependencies, "Peer Dependencies");
}

function sanitizeInstallPath(input: string): string {
  // Allow only safe characters: a-z, 0-9, dash, underscore, slash
  // + optional dot prefix for relative paths
  const isValid = /^\.?\/?[a-zA-Z0-9/_-]+$/.test(input);
  if (!isValid) {
    throw new CLIError(
      `Invalid path: "${input}". Allowed: a–z, 0–9, "-", "_". Use "/" for directories.`
    );
  }

  // Remove leading "./" or "/" to keep it relative under src/
  let clean = input.replace(/^(\.\/|\/)+/, "");

  // Normalize slashes (avoid .//, etc.)
  clean = path.posix.normalize(clean);

  return `./${clean}`;
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

function dedupeCaseInsensitive(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const lower = item.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

export {
  loadInstalledRegistry,
  updateInstalledRegistry,
  installFiles,
  removeFiles,
  removeEmptyDirs,
  addPathAlias,
  logDependencies,
  sanitizeInstallPath,
  normalizeName,
  dedupeCaseInsensitive,
};
