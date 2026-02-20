// for errors during code execution (eg. running a task)
export class RuntimeError extends Error {
  constructor(message: string) {
    super(`${message}`);
    this.name = "RuntimeError";
  }
}

// for errors during parsing or lexing
export class SyntaxError extends Error {
  constructor(message: string, ln: number, col: number) {
    super(`${message} at line ${ln}, col ${col}`);
    this.name = "SyntaxError";
  }
}

// for unexpected errors in the engine (not on a user-defined data)
// if this error is ever thrown (without a catch), there is almost
// certainly a bug in the engine
export class EngineError extends Error {
  constructor(message: string) {
    super(
      `Internal EngineError: ${message} (this is a bug in the engine, not user code)`,
    );
    this.name = "EngineError";
  }
}
