import { logger } from "./logger";
import { cliUi, ENV } from "../constants";

export class CLIError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    if (cause instanceof Error) this.cause = cause;
  }
}

export function handleError(err: unknown, level = 0) {
  const indent = "  ".repeat(level);
  const isDev = ENV.MODE === "DEV";

  if (err instanceof Error) {
    // Log top-level message always
    logger.error(`${indent}${err.message}`);

    // Show nested errors
    if ((err as any).cause) {
      if (isDev) {
        // full recursion with indent for DEV
        handleError((err as any).cause, level + 1);
      } else if (level === 0) {
        // PROD: show just first-level cause
        logger.error(
          `Cause: ${(err as any).cause?.message || "Unknown error"}`
        );
      }
    }

    if (isDev && err.stack && level === 0) {
      logger.break();
      logger.error(err.stack);
    }
  } else {
    logger.error(`${String(err)}`);
  }

  if (level === 0) console.log(cliUi.helpText);
}
