#!/usr/bin/env node

import { Command } from "commander";
import { registerCommands } from "./commands";
import { handleError } from "./utils/error-handler";

const program = new Command();

program
  .name("suic-cli")
  .description("Simple UI Components CLI")
  .version("1.0.0")
  .showHelpAfterError()
  .showSuggestionAfterError();

try {
  registerCommands(program);
} catch (e) {
  handleError(e);
}

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
