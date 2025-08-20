import chalk from "chalk";

const prefix = "";

type Indent = { char?: string; level?: number };

const logMessage = (
  msg: string,
  colorFn: (txt: string) => string,
  method: "log" | "warn" | "error" = "log",
  indent: Indent = { char: " ", level: 0 }
) => {
  console[method](
    (indent.char || " ").repeat(indent.level || 0),
    prefix,
    colorFn(msg)
  );
};

export const logger = {
  log: (msg: string, indent?: Indent, symbol: string = "") =>
    logMessage(
      msg,
      (txt) => symbol + " " + chalk.whiteBright(txt),
      "log",
      indent
    ),
  info: (msg: string, indent?: Indent) =>
    logMessage(
      msg,
      (txt) => chalk.blueBright("ℹ") + " " + chalk.whiteBright(txt),
      "log",
      indent
    ),
  success: (msg: string, indent?: Indent) =>
    logMessage(
      msg,
      (txt) => chalk.greenBright("✔") + " " + chalk.whiteBright(txt),
      "log",
      indent
    ),
  warn: (msg: string, indent?: Indent) =>
    logMessage(
      msg,
      (txt) => chalk.yellowBright("⚠") + " " + chalk.whiteBright(txt),
      "warn",
      indent
    ),
  error: (msg: string, indent?: Indent) =>
    logMessage(
      msg,
      (txt) => chalk.redBright("✖") + " " + chalk.whiteBright(txt),
      "error",
      indent
    ),
  break: (n: number = 0) => console.log("\n".repeat(n)),
  divider: (
    n: number = 30,
    char: string = "_",
    indent: Indent = { char: " ", level: 0 }
  ) =>
    console.log(
      (indent.char || " ").repeat(indent.level || 0) + char.repeat(n)
    ),
};
