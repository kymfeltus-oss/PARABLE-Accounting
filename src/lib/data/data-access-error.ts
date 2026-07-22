export type DataAccessErrorOptions = {
  operation: string;
  message: string;
  cause?: unknown;
};

export class DataAccessError extends Error {
  readonly operation: string;
  readonly cause?: unknown;

  constructor({ operation, message, cause }: DataAccessErrorOptions) {
    super(message);
    this.name = "DataAccessError";
    this.operation = operation;
    this.cause = cause;
  }
}
