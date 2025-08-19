import chalk from "chalk";
import { ENV } from "../constants";

const prefix = `[${chalk.bgGray(" suic ")}]`;

export const logger = {
  info: (msg: string) => {
    console.log(prefix, chalk.blue("ℹ", msg));
  },
  success: (msg: string) => {
    console.log(prefix, chalk.green("✔", msg));
  },
  warn: (msg: string) => {
    console.warn(prefix, chalk.yellow("⚠", msg));
  },
  error: (msg: string, err?: unknown) => {
    console.error(prefix, chalk.red("✖", msg));
    if (ENV.MODE === "DEV" && err instanceof Error) {
      console.error(chalk.gray(err.stack || err.message));
    }
  },
  break: (n: number = 1, char: string = "\n") => console.log(char.repeat(n)),
};
