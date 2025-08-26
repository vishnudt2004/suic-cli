import path from "path";
import chalk from "chalk";
import { constants } from "./constants";
import { buildUrl } from "./utils/url-utils";
import { askConfirm, askMultiSelect } from "./utils/prompt-handler";
import { logger } from "./utils/logger";
import { createConfig, getConfig } from "./utils/config";
import { fetchRegistry } from "./utils/fetch";
import { CLIError } from "./utils/error-handler";
import {
  addPathAlias,
  installFiles,
  removeFiles,
  loadInstalledRegistry,
  logDependencies,
  normalizeName,
  updateInstalledRegistry,
  removeEmptyDirs,
} from "./utils/install-manager";
import type {
  CommandDef,
  ComponentsRegistryEntry,
  InitRegistry,
} from "./lib/types";

const {
  DEFAULT_INSTALL_PATH: dfltInstallPath,
  BASE_URL: baseUrl,
  INIT_REG_FILE,
  COMPS_REG_FILE,
  TS_PATH_ALIAS: pathAlias,
} = constants;
const initRegUrl = buildUrl(baseUrl, INIT_REG_FILE);
const componentsRegUrl = buildUrl(baseUrl, COMPS_REG_FILE);
const cwd = process.cwd();

const DEP_KEYS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

const init: CommandDef = {
  command: "init",
  description: "Set up Simple UI Components in your project",
  options: [
    {
      flags: "-i, --install-path <path>",
      description: "Custom installation directory",
      defaultValue: dfltInstallPath,
    },
  ],
  action: async (opts) => {
    // confirm root
    const confirmed = await askConfirm(
      "⚠ Confirm you're in the project root (with package.json)."
    );
    if (!confirmed) return logger.info("Initialization cancelled.");

    // create config
    const installPath = opts.installPath || dfltInstallPath;
    createConfig({ installPath });

    // fetch init registry
    const registry = await fetchRegistry<InitRegistry>(
      initRegUrl,
      "Failed to fetch init registry"
    );

    // install init files
    const targetDir = path.join(cwd, installPath);
    await installFiles(registry.files, baseUrl, targetDir);

    // add path alias
    const { alias, value } = pathAlias;
    addPathAlias(cwd, { alias, value: value(installPath) });

    // log req. deps
    logDependencies({
      description: `Required dependencies (${chalk.yellow(
        "install if missing, skip if already installed and compatible"
      )}):`,
      registryDeps: registry,
      cwd,
    });

    // log additional instr.
    if (registry.additionalInstructions?.length) {
      logger.info("Additional setup instructions:");
      for (const i of registry.additionalInstructions) {
        logger.log(`${i.title}:`, { level: 1 }, "●");
        logger.log(i.description, { level: 2 });
      }
      logger.break();
    }

    // log success message
    logger.success(
      `Simple UI Components ready at '${installPath}'. Run '${chalk.green(
        "suic-cli add [components...]"
      )}' to use.`
    );
  },
  errDescription: "Error in initialization",
};

const add: CommandDef = {
  command: "add [components...]",
  description: "Add one or more components to your project",
  action: async (componentArgs: string[]) => {
    // get config
    const config = getConfig();

    // fetch components registry
    const componentsRegistry = await fetchRegistry<ComponentsRegistryEntry[]>(
      componentsRegUrl,
      "Failed to fetch components registry"
    );

    // load installed-registry
    const { installedRegistryPath, installedRegistry } =
      loadInstalledRegistry(cwd);
    const normalizedInstalledRegistry = normalizeName(installedRegistry);

    // prompt if none specified
    if (!componentArgs?.length) {
      componentArgs = await askMultiSelect(
        "Select components to add:",
        componentsRegistry.map((c) => c.name)
      );
    }

    // reshape registry
    const catalogByName = Object.fromEntries(
      componentsRegistry.map((c) => [normalizeName(c.name), c])
    );

    // collect logs, deps
    type Logs = Record<"added" | "skipped" | "invalid", string[]>;
    const logs: Logs = { added: [], skipped: [], invalid: [] };
    const reqdDeps: Record<
      "dependencies" | "devDependencies" | "peerDependencies",
      Record<string, string>
    > = {
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
    };

    for (const rawName of componentArgs) {
      const compKey = normalizeName(rawName);
      const comp = catalogByName[compKey];

      // handle invalid component
      if (!comp) {
        logs.invalid.push(rawName);
        continue;
      }

      // handle already-installed component
      if (normalizedInstalledRegistry[compKey]) {
        const reinstall = await askConfirm(
          `Component '${chalk.cyanBright(
            comp.name
          )}' already installed. Reinstall? (${chalk.yellow(
            "Warning: modified files will be lost (incl. shared deps)"
          )})`
        );

        if (!reinstall) {
          logs.skipped.push(comp.name);
          continue;
        }
      }

      // install component files
      await installFiles(
        comp.files,
        baseUrl,
        path.join(cwd, config.installPath)
      );
      logs.added.push(comp.name);

      // update installed-registry
      updateInstalledRegistry(comp, installedRegistryPath, "add");

      // collect req. deps
      DEP_KEYS.forEach((key) => Object.assign(reqdDeps[key], comp[key] ?? {}));
    }

    logger.break();

    // log messages
    const logList = (arr: string[]) => arr.map(chalk.cyanBright).join(", ");
    if (logs.added.length) {
      // log req. deps
      logDependencies({
        description: `Required dependencies (${chalk.yellow(
          "install if missing, skip if already installed and compatible"
        )}):`,
        registryDeps: reqdDeps,
        cwd,
      });

      logger.success(`Successfully added components: ${logList(logs.added)}`);
    }
    if (logs.skipped.length) {
      logger.info(
        `Skipped components (already installed): ${logList(logs.skipped)}`
      );
    }
    if (logs.invalid.length) {
      logger.error(
        `Not found in registry (failed components): ${logList(logs.invalid)}`
      );
    }
  },
  errDescription: "Error in component installation",
};

const remove: CommandDef = {
  command: "remove [components...]",
  description: "Remove one or more components from your project",
  action: async (componentArgs: string[]) => {
    // get config
    const config = getConfig();

    // load installed-registry
    const { installedRegistryPath, installedRegistry } =
      loadInstalledRegistry(cwd);
    const installedNames = Object.keys(installedRegistry);
    const normalizedMap = new Map(
      installedNames.map((name) => [normalizeName(name), name])
    );

    // handle no comps / missing registry
    if (!installedNames.length) {
      throw new CLIError(
        "No components were installed or the installed-registry file is missing."
      );
    }

    // prompt if none specified
    if (!componentArgs?.length) {
      componentArgs = await askMultiSelect(
        "Select components to remove:",
        installedNames
      );
    }

    // collect logs, deps, files
    type Logs = Record<"removed" | "invalid", string[]>;
    type Deps = Record<
      "allRemovedDeps" | "remainingDeps",
      Record<
        "dependencies" | "devDependencies" | "peerDependencies",
        Record<string, string>
      >
    >;
    const logs: Logs = { removed: [], invalid: [] };
    const deps: Deps = {
      allRemovedDeps: {
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
      },
      remainingDeps: {
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
      },
    };
    const files: Record<"allRemovedFiles" | "remainingFiles", string[]> = {
      allRemovedFiles: [],
      remainingFiles: [],
    };

    // collect remaining deps, files
    for (const comp of Object.values(installedRegistry)) {
      DEP_KEYS.forEach((key) =>
        Object.assign(deps.remainingDeps[key], comp[key] ?? {})
      );
      files.remainingFiles.push(...comp.files);
    }

    for (const rawArg of componentArgs) {
      const compKey = normalizeName(rawArg);
      const regName = normalizedMap.get(compKey);

      // handle invalid component
      if (!regName) {
        logs.invalid.push(rawArg);
        continue;
      }

      // update installed-registry
      updateInstalledRegistry(regName, installedRegistryPath, "remove");
      logs.removed.push(regName);

      // collect removed deps, files
      const comp = installedRegistry[regName];
      DEP_KEYS.forEach((key) =>
        Object.assign(deps.allRemovedDeps[key], comp[key] ?? {})
      );
      files.allRemovedFiles.push(...comp.files);

      // subtract from remaining deps, files
      DEP_KEYS.forEach((key) => {
        for (const pkg of Object.keys(comp[key] ?? {})) {
          delete deps.remainingDeps[key][pkg];
        }
      });
      files.remainingFiles = files.remainingFiles.filter(
        (f) => !comp.files.includes(f)
      );

      // update in-memory copy
      delete installedRegistry[regName];
    }

    // helper IIFE
    const { unusedDeps, unusedFiles } = (function filterUnused(
      deps: Deps,
      files: Record<"allRemovedFiles" | "remainingFiles", string[]>
    ) {
      const DEP_KEYS = [
        "dependencies",
        "devDependencies",
        "peerDependencies",
      ] as const;

      const unusedDeps: Record<
        (typeof DEP_KEYS)[number],
        Record<string, string>
      > = {
        dependencies: {},
        devDependencies: {},
        peerDependencies: {},
      };

      for (const key of DEP_KEYS) {
        for (const [pkg, version] of Object.entries(deps.allRemovedDeps[key])) {
          if (!(pkg in deps.remainingDeps[key])) {
            unusedDeps[key][pkg] = version;
          }
        }
      }

      const unusedFiles = files.allRemovedFiles.filter(
        (file) => !files.remainingFiles.includes(file)
      );

      return { unusedDeps, unusedFiles };
    })(deps, files);

    // remove component files, empty folders
    if (unusedFiles.length) {
      removeFiles(unusedFiles, path.join(cwd, config.installPath));
      removeEmptyDirs(path.join(cwd, config.installPath), unusedFiles, [
        path.join(cwd, config.installPath, "components"),
      ]);
    }

    logger.break();

    // log messages
    const logList = (arr: string[]) => arr.map(chalk.cyanBright).join(", ");
    if (logs.removed.length) {
      // log unused deps
      logDependencies({
        description: `No longer required dependencies (${chalk.yellow(
          "uninstall if unused, skip if still needed"
        )}):`,
        registryDeps: unusedDeps,
        cwd,
      });

      logger.success(
        `Successfully removed components: ${logList(logs.removed)}`
      );
    }
    if (logs.invalid.length) {
      logger.error(
        `Invalid components (not installed / not found): ${logList(
          logs.invalid
        )}`
      );
    }
  },
  errDescription: "Error in component removal",
};

export const commands = [init, add, remove];
