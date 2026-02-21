import { Expr } from "./ast.js";
import Environment from "./environment.js";

export type ValueType =
  | "nil"
  | "number"
  | "boolean"
  | "string"
  | "array"
  | "object"
  | "native-fn"
  | "task"
  | "tool";

export interface RuntimeVal {
  type: ValueType;
  value: any;
}

// primitives

export interface NilVal extends RuntimeVal {
  type: "nil";
  value: null;
}

export function MK_NIL(): NilVal {
  return { type: "nil", value: null };
}

export interface BooleanVal extends RuntimeVal {
  type: "boolean";
  value: boolean;
}

export function MK_BOOL(b = false): BooleanVal {
  return { type: "boolean", value: b };
}

export interface NumberVal extends RuntimeVal {
  type: "number";
  value: number;
}

export function MK_NUMBER(n = 0): NumberVal {
  return { type: "number", value: n };
}

export interface StringVal extends RuntimeVal {
  type: "string";
  value: string;
}

export function MK_STRING(str = ""): StringVal {
  return { type: "string", value: str };
}

// data structures

export interface ArrayVal extends RuntimeVal {
  type: "array";
  elements: RuntimeVal[];
}

export function MK_ARRAY(elements: RuntimeVal[] = []): ArrayVal {
  return { type: "array", value: elements, elements };
}

export interface ObjectVal extends RuntimeVal {
  type: "object";
  properties: Map<string, RuntimeVal>;
}

export function MK_OBJECT(obj: Record<string, RuntimeVal> = {}): ObjectVal {
  const properties = new Map<string, RuntimeVal>();
  for (const [key, value] of Object.entries(obj)) {
    properties.set(key, value);
  }
  return { type: "object", value: properties, properties };
}

// executables & dsl primitives

export type FunctionCall = (args: RuntimeVal[], env: Environment) => RuntimeVal;

export interface NativeFnValue extends RuntimeVal {
  type: "native-fn";
  call: FunctionCall;
}

export function MK_NATIVE_FN(call: FunctionCall): NativeFnValue {
  return {
    type: "native-fn",
    value: null,
    call,
  };
}

export interface TaskVal extends RuntimeVal {
  type: "task";
  name: string;
  dependencies: string[];
  body: Expr[];
}

export function MK_TASK(
  name: string,
  dependencies: string[],
  body: Expr[],
): TaskVal {
  return {
    type: "task",
    value: name, // makes debugging easier by identifying the task
    name,
    dependencies,
    body,
  };
}

export interface ToolVal extends RuntimeVal {
  type: "tool";
  name: string;
  options: {
    platform: string | null;
    arch: string | null;
    expr: Expr;
  }[];
}

export function MK_TOOL(
  name: string,
  options: { platform: string | null; arch: string | null; expr: Expr }[],
): ToolVal {
  return {
    type: "tool",
    value: name,
    name,
    options,
  };
}
