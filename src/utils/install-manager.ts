import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  ComponentsRegistryEntry,
  InitRegistry,
  InstalledRegistryEntry,
} from "../lib/types";
import { constants } from "../constants";
import { buildUrl } from "./url-utils";
import { fetchFileData } from "./fetch";
import { askConfirm } from "./prompt-handler";
import { logger } from "./logger";

// Log required dependencies for manual install/uninstall

export function logDependencies(
  description: string,
  requiredDeps: Pick<
    ComponentsRegistryEntry,
    "dependencies" | "devDependencies" | "peerDependencies"
  >,
  cwd: string
) {
  const { dependencies, devDependencies, peerDependencies } = requiredDeps;

  const packageJsonPath = path.join(cwd, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    logger.warn(
      "package.json not found. Cannot detect installed dependencies."
    );
  }

  const pkg = fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
    : { dependencies: {}, devDependencies: {} };
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const printDeps = (
    deps: Record<string, string> | undefined,
    type: string
  ) => {
    if (!deps || Object.keys(deps).length === 0) return;

    logger.info(`${type}:`);
    for (const [dep, version] of Object.entries(deps)) {
      const installedVersion = allDeps[dep];
      if (installedVersion) {
        console.log(
          `${" ".repeat(2)} - ${chalk.cyanBright(dep)}@${version} (${chalk.dim(
            "installed:"
          )} ${installedVersion})`
        );
      } else {
        console.log(`${" ".repeat(2)} - ${chalk.cyanBright(dep)}@${version}`);
      }
    }
    logger.break(); // spacing
  };

  if (
    Object.keys(dependencies || {}).length ||
    Object.keys(devDependencies || {}).length ||
    Object.keys(peerDependencies || {}).length
  ) {
    logger.break();
    logger.warn(description);
    logger.break();
  }

  printDeps(dependencies, "Dependencies");
  printDeps(devDependencies, "Dev Dependencies");
  printDeps(peerDependencies, "Peer Dependencies");
}

export function getUnusedDeps(
  batchDeps: Pick<
    InstalledRegistryEntry,
    "dependencies" | "devDependencies" | "peerDependencies"
  >,
  installedRegistry: Record<string, InstalledRegistryEntry>,
  toRemove: string[]
) {
  const unusedDeps: Pick<
    InstalledRegistryEntry,
    "dependencies" | "devDependencies" | "peerDependencies"
  > = {
    dependencies: {},
    devDependencies: {},
    peerDependencies: {},
  };

  // Build a map of all deps from remaining components
  type DepType = Record<string, string>;
  const remainingDeps: DepType = {};
  const remainingDevDeps: DepType = {};
  const remainingPeerDeps: DepType = {};

  for (const [name, entry] of Object.entries(installedRegistry)) {
    if (toRemove.map((n) => n.toLowerCase()).includes(name.toLowerCase()))
      continue;
    Object.assign(remainingDeps, entry.dependencies ?? {});
    Object.assign(remainingDevDeps, entry.devDependencies ?? {});
    Object.assign(remainingPeerDeps, entry.peerDependencies ?? {});
  }

  // Helper to filter unused deps
  function filterUnused(batch: DepType, remaining: DepType) {
    const result: DepType = {};
    for (const dep of Object.keys(batch)) {
      if (!remaining[dep]) result[dep] = batch[dep];
    }
    return result;
  }

  unusedDeps.dependencies = filterUnused(
    batchDeps.dependencies ?? {},
    remainingDeps
  );
  unusedDeps.devDependencies = filterUnused(
    batchDeps.devDependencies ?? {},
    remainingDevDeps
  );
  unusedDeps.peerDependencies = filterUnused(
    batchDeps.peerDependencies ?? {},
    remainingPeerDeps
  );

  return unusedDeps;
}

// Installed registry helpers (client registry)

export function createInstalledRegistry(cwd: string): void {
  const { installedRegistryPath } = loadInstalledRegistry(cwd);

  if (!fs.existsSync(installedRegistryPath)) {
    fs.mkdirSync(path.dirname(installedRegistryPath), { recursive: true });
    fs.writeFileSync(
      installedRegistryPath,
      JSON.stringify({}, null, 2),
      "utf-8"
    );
  }
}

export function loadInstalledRegistry(cwd: string) {
  const installedRegistryPath = path.join(cwd, constants.INSTALLED_REG_FILE);
  const installedRegistry: Record<string, InstalledRegistryEntry> =
    fs.existsSync(installedRegistryPath)
      ? JSON.parse(fs.readFileSync(installedRegistryPath, "utf-8"))
      : {};
  return { installedRegistryPath, installedRegistry };

  // throw new CLIError(
  //   `Installed registry not found at ./${
  //     constants.INSTALLED_REG_FILE
  //   }. Run '${chalk.cyanBright("suic-cli init")}' to reinitialize.`
  // );
}

export function updateInstalledRegistry(
  compEntry: ComponentsRegistryEntry,
  registryPath: string
) {
  let registry: Record<string, any> = {};

  // Load existing registry if it exists
  if (fs.existsSync(registryPath)) {
    registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  }

  // Copy only necessary fields
  registry[compEntry.name] = {
    files: compEntry.files ?? [],
    dependencies: compEntry.dependencies ?? {},
    devDependencies: compEntry.devDependencies ?? {},
    peerDependencies: compEntry.peerDependencies ?? {},
  };

  // Save back to file
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  return registry;
}

export function removeFromInstalledRegistry(
  compName: string,
  registryPath: string
) {
  if (!fs.existsSync(registryPath)) return {};

  const registry: Record<string, InstalledRegistryEntry> = JSON.parse(
    fs.readFileSync(registryPath, "utf-8")
  );

  // TODO: add lowercase check
  if (registry[compName]) {
    delete registry[compName];

    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  }

  return registry;
}

// installer/uninstaller functions

export async function installInitFiles(
  registry: InitRegistry,
  cwd: string,
  installPath: string
) {
  // Install files from registry
  for (const filePath of registry.files) {
    const targetPath = path.join(cwd, installPath, filePath);
    const content = await fetchFileData(buildUrl(constants.BASE_URL, filePath));

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf-8");
  }

  // Add path alias in tsconfig.json
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    const tsconfigRaw = fs.readFileSync(tsconfigPath, "utf-8");
    const tsconfig = JSON.parse(tsconfigRaw);

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};

    const { alias, value } = constants.SUIC_TS_ALIAS;

    // Only add if not already present
    if (!tsconfig.compilerOptions.paths[alias]) {
      tsconfig.compilerOptions.paths[alias] = [value(installPath)];
      fs.writeFileSync(
        tsconfigPath,
        JSON.stringify(tsconfig, null, 2),
        "utf-8"
      );
    }
  }
}

export async function installComponentFiles(
  compEntry: ComponentsRegistryEntry,
  installedRegistry: Record<string, InstalledRegistryEntry>,
  cwd: string,
  installPath: string
): Promise<"installed" | "skipped"> {
  // Check if component is already in installed registry
  if (installedRegistry[compEntry.name]) {
    const reinstall = await askConfirm(
      `Component '${chalk.cyanBright(
        compEntry.name
      )}' already installed. Reinstall? (${chalk.yellow(
        "Warning: modified files will be lost (incl. shared deps)"
      )})`
    );
    if (!reinstall) return "skipped";
  }

  // Proceed: write files fresh
  for (const filePath of compEntry.files) {
    const targetPath = path.join(cwd, installPath, filePath);
    const content = await fetchFileData(buildUrl(constants.BASE_URL, filePath));

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf-8");
  }

  return "installed";
}

export async function removeComponentFiles(
  compEntry: { files: string[] },
  installedRegistry: Record<string, InstalledRegistryEntry>,
  toRemove: string[],
  cwd: string,
  installPath: string
) {
  for (const file of compEntry.files ?? []) {
    const targetPath = path.join(cwd, installPath, file); // build full path

    const usedElsewhere = Object.entries(installedRegistry).some(
      ([name, other]) =>
        !toRemove.map((n) => n.toLowerCase()).includes(name.toLowerCase()) &&
        (other.files ?? []).includes(file)
    );

    if (!usedElsewhere && fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  }
}
