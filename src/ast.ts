// Node Types

export type NodeType =
  // Top-Level Constructs
  | "Program"
  | "TaskDeclaration"
  | "ToolDeclaration"
  | "VarDeclaration" // Covers 'const' and 'let'
  | "EnvDeclaration" // Covers 'env'

  // Statements
  | "BlockStmt" // { ... }
  | "IfStatement"
  | "ExpressionStmt" // Wraps standalone calls like rm(...)

  // Expressions
  | "AssignmentExpr"
  | "MemberExpr" // os.is_windows
  | "CallExpr" // glob(...)
  | "BinaryExpr" // Logic inside if statements

  // DSL Specifics (Arguments & Structures)
  | "NamedArgument" // force: true
  | "SpreadElement" // ...sources
  | "PlatformMap" // The body of a 'tool'
  | "PlatformEntry" // windows: "..."

  // Literals
  | "Property" // Key-value in objects (if needed)
  | "ObjectLiteral" // { ... }
  | "ArrayLiteral" // ["-o", ...]
  | "TemplateLiteral" // "${DIR}/file"
  | "NumericLiteral"
  | "StringLiteral"
  | "BooleanLiteral"
  | "Identifier";

// Interfaces

export interface Stmt {
  kind: NodeType;
}

// Marker interface for things that return values
export interface Expr extends Stmt {}

export interface Program extends Stmt {
  kind: "Program";
  body: Stmt[]; // Tasks, Consts, Envs, Tools
}

// Declarations (Top Level)

// const X = ... | let Y = ...
export interface VarDeclaration extends Stmt {
  kind: "VarDeclaration";
  constant: boolean; // true for 'const', false for 'let'
  identifier: string;
  value: Expr;
}

// env PORT = "8080"
export interface EnvDeclaration extends Stmt {
  kind: "EnvDeclaration";
  identifier: string;
  value: Expr;
}

// task name depends [deps] { body }
export interface TaskDeclaration extends Stmt {
  kind: "TaskDeclaration";
  name: string;
  dependencies: string[]; // e.g. ["clean", "build"]
  body: BlockStmt;
}

// tool name { ... }
export interface ToolDeclaration extends Stmt {
  kind: "ToolDeclaration";
  name: string;
  body: PlatformMap;
}

// Statements

export interface BlockStmt extends Stmt {
  kind: "BlockStmt";
  body: Stmt[];
}

export interface ExpressionStmt extends Stmt {
  kind: "ExpressionStmt";
  expression: Expr;
}

export interface IfStatement extends Stmt {
  kind: "IfStatement";
  condition: Expr;
  consequent: BlockStmt;
  alternate?: BlockStmt | IfStatement; // Else block or Else If
}

// Expressions

// exec("cmd", args: [...])
export interface CallExpr extends Expr {
  kind: "CallExpr";
  caller: Expr; // Identifier (e.g. "exec") or MemberExpr
  // Flux allows: Expressions, Named Args (force: true), and Spreads (...arr)
  args: (Expr | NamedArgument | SpreadElement)[];
}

export interface MemberExpr extends Expr {
  kind: "MemberExpr";
  object: Expr; // "os"
  property: string; // "is_windows" (simplified as string for dot notation)
  computed: boolean; // true if accessed via [ ]
}

// DSL Specific Helpers

// force: true
export interface NamedArgument extends Expr {
  kind: "NamedArgument";
  name: string;
  value: Expr;
}

// ...sources
export interface SpreadElement extends Expr {
  kind: "SpreadElement";
  argument: Expr;
}

// The body of a 'tool' declaration
export interface PlatformMap extends Expr {
  kind: "PlatformMap";
  entries: PlatformEntry[];
}

// windows: "python.exe" OR [freebsd, x86]: "..."
export interface PlatformEntry {
  kind: "PlatformEntry";
  keys: string[]; // List of OS/Arch selectors
  value: Expr; // The command string
}

// Literals

export interface Identifier extends Expr {
  kind: "Identifier";
  symbol: string;
}

export interface NumericLiteral extends Expr {
  kind: "NumericLiteral";
  value: number;
}

export interface StringLiteral extends Expr {
  kind: "StringLiteral";
  value: string;
}

export interface BooleanLiteral extends Expr {
  kind: "BooleanLiteral";
  value: boolean;
}

// [ "-o", path(...) ]
export interface ArrayLiteral extends Expr {
  kind: "ArrayLiteral";
  elements: (Expr | SpreadElement)[];
}

// "${SRC_DIR}/**/*.cpp"
export interface TemplateLiteral extends Expr {
  kind: "TemplateLiteral";
  raw: string; // The full raw string
  expressions: Expr[]; // The interpolated variables
}
