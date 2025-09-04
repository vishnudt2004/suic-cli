import path from "path";
import chalk from "chalk";
import { cliUi, constants } from "./constants";
import { buildUrl } from "./utils/url-utils";
import { askConfirm, askMultiSelect } from "./utils/prompt-handler";
import { logger } from "./utils/logger";
import { createConfig, getConfig } from "./utils/config";
import { fetchRegistry } from "./utils/fetch";
import { CLIError } from "./utils/error-handler";
import {
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
} from "./utils/install-manager";
import type {
  CommandDef,
  ComponentsRegistryEntry,
  InitRegistry,
  InstalledRegistryEntry,
} from "./lib/types";

const {
  COMPS_DOC_URL: compsDocUrl,
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

// shared helper function
const logList = (items: string[]) =>
  items.map((i) => `${chalk.gray("●")} ${chalk.cyanBright(i)}`).join(", ");

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
    const installPath = sanitizeInstallPath(
      opts.installPath || dfltInstallPath
    );
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
      action: "install",
    });

    // log additional instr.
    if (registry.additionalInstructions?.length) {
      logger.info("Additional setup instructions:");
      for (const i of registry.additionalInstructions) {
        logger.log(`${i.title}:`, { level: 1 }, "▪");
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

    // reshape registry
    const catalogByName = Object.fromEntries(
      componentsRegistry.map((c) => [normalizeName(c.name), c])
    );

    // handle empty registry
    if (!Object.keys(catalogByName).length)
      throw new CLIError("No components available.");

    // prompt if none specified
    if (!componentArgs?.length) {
      componentArgs = await askMultiSelect(
        "Select components to add:",
        componentsRegistry.map((c) => c.name)
      );
    }

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

    // remove duplicates
    componentArgs = dedupeCaseInsensitive(componentArgs);

    for (const rawArg of componentArgs) {
      const compKey = normalizeName(rawArg);
      const comp = catalogByName[compKey];

      // handle invalid component
      if (!comp) {
        logs.invalid.push(rawArg);
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
      const targetDir = path.join(cwd, config.installPath);
      await installFiles(comp.files, baseUrl, targetDir);
      logs.added.push(comp.name);

      // update installed-registry
      updateInstalledRegistry(comp, installedRegistryPath, "add");

      // collect req. deps
      DEP_KEYS.forEach((key) => Object.assign(reqdDeps[key], comp[key] ?? {}));
    }

    logger.break();

    // log messages
    if (logs.added.length) {
      // log req. deps
      logDependencies({
        description: `Required dependencies (${chalk.yellow(
          "install if missing, skip if already installed and compatible"
        )}):`,
        registryDeps: reqdDeps,
        cwd,
        action: "install",
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
        `Failed to add components (not found in the registry): ${logList(
          logs.invalid
        )}`
      );
    }
    if (logs.added.length) {
      logger.break();
      logger.info(`${chalk.gray.italic("Docs:")} ${chalk.blue(compsDocUrl)}`);
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

    // reshape registry
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

    // collect logs, entries
    type Logs = Record<"removed" | "invalid", string[]>;
    const logs: Logs = { removed: [], invalid: [] };
    type Entries = Record<
      "removedEntries" | "remainingEntries",
      Record<string, InstalledRegistryEntry>
    >;
    const entries: Entries = {
      removedEntries: {},
      remainingEntries: {},
    };

    // remove duplicates
    componentArgs = dedupeCaseInsensitive(componentArgs);

    for (const rawArg of componentArgs) {
      const compKey = normalizeName(rawArg);
      const regName = normalizedMap.get(compKey);

      // handle invalid component
      if (!regName) {
        logs.invalid.push(rawArg);
        continue;
      }

      // collect removed entries
      const removedEntry = installedRegistry[regName];
      if (removedEntry) entries.removedEntries[regName] = removedEntry;

      // update installed-registry, in-memory copy
      updateInstalledRegistry(regName, installedRegistryPath, "remove");
      delete installedRegistry[regName];

      logs.removed.push(regName);
    }

    // collect remaining entries
    entries.remainingEntries = { ...installedRegistry };

    // helper IIFE
    const { unusedDeps, unusedFiles } = ((entries: Entries) => {
      const DEP_KEYS = [
        "dependencies",
        "devDependencies",
        "peerDependencies",
      ] as const;

      const keepDeps = new Set<string>();
      const keepFiles = new Set<string>();

      // extract deps, files from remaining
      Object.values(entries.remainingEntries).forEach((entry) => {
        DEP_KEYS.forEach((k) =>
          Object.keys(entry?.[k] ?? {}).forEach((dep) => keepDeps.add(dep))
        );
        entry?.files?.forEach((f) => keepFiles.add(f));
      });

      const unusedDeps = Object.fromEntries(
        DEP_KEYS.map((k) => [k, {}])
      ) as Record<(typeof DEP_KEYS)[number], Record<string, string>>;
      const unusedFilesSet = new Set<string>();

      // compute unused deps, files
      Object.values(entries.removedEntries).forEach((entry) => {
        DEP_KEYS.forEach((k) =>
          Object.entries(entry?.[k] ?? {}).forEach(([dep, ver]) => {
            if (!keepDeps.has(dep)) unusedDeps[k][dep] = ver;
          })
        );
        entry?.files?.forEach((f) => {
          if (!keepFiles.has(f)) unusedFilesSet.add(f);
        });
      });

      return { unusedDeps, unusedFiles: Array.from(unusedFilesSet) };
    })(entries);

    // remove component files, empty folders
    if (unusedFiles.length) {
      const targetDir = path.join(cwd, config.installPath);
      removeFiles(unusedFiles, targetDir);
      removeEmptyDirs(targetDir, unusedFiles, [targetDir]);
    }

    logger.break();

    // log messages
    if (logs.removed.length) {
      // log unused deps
      logDependencies({
        description: `No longer required dependencies (${chalk.yellow(
          "uninstall if unused, skip if still needed"
        )}):`,
        registryDeps: unusedDeps,
        cwd,
        action: "uninstall",
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

const list: CommandDef = {
  command: "list",
  description: "Show all available components with descriptions",
  action: async () => {
    // fetch components registry
    const componentsRegistry = await fetchRegistry<ComponentsRegistryEntry[]>(
      componentsRegUrl,
      "Failed to fetch components registry"
    );

    // reshape registry
    const mapDescrByName = Object.fromEntries(
      componentsRegistry.map((c) => [
        c.name,
        { description: c.description, docUrl: c.docUrl },
      ])
    );

    // handle empty registry
    if (!Object.keys(mapDescrByName).length)
      throw new CLIError("No components available.");

    // display brand logo
    logger.break();
    logger.title(cliUi.logo);

    // log list
    const title = "Available components:";
    logger.title(title, undefined, {
      char: "═ ",
      length: Math.ceil((title.length + 1) / 2),
    });

    for (const [comp, { description, docUrl }] of Object.entries(
      mapDescrByName
    )) {
      logger.log(`${chalk.blueBright(comp)}`, { level: 1 }, chalk.gray("●"));
      logger.log(`${description || chalk.gray.dim("(no description)")}`, {
        level: 3,
      });
      logger.log(`${chalk.gray.italic("Docs: ")}${chalk.blue(docUrl)}`, {
        level: 3,
      });
      logger.break();
    }

    // log short instr.
    logger.break();
    logger.info(
      `Use '${chalk.green("suic-cli add [components...]")}' to install.`
    );
    logger.info(
      `Or run '${chalk.green("suic-cli add")}' to select from the list.`
    );
  },
  errDescription: "Error in listing components",
};

export const commands = [init, add, remove, list];
