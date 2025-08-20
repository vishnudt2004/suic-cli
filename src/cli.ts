#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { registerCommands } from "./commands";
import { handleError } from "./utils/error-handler";
import { cliUi } from "./constants";

const program = new Command();

program.configureHelp({
  styleUsage: (str) => chalk.whiteBright(str),
  styleSubcommandTerm: (cmdName) => chalk.hex("#c4c4c4")(cmdName),
  styleOptionTerm: (optName) => chalk.hex("#c4c4c4")(optName),
  styleTitle: (str) => chalk.bold.hex("#9CA3AF")(str),
  styleSubcommandDescription: (str) => chalk.white(str),
  styleOptionDescription: (str) => chalk.white(str),
  styleDescriptionText: (str) => chalk.cyan(str),
});

program
  .name(cliUi.name)
  .addHelpText("beforeAll", `\n${cliUi.logo}\n`)
  .description(`Manage and install UI components effortlessly.`)
  .addHelpText("after", cliUi.helpText)
  .version(cliUi.version);

registerCommands(program);

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    handleError(e);
  }
})();

process.on("unhandledRejection", (err) => {
  handleError(err);
});

process.on("uncaughtException", (err) => {
  handleError(err);
});
