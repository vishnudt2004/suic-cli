#!/usr/bin/env node
import path from "path";
import { Command } from "commander";
import prompts from "prompts";
import chalk from "chalk";
import { logger } from "./utils/logger";
import { getConfig, createConfig } from "./utils/get-config";
import {
  addComponents,
  ComponentEntry,
  fetchRegistry,
} from "./utils/component-utils";

const URL = {
  REGISTRY_URL:
    "https://raw.githubusercontent.com/vishnudt2004/suic-core/main/components/index.json",
  GITHUB_RAW_BASE:
    "https://raw.githubusercontent.com/vishnudt2004/suic-core/main/components",
};

const program = new Command();

program
  .name("suic-cli")
  .description(
    chalk.blue("CLI for adding Simple UI Components to your project")
  )
  .addHelpText(
    "after",
    chalk.blue(
      "\nMore info and documentation: https://suic-docs.vercel.app/docs/cli\n"
    )
  );

program
  .command("add")
  .argument("[components...]", "Names of components to add")
  .option(
    "-c, --cwd <cwd>",
    "working directory",
    path.resolve(process.cwd()).replace(/\\/g, "/")
  )
  .action(async (components: string[], opts: any) => {
    try {
      // Load or create config
      const cwd = path.resolve(opts.cwd);
      let config = (await getConfig(cwd)) || createConfig({ cwd });

      const availableComponents = await fetchRegistry(URL.REGISTRY_URL);

      const validComponents: ComponentEntry[] = [];
      const invalidComponents: string[] = [];

      // If components were specified by user
      if (components && components.length > 0) {
        for (const name of components) {
          const entry = availableComponents.find(
            (c) => c.component_name.toLowerCase() === name.toLowerCase()
          );
          if (entry) validComponents.push(entry);
          else invalidComponents.push(name);
        }
      }

      // If no components specified, prompt user
      if (!validComponents.length && (!components || !components.length)) {
        const { selected } = await prompts({
          type: "multiselect",
          name: "selected",
          message: "Which components would you like to add?",
          choices: availableComponents.map((c) => ({
            title: c.component_name,
            value: c,
          })),
        });

        if (!selected || !selected.length) {
          logger.info("No components selected. Exiting.");
          process.exit(1);
        }

        validComponents.push(...selected);
      }

      // Add components
      const { added, failed } = await addComponents(
        validComponents,
        config,
        { cwd },
        URL.GITHUB_RAW_BASE
      );

      if (added.length) {
        logger.success(`Successfully added components: ${added.join(", ")}`);
      }

      if (failed.length) {
        logger.error(`Failed to add components: ${failed.join(", ")}`);
      }

      // Show errors for CLI args not found in the registry
      if (invalidComponents.length) {
        logger.error(
          `Components not found in registry: ${invalidComponents.join(", ")}`
        );
        logger.info(
          `Visit the docs site to see available components: https://suic-docs.vercel.app/docs/components`
        );
      }
    } catch (err: any) {
      logger.error("Error:", err.message || err);
      process.exit(1);
    }
  });

program.parse(process.argv);
