import chalk from "chalk";

export const logger = {
  log: (msg?: any, ...args: any[]) => console.log(chalk.white(msg), ...args),
  info: (msg?: any, ...args: any[]) =>
    console.info(chalk.blue("ℹ️ ", msg), ...args),
  warn: (msg?: any, ...args: any[]) =>
    console.warn(chalk.yellow("⚠️ ", msg), ...args),
  error: (msg?: any, ...args: any[]) =>
    console.error(chalk.red("❌ ", msg), ...args),
  success: (msg?: any, ...args: any[]) =>
    console.log(chalk.green("✅ ", msg), ...args),
  break: () => console.log(""),
};
