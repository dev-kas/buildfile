import * as ast from "./ast.js";
import Environment from "./environment.js";
import { RuntimeError, EngineError } from "./errors.js";
import {
  RuntimeVal,
  MK_NIL,
  MK_NUMBER,
  MK_STRING,
  MK_BOOL,
  MK_ARRAY,
  MK_OBJECT,
  MK_TASK,
  MK_TOOL,
  TaskVal,
  ToolVal,
  NativeFnValue,
} from "./values.js";
import * as os from "node:os";

export class Engine {
  public env: Environment;
  private completedTasks: Set<string>;
  private visitingTasks: Set<string>;

  constructor(env: Environment) {
    this.env = env;
    this.completedTasks = new Set();
    this.visitingTasks = new Set();
  }

  public load(program: ast.Program) {
    for (const stmt of program.body) {
      evaluate(stmt, this.env);
    }
  }

  public run(taskName: string) {
    if (this.completedTasks.has(taskName)) return;

    if (this.visitingTasks.has(taskName)) {
      throw new RuntimeError(
        `Circular dependency detected involving task '${taskName}'`,
      );
    }

    this.visitingTasks.add(taskName);

    const taskVal = this.env.lookupVar(taskName);
    if (!taskVal || taskVal.type !== "task") {
      throw new RuntimeError(`Task '${taskName}' is not defined.`);
    }

    const task = taskVal as TaskVal;

    for (const dep of task.dependencies) {
      this.run(dep);
    }

    console.log(`\n> Running task: ${taskName}`);

    const taskScope = new Environment(this.env);
    for (const stmt of task.body) {
      evaluate(stmt, taskScope);
    }

    this.visitingTasks.delete(taskName);
    this.completedTasks.add(taskName);
  }
}

function evalStringLiteral(
  node: ast.StringLiteral,
  env: Environment,
): RuntimeVal {
  let str = node.value;

  // interpolate ${VAR_NAME}
  str = str.replace(/\$\{([a-zA-Z0-9_$]+)\}/g, (match, varName) => {
    try {
      const val = env.lookupVar(varName);
      return String(val.value);
    } catch {
      throw new RuntimeError(
        `Cannot resolve undefined variable '${varName}' in template string.`,
      );
    }
  });

  return MK_STRING(str);
}

export function evaluate(astNode: ast.Stmt, env: Environment): RuntimeVal {
  switch (astNode.kind) {
    // primitives
    case "NumericLiteral":
      return MK_NUMBER((astNode as ast.NumericLiteral).value);
    case "StringLiteral":
      return evalStringLiteral(astNode as ast.StringLiteral, env);
    case "BooleanLiteral":
      return MK_BOOL((astNode as ast.BooleanLiteral).value);
    case "Identifier":
      return evalIdentifier(astNode as ast.Identifier, env);
    case "TemplateLiteral":
      return evalTemplateLiteral(astNode as ast.TemplateLiteral, env);
    case "ArrayLiteral":
      return evalArrayLiteral(astNode as ast.ArrayLiteral, env);

    // expressions
    case "AssignmentExpr":
      return evalAssignment(astNode as ast.AssignmentExpr, env);
    case "BinaryExpr":
      return evalBinaryExpr(astNode as ast.BinaryExpr, env);
    case "CallExpr":
      return evalCallExpr(astNode as ast.CallExpr, env);

    // declarations & statements
    case "VarDeclaration":
      return evalVarDecl(astNode as ast.VarDeclaration, env);
    case "TaskDeclaration":
      return evalTaskDecl(astNode as ast.TaskDeclaration, env);
    case "ToolDeclaration":
      return evalToolDecl(astNode as ast.ToolDeclaration, env);
    case "PlatformBlock":
      return evalPlatformBlock(astNode as ast.PlatformBlock, env);
    case "Program":
      for (const stmt of (astNode as ast.Program).body) evaluate(stmt, env);
      return MK_NIL();

    default:
      throw new EngineError(`Unimplemented AST node kind: ${astNode.kind}`);
  }
}

function evalIdentifier(id: ast.Identifier, env: Environment): RuntimeVal {
  const val = env.lookupVar(id.symbol);
  if (!val)
    throw new RuntimeError(`Cannot resolve undefined variable '${id.symbol}'.`);
  return val;
}

function evalTemplateLiteral(
  node: ast.TemplateLiteral,
  env: Environment,
): RuntimeVal {
  let result = "";
  for (let i = 0; i < node.variables.length; i++) {
    result += node.segments[i];
    const val = env.lookupVar(node.variables[i]);
    result += String(val.value);
  }
  result += node.segments[node.segments.length - 1];
  return MK_STRING(result);
}

function evalArrayLiteral(
  node: ast.ArrayLiteral,
  env: Environment,
): RuntimeVal {
  const elements: RuntimeVal[] = [];

  for (const el of node.elements) {
    if (el.kind === "SpreadElement") {
      const spreadVal = evaluate((el as ast.SpreadElement).argument, env);
      if (spreadVal.type !== "array") {
        throw new RuntimeError("Cannot spread a non-array value.");
      }
      elements.push(...(spreadVal as any).elements);
    } else {
      elements.push(evaluate(el, env));
    }
  }

  return MK_ARRAY(elements);
}

function evalAssignment(
  node: ast.AssignmentExpr,
  env: Environment,
): RuntimeVal {
  if (node.assignee.kind !== "Identifier") {
    throw new RuntimeError("Invalid assignment target. Must be an identifier.");
  }
  const varname = (node.assignee as ast.Identifier).symbol;
  return env.assignVar(varname, evaluate(node.value, env));
}

function evalBinaryExpr(node: ast.BinaryExpr, env: Environment): RuntimeVal {
  const lhs = evaluate(node.left, env);
  const rhs = evaluate(node.right, env);

  // math
  if (lhs.type === "number" && rhs.type === "number") {
    switch (node.operator) {
      case "+":
        return MK_NUMBER(lhs.value + rhs.value);
      case "-":
        return MK_NUMBER(lhs.value - rhs.value);
      case "*":
        return MK_NUMBER(lhs.value * rhs.value);
      case "/":
        return MK_NUMBER(lhs.value / rhs.value);
      case "%":
        return MK_NUMBER(lhs.value % rhs.value);
    }
  }

  // str concat
  if (node.operator === "+") {
    return MK_STRING(String(lhs.value) + String(rhs.value));
  }

  throw new RuntimeError(
    `Unsupported binary operation: ${lhs.type} ${node.operator} ${rhs.type}`,
  );
}

function evalCallExpr(node: ast.CallExpr, env: Environment): RuntimeVal {
  const callee = evaluate(node.callee, env);

  const args: RuntimeVal[] = [];
  const namedArgs: Record<string, RuntimeVal> = {};
  let hasNamedArgs = false;

  for (const arg of node.args) {
    if (arg.kind === "SpreadElement") {
      const spreadVal = evaluate((arg as ast.SpreadElement).argument, env);
      if (spreadVal.type === "array") {
        args.push(...(spreadVal as any).elements);
      } else {
        throw new RuntimeError(
          "Cannot spread a non-array value into function arguments.",
        );
      }
    } else if (arg.kind === "NamedArg") {
      const named = arg as ast.NamedArg;
      namedArgs[named.name] = evaluate(named.value, env);
      hasNamedArgs = true;
    } else {
      args.push(evaluate(arg, env));
    }
  }

  if (hasNamedArgs) {
    args.push(MK_OBJECT(namedArgs));
  }

  if (callee.type === "native-fn") {
    const fn = callee as NativeFnValue;
    return fn.call(args, env);
  }

  if (callee.type === "tool") {
    const tool = callee as ToolVal;
    const resolvedPath = resolveToolPath(tool, env);

    const execFn = env.lookupVar("exec") as NativeFnValue;
    return execFn.call([MK_STRING(resolvedPath), ...args], env);
  }

  throw new RuntimeError(`Cannot call value of type '${callee.type}'.`);
}

function evalVarDecl(node: ast.VarDeclaration, env: Environment): RuntimeVal {
  const value = evaluate(node.value, env);
  return env.declareVar(node.identifier, value, node.isConst, node.isEnv);
}

function evalTaskDecl(node: ast.TaskDeclaration, env: Environment): RuntimeVal {
  const task = MK_TASK(node.symbol, node.dependencies, node.body);
  return env.declareVar(node.symbol, task, true);
}

function evalToolDecl(node: ast.ToolDeclaration, env: Environment): RuntimeVal {
  const tool = MK_TOOL(node.symbol, node.options);
  return env.declareVar(node.symbol, tool, true);
}

function evalPlatformBlock(
  node: ast.PlatformBlock,
  env: Environment,
): RuntimeVal {
  const plat = os.platform() === "win32" ? "windows" : os.platform();
  const arch = os.arch();

  let isMatch = false;

  if (node.type === "plat") {
    isMatch =
      node.symbol === plat || (node.symbol === "unix" && plat !== "windows");
  } else if (node.type === "arch") {
    isMatch = node.symbol === arch;
  }

  const targetBody = isMatch ? node.body : node.elseBody || [];

  for (const stmt of targetBody) {
    evaluate(stmt, env);
  }

  return MK_NIL();
}

function resolveToolPath(tool: ToolVal, env: Environment): string {
  const plat = os.platform() === "win32" ? "windows" : os.platform();
  const arch = os.arch();

  let bestMatch: any = null;
  let bestScore = -1;

  for (const opt of tool.options) {
    let score = 0;

    if (opt.platform === plat && opt.arch === arch) score = 3;
    else if (opt.platform === plat && !opt.arch) score = 2;
    else if (opt.platform === "any" && opt.arch === arch) score = 2;
    else if (opt.platform === "any" && !opt.arch) score = 1;
    else if (opt.platform === "unix" && plat !== "windows") {
      score = opt.arch === arch ? 2.5 : 1.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = opt;
    }
  }

  if (!bestMatch) {
    throw new RuntimeError(
      `No matching platform found for tool '${tool.name}' on ${plat}-${arch}`,
    );
  }

  const resolvedVal = evaluate(bestMatch.expr, env);
  return String(resolvedVal.value);
}
