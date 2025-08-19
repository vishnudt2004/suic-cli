import { logger } from "./logger";
import { ENV } from "../constants";

export class ContextError extends Error {
  context: string;

  constructor(err: unknown, context: string) {
    const message = err instanceof Error ? err.message : String(err);
    super(message);
    this.name = "ContextError";
    this.context = context;

    // preserve original stack if available
    if (err instanceof Error && err.stack) {
      this.stack = err.stack;
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextError);
    }
  }
}

export function handleError(err: unknown): void {
  if (err instanceof ContextError) {
    if (ENV.MODE === "DEV") {
      logger.error(`Error in ${err.context}:`, err); // full error + context
    } else {
      logger.error(`Error in ${err.context}: ${err.message}`); // minimal
    }
  } else if (err instanceof Error) {
    if (ENV.MODE === "DEV") {
      logger.error("Error:", err); // full error
    } else {
      logger.error(err.message); // minimal
    }
  } else {
    logger.error(String(err));
  }

  process.exit(1);
}
