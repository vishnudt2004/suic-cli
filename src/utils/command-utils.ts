import { Command } from "commander";
import chalk from "chalk";
import { CLIError } from "./error-handler";
import type { CommandDef, CLIDef } from "../lib/types";

const cliStyle: CLIDef["style"] = {
  styleUsage: (str) => chalk.whiteBright(str),
  styleSubcommandTerm: (cmdName) => chalk.hex("#c4c4c4")(cmdName),
  styleOptionTerm: (optName) => chalk.hex("#c4c4c4")(optName),
  styleTitle: (str) => chalk.bold.hex("#9CA3AF")(str),
  styleSubcommandDescription: (str) => chalk.white(str),
  styleOptionDescription: (str) => chalk.white(str),
};

export function registerCli(
  program: Command,
  {
    brandLogo,
    name,
    description,
    help,
    version,
    style = cliStyle || {},
  }: CLIDef
) {
  return program
    .name(name)
    .addHelpText("beforeAll", `\n${brandLogo}\n`)
    .description(description)
    .addHelpText("after", help)
    .version(version)
    .configureHelp(style);
}

export function registerCommand(
  program: Command,
  { command, description, options, action, errDescription }: CommandDef
) {
  const cmd = program.command(command).description(description);

  if (options?.length)
    for (const { flags, description, defaultValue } of options) {
      cmd.option(flags, description, defaultValue);
    }

  cmd.action(async (...args) => {
    try {
      await action(...args);
    } catch (err) {
      throw new CLIError(errDescription, err);
    }
  });

  return program;
}
