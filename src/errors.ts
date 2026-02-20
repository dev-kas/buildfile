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
