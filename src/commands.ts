import { Command } from "commander";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  askConfirm,
  askInput,
  askMultiSelect,
  askSelect,
} from "./utils/prompt-handler";
import { logger } from "./utils/logger";
import { CLIError } from "./utils/error-handler";
import { fetchInitRegistry, fetchComponentsRegistry } from "./utils/fetch";
import { getConfig, createConfig } from "./utils/config";
import { cliUi, constants } from "./constants";
import { buildUrl } from "./utils/url-utils";
import { installInitFiles } from "./utils/installer";
import { ensureDependencies } from "./utils/dependencies";

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
    .addHelpText("after", cliUi.helpText)
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
}
