// Node Types

export type NodeType =
  // The Root
  | "Program"

  // Top-Level Declarations
  | "TaskDeclaration" // task build depends clean { ... }
  | "VarDeclaration" // const/let/env x = ...
  | "ToolDeclaration" // tool python { ... }

  // The Only Statement Type Allowed
  | "ExpressionStmt" // Wraps a function call like rm(...)
  | "PlatformBlock" // platform-specific path

  // Expressions (Values)
  | "NamedArg" // arg: value
  | "AssignmentExpr" // x = ...
  | "BinaryExpr" // 2 + 3, "a" + "b"
  | "CallExpr" // glob(...), path(...), exec(...)
  | "ArrayLiteral" // ["-o", "bin"]
  | "SpreadElement" // ...spread
  | "ObjectLiteral" // Used for named args: { force: true }
  | "Property" // Key-Value pair inside Object/Tool
  | "TemplateLiteral" // "${DIR}/file"

  // Primitives
  | "Identifier" // BUILD_DIR
  | "StringLiteral" // "src"
  | "NumericLiteral" // 8080
  | "BooleanLiteral"; // true

// Interfaces

export interface Stmt {
  kind: NodeType;
}

export interface Expr extends Stmt {}

export interface Program extends Stmt {
  kind: "Program";
  body: Stmt[];
}

// Top-Level Declarations

// const SRC = "..." | env PORT = "..."
export interface VarDeclaration extends Stmt {
  kind: "VarDeclaration";
  isConst: boolean; // true if prefixed with const
  isEnv: boolean; // true if 'env', false if 'const/let'
  identifier: string;
  value: Expr;
}

// task build depends [clean] { ... }
export interface TaskDeclaration extends Stmt {
  kind: "TaskDeclaration";
  symbol: string; // "build"
  dependencies: string[]; // ["clean"]
  body: Expr[]; // A list of CallExprs (commands)
}

// tool python { windows: "py.exe", unix: "python3" }
// This replaces if/else for platform logic
export interface ToolDeclaration extends Stmt {
  kind: "ToolDeclaration";
  symbol: string; // "python"
  options: ToolOption[]; // The platform mappings
}

type ToolOption = {
  platform: string | null;
  arch: string | null;
  expr: Expr;
};

// platform-specific blocks
export interface PlatformBlock extends Stmt {
  kind: "PlatformBlock";
  type: "plat" | "arch";
  symbol: string;
  body: Stmt[];
  elseBody?: Stmt[];
}

// Logic (Linear Execution)

// x = ...
export interface AssignmentExpr extends Expr {
  kind: "AssignmentExpr";
  assignee: Expr;
  value: Expr;
}

// 2 + 3, PORT + 1, name + "-v1"
export interface BinaryExpr extends Expr {
  kind: "BinaryExpr";
  left: Expr;
  right: Expr;
  operator: string;
}

// arg: value
export interface NamedArg extends Expr {
  kind: "NamedArg";
  name: string;
  value: Expr;
}

// exec("cmd", { args: [...] })
export interface CallExpr extends Expr {
  kind: "CallExpr";
  callee: Expr; // The function (e.g., "exec", "rm", "glob")
  args: Expr[]; // Positional arguments
}

// Data Structures

// [ "-o", ... ]
export interface ArrayLiteral extends Expr {
  kind: "ArrayLiteral";
  elements: Expr[];
}

// ...spread
export interface SpreadElement extends Expr {
  kind: "SpreadElement";
  argument: Expr;
}

// Primitives

// "${SRC_DIR}/main.cpp"
export interface TemplateLiteral extends Expr {
  kind: "TemplateLiteral";
  raw: string; // The full string for easy debugging
  segments: string[]; // ["", "/main.cpp"]
  variables: string[]; // ["SRC_DIR"] - simplified for DSL
}

export interface Identifier extends Expr {
  kind: "Identifier";
  symbol: string;
}

export interface StringLiteral extends Expr {
  kind: "StringLiteral";
  value: string;
}

export interface NumericLiteral extends Expr {
  kind: "NumericLiteral";
  value: number;
}

export interface BooleanLiteral extends Expr {
  kind: "BooleanLiteral";
  value: boolean;
}
