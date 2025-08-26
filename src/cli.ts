#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { cliUi } from "./constants";
import { commands } from "./commands";
import { registerCli, registerCommand } from "./utils/command-utils";
import { logger } from "./utils/logger";
import { handleError } from "./utils/error-handler";
import type { CLIDef } from "./lib/types";

const program = new Command();

const cli: CLIDef = {
  brandLogo: cliUi.logo,
  name: cliUi.name,
  description: `Manage and install ${chalk.whiteBright(
    "Simple UI Components"
  )} effortlessly.`,
  helpText: cliUi.helpText,
  version: cliUi.version,
};

registerCli(program, cli);

commands.forEach((command) => registerCommand(program, command));

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    handleError(e);
  }
})();

[
  { evt: "unhandledRejection", cb: handleError },
  { evt: "uncaughtException", cb: handleError },
  {
    evt: "SIGINT",
    cb: () => {
      logger.log("\nExiting...", undefined, chalk.redBright("✖"));
      process.exit(0);
    },
  },
].forEach(({ evt, cb }) => process.on(evt, cb));
