import { Command } from "commander";
import chalk from "chalk";
import { askConfirm, askMultiSelect } from "./utils/prompt-handler";
import { logger } from "./utils/logger";
import { CLIError } from "./utils/error-handler";
import { fetchInitRegistry, fetchComponentsRegistry } from "./utils/fetch";
import { getConfig, createConfig } from "./utils/config";
import { cliUi, constants } from "./constants";
import { buildUrl } from "./utils/url-utils";
import {
  createInstalledRegistry,
  getUnusedDeps,
  installComponentFiles,
  installInitFiles,
  loadInstalledRegistry,
  logDependencies,
  removeComponentFiles,
  removeFromInstalledRegistry,
  updateInstalledRegistry,
} from "./utils/install-manager";
import { ComponentsRegistryEntry, InstalledRegistryEntry } from "./lib/types";
import path from "path";
import fs from "fs";

const initRegUrl = buildUrl(constants.BASE_URL, constants.INIT_REG_FILE);
const componentsRegUrl = buildUrl(constants.BASE_URL, constants.COMPS_REG_FILE);

export function registerCommands(program: Command) {
  // INIT COMMAND
  program
    .command("init")
    .description("Set up Simple UI Components in your project")
    .option(
      "-i, --install-path <path>",
      "Custom installation directory",
      constants.DEFAULT_INSTALL_PATH
    )
    .action(async (opts) => {
      try {
        const confirmed = await askConfirm(
          `${chalk.yellowBright(
            "⚠"
          )} Confirm you're in the project root (with package.json).`
        );

        if (!confirmed) {
          logger.info("Initialization cancelled.");
          process.exit(0);
        }

        const cwd = process.cwd();
        const installPath = opts.installPath || constants.DEFAULT_INSTALL_PATH;

        // config + boostrap
        createConfig({ installPath });
        const registry = await fetchInitRegistry(initRegUrl);
        installInitFiles(registry, cwd, installPath);

        // Log deps/devDeps/peerDeps
        logDependencies(
          `Required dependencies (${chalk.yellow(
            "install if missing, skip if already installed and compatible"
          )}):`,
          {
            dependencies: registry.dependencies,
            devDependencies: registry.devDependencies,
            peerDependencies: registry.peerDependencies,
          },
          cwd
        );

        // Additional instructions
        if (registry.additionalInstructions?.length) {
          logger.info("Additional setup instructions:");
          for (const i of registry.additionalInstructions) {
            logger.log(`${i.title}:`, { level: 1 }, "●");
            logger.log(i.description, { level: 2 });
          }
          logger.break();
        }

        // Ensure empty installed-registry.json exists
        createInstalledRegistry(cwd);

        logger.success(
          `Simple UI Components ready at '${installPath}'. Run '${chalk.green(
            "suic-cli add [components...]"
          )}' to use.`
        );
      } catch (err) {
        throw new CLIError("Error in initialization", err);
      }
    });

  // ADD COMMAND
  program
    .command("add [components...]")
    .description("Add one or more components to your project")
    .action(async (componentArgs: string[]) => {
      try {
        const cwd = process.cwd();
        const config = getConfig();
        const componentsReg: ComponentsRegistryEntry[] =
          await fetchComponentsRegistry(componentsRegUrl); // load server catalog
        const { installedRegistryPath, installedRegistry } =
          loadInstalledRegistry(cwd); // load local installed registry

        const catalogByName = new Map(
          componentsReg.map((c) => [c.name.toLowerCase(), c])
        );

        // Prompt if no components specified
        if (!componentArgs?.length) {
          componentArgs = await askMultiSelect(
            "Select components to add:",
            componentsReg.map((c: any) => c.name)
          );
        }

        const invalid: string[] = [];
        const added: string[] = [];
        const skipped: string[] = [];
        const mergedDeps = {
          dependencies: {},
          devDependencies: {},
          peerDependencies: {},
        };

        for (const rawName of componentArgs) {
          const comp = catalogByName.get(rawName.toLowerCase());
          if (!comp) {
            invalid.push(rawName);
            continue;
          }

          const state = await installComponentFiles(
            comp,
            installedRegistry,
            cwd,
            config.installPath
          );

          if (state === "skipped") {
            skipped.push(comp.name);
            continue;
          }

          // state === "installed"

          added.push(comp.name);

          updateInstalledRegistry(comp, installedRegistryPath);

          // keep in-memory copy fresh for same-run batch behavior
          installedRegistry[comp.name] = {
            files: comp.files,
            dependencies: comp.dependencies ?? {},
            devDependencies: comp.devDependencies ?? {},
            peerDependencies: comp.peerDependencies ?? {},
          };

          // merge deps for user log
          Object.assign(mergedDeps.dependencies, comp.dependencies ?? {});
          Object.assign(mergedDeps.devDependencies, comp.devDependencies ?? {});
          Object.assign(
            mergedDeps.peerDependencies,
            comp.peerDependencies ?? {}
          );
        }

        logger.break();

        if (added.length) {
          logDependencies(
            `Required dependencies (${chalk.yellow(
              "install if missing, skip if already installed and compatible"
            )}):`,
            mergedDeps,
            cwd
          );

          logger.success(
            `Successfully added components: ${chalk.cyanBright(
              added.join(", ")
            )}`
          );
        }
        if (skipped.length) {
          logger.info(
            `Skipped components (already installed): ${chalk.cyanBright(
              skipped.join(", ")
            )}`
          );
        }
        if (invalid.length) {
          logger.error(
            `Not found in registry (failed components): ${chalk.cyanBright(
              invalid.join(", ")
            )}`
          );
        }
      } catch (err) {
        throw new CLIError("Error in component installation", err);
      }
    });

  // REMOVE COMMAND
  program
    .command("remove [components...]")
    .description("Remove one or more components from your project")
    .action(async (componentArgs: string[]) => {
      try {
        const cwd = process.cwd();
        const config = getConfig();

        const { installedRegistryPath, installedRegistry } =
          loadInstalledRegistry(cwd);
        const installedNames = Object.keys(installedRegistry);

        if (!installedNames.length) {
          throw new CLIError(
            "No components were installed or the installed registry-file is missing."
          );
        }

        // Prompt if no components specified
        if (!componentArgs?.length) {
          componentArgs = await askMultiSelect(
            "Select components to remove:",
            installedNames
          );
        }

        // Validate
        const invalid: string[] = [];
        const removed: string[] = [];

        const toRemove = componentArgs.filter((rawName) => {
          if (
            !installedNames
              .map((n) => n.toLowerCase())
              .includes(rawName.toLowerCase())
          ) {
            invalid.push(rawName);
            return false;
          }
          return true;
        });
        if (!toRemove.length) {
          logger.warn("No valid components selected for removal.");
          return;
        }

        // collect deps from the batch to show as potentially removable
        type DepType = Record<string, string>;
        const removeDeps = {
          dependencies: {} as DepType,
          devDependencies: {} as DepType,
          peerDependencies: {} as DepType,
        };

        for (const compName of toRemove) {
          // Find actual key in installed registry (case-insensitive)
          const registryKey = installedNames.find(
            (n) => n.toLowerCase() === compName.toLowerCase()
          );
          if (!registryKey) continue; // safety
          const compEntry = installedRegistry[registryKey];

          // Collect deps
          Object.assign(removeDeps.dependencies, compEntry.dependencies ?? {});
          Object.assign(
            removeDeps.devDependencies,
            compEntry.devDependencies ?? {}
          );
          Object.assign(
            removeDeps.peerDependencies,
            compEntry.peerDependencies ?? {}
          );

          // remove files (only if unused by components NOT in the batch)
          removeComponentFiles(
            compEntry,
            installedRegistry,
            toRemove,
            cwd,
            config.installPath
          );

          // drop from registry (persist)
          removeFromInstalledRegistry(compName, installedRegistryPath);
          removed.push(compName);

          // keep in-memory view consistent during this run
          delete installedRegistry[compName];
        }

        // log only unused deps
        const unusedDeps = getUnusedDeps(
          removeDeps,
          installedRegistry,
          toRemove
        );

        logDependencies(
          `No longer required dependencies (${chalk.yellow(
            "uninstall if unused, skip if still needed"
          )}):`,
          unusedDeps,
          cwd
        );

        logger.break();

        if (removed.length) {
          logger.success(
            `Successfully removed components: ${chalk.cyanBright(
              removed.join(", ")
            )}`
          );
        }

        if (invalid.length) {
          logger.error(
            `Invalid components (not installed / not found): ${chalk.cyanBright(
              invalid.join(", ")
            )}`
          );
        }
      } catch (err) {
        throw new CLIError("Error in component removal", err);
      }
    });
}
