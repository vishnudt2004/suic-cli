import { Command } from "commander";
import chalk from "chalk";
import { askConfirm, askMultiSelect } from "./utils/prompt-handler";
import { logger } from "./utils/logger";
import { CLIError } from "./utils/error-handler";
import { fetchInitRegistry, fetchComponentsRegistry } from "./utils/fetch";
import { getConfig, createConfig } from "./utils/config";
import { cliUi, constants } from "./constants";
import { buildUrl } from "./utils/url-utils";
import { installComponentFiles, installInitFiles } from "./utils/installer";
import { ensureDependencies } from "./utils/dependencies";
import { ComponentsRegistryEntry } from "./lib/types";

const initRegUrl = buildUrl(constants.BASE_URL, constants.INIT_REG_FILE);
const componentsRegUrl = buildUrl(constants.BASE_URL, constants.COMPS_REG_FILE);

export function registerCommands(program: Command) {
  // INIT COMMAND
  program
    .command(cliUi.commands.init)
    .description("Set up Simple UI Components in your project")
    .option(
      "-i, --install-path <path>",
      "Custom installation directory",
      constants.DEFAULT_INSTALL_PATH
    )
    .action(async (opts) => {
      try {
        const confirmed = await askConfirm(
          "⚠ Make sure you're in your project root folder (where package.json lives). Continue?"
        );

        if (!confirmed) {
          logger.info("Initialization cancelled.");
          process.exit(0);
        }

        const installPath = opts.installPath || constants.DEFAULT_INSTALL_PATH;
        const cwd = process.cwd();

        createConfig({ installPath });
        const registry = await fetchInitRegistry(initRegUrl);

        // Write bootstrap files (utils, styles, etc.)
        installInitFiles(registry, cwd, installPath);

        // Handle deps/devDeps/peerDeps
        ensureDependencies(
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
        const registry = await fetchComponentsRegistry(componentsRegUrl);

        // Map registry names case-insensitively
        const registryMap = new Map(
          registry.map((c: any) => [c.name.toLowerCase(), c])
        );

        // Prompt if no components specified
        if (!componentArgs?.length) {
          componentArgs = await askMultiSelect(
            "Select components to add:",
            registry.map((c: any) => c.name)
          );
        }

        const invalidComponents: string[] = [];
        const successComponents: string[] = [];
        const skippedComponents: string[] = [];
        const mergedDeps: {
          dependencies: Record<string, string>;
          devDependencies: Record<string, string>;
          peerDependencies: Record<string, string>;
        } = { dependencies: {}, devDependencies: {}, peerDependencies: {} };

        for (const rawName of componentArgs) {
          const nameKey = rawName.toLowerCase();
          const compEntry = registryMap.get(nameKey) as ComponentsRegistryEntry;

          if (!compEntry) {
            invalidComponents.push(rawName);
            continue;
          }

          const state = await installComponentFiles(
            compEntry,
            cwd,
            config.installPath
          );

          if (state === "skipped") skippedComponents.push(compEntry.name);
          if (state === "installed") {
            successComponents.push(compEntry.name);

            Object.assign(
              mergedDeps.dependencies,
              compEntry.dependencies ?? {}
            );
            Object.assign(
              mergedDeps.devDependencies,
              compEntry.devDependencies ?? {}
            );
            Object.assign(
              mergedDeps.peerDependencies,
              compEntry.peerDependencies ?? {}
            );
          }
        }

        logger.break();

        if (successComponents.length) {
          // Ensure dependencies
          ensureDependencies(mergedDeps, cwd);

          logger.success(
            `Successfully added components: ${chalk.cyanBright(
              successComponents.join(", ")
            )}`
          );
        }

        if (skippedComponents.length) {
          logger.info(
            `Skipped components (already exists): ${chalk.cyanBright(
              skippedComponents.join(", ")
            )}`
          );
        }

        if (invalidComponents.length) {
          logger.error(
            `Not found in registry (failed components): ${chalk.cyanBright(
              invalidComponents.join(", ")
            )}`
          );
        }
      } catch (err) {
        throw new CLIError("Error in component installation", err);
      }
    });
}
