import { RuntimeError } from "./errors.js";
import {
  MK_BOOL,
  MK_NIL,
  MK_STRING,
  MK_ARRAY,
  MK_NATIVE_FN,
  RuntimeVal,
  ObjectVal,
  ArrayVal,
} from "./values.js";

// for global functions
import * as fs from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";
import { globSync } from "glob";
import chalk from "chalk";

export default class Environment {
  private parent?: Environment;
  private variables: Map<string, RuntimeVal>;
  private constants: Set<string>;

  private envVariables: Set<string>;

  constructor(parentENV?: Environment) {
    this.parent = parentENV;
    this.variables = new Map();
    this.constants = new Set();
    this.envVariables = new Set();
  }

  public declareVar(
    varname: string,
    value: RuntimeVal,
    isConst: boolean = false,
    isEnv: boolean = false,
  ): RuntimeVal {
    if (this.variables.has(varname)) {
      throw new RuntimeError(`Variable '${varname}' is already declared.`);
    }

    if (isEnv) {
      this.envVariables.add(varname);
      const sysEnv = process.env[varname];

      if (sysEnv !== undefined && sysEnv.trim() !== "") {
        value = MK_STRING(sysEnv);
      } else {
        if (
          value.type === "string" ||
          value.type === "number" ||
          value.type === "boolean"
        ) {
          process.env[varname] = String(value.value);
        }
      }
    }

    this.variables.set(varname, value);
    if (isConst) this.constants.add(varname);

    return value;
  }

  public assignVar(varname: string, value: RuntimeVal): RuntimeVal {
    const env = this.resolve(varname);

    if (env.constants.has(varname)) {
      throw new RuntimeError(`Cannot reassign constant '${varname}'.`);
    }

    env.variables.set(varname, value);

    if (env.envVariables.has(varname)) {
      if (
        value.type === "string" ||
        value.type === "number" ||
        value.type === "boolean"
      ) {
        process.env[varname] = String(value.value);
      }
    }

    return value;
  }

  public resolve(varname: string): Environment {
    if (this.variables.has(varname)) return this;

    if (!this.parent) {
      throw new RuntimeError(`Cannot resolve undefined variable '${varname}'.`);
    }

    return this.parent.resolve(varname);
  }

  public lookupVar(varname: string): RuntimeVal {
    const env = this.resolve(varname);
    return env.variables.get(varname) as RuntimeVal;
  }
}

function getNamedArgs(args: RuntimeVal[]): Map<string, RuntimeVal> | null {
  if (args.length > 0 && args[args.length - 1].type === "object") {
    return (args[args.length - 1] as ObjectVal).properties;
  }
  return null;
}

export function createGlobalEnv(cwd: string): Environment {
  const env = new Environment();

  env.declareVar("true", MK_BOOL(true), true);
  env.declareVar("false", MK_BOOL(false), true);
  env.declareVar("nil", MK_NIL(), true);
  env.declareVar("cwd", MK_STRING(cwd), true);

  env.declareVar(
    "echo",
    MK_NATIVE_FN((args) => {
      const mapped = args
        .filter((a) => a.type !== "object")
        .map((a) => a.value);
      console.log(...mapped);
      return MK_NIL();
    }),
    true,
  );

  env.declareVar(
    "warn",
    MK_NATIVE_FN((args) => {
      const useColor = process.stderr.isTTY;

      const mapped = args
        .filter((a) => a.type !== "object")
        .map((a) => a.value);

      console.error(...mapped.map((v) => (useColor ? chalk.yellow(v) : v)));

      return MK_NIL();
    }),
    true,
  );

  env.declareVar(
    "path",
    MK_NATIVE_FN((args) => {
      const segments = args
        .filter((a) => a.type !== "object")
        .map((a) => String(a.value));
      return MK_STRING(path.resolve(cwd, ...segments));
    }),
    true,
  );

  env.declareVar(
    "mkdir",
    MK_NATIVE_FN((args) => {
      const dir = path.resolve(cwd, String(args[0]?.value));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return MK_NIL();
    }),
    true,
  );

  env.declareVar(
    "rm",
    MK_NATIVE_FN((args) => {
      const target = path.resolve(cwd, String(args[0]?.value));
      const named = getNamedArgs(args);
      const force = named?.get("force")?.value === true;

      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: force, force });
      }

      return MK_NIL();
    }),
    true,
  );

  env.declareVar(
    "glob",
    MK_NATIVE_FN((args) => {
      const pattern = String(args[0]?.value);
      const matches = globSync(pattern, { cwd, windowsPathsNoEscape: true });
      return MK_ARRAY(
        matches.map((m: string) => MK_STRING(path.resolve(cwd, m))),
      );
    }),
    true,
  );

  env.declareVar(
    "exec",
    MK_NATIVE_FN((args) => {
      const cmd = String(args[0]?.value);

      const positionalArgs = args
        .slice(1)
        .filter((a) => a.type !== "object")
        .map((a) => String(a.value));

      const named = getNamedArgs(args);
      let namedArgsList: string[] = [];
      const argsVal = named?.get("args");
      if (argsVal && argsVal.type === "array") {
        namedArgsList = (argsVal as ArrayVal).elements.map((e) =>
          String(e.value),
        );
      }

      const cmdArgs = [...positionalArgs, ...namedArgsList];

      const result = cp.spawnSync(cmd, cmdArgs, {
        stdio: "inherit",
        shell: false,
        cwd,
      });

      if (result.error) {
        throw new RuntimeError(
          `Failed to execute '${cmd}': ${result.error.message}`,
        );
      }
      if (result.status !== 0) {
        throw new RuntimeError(
          `Command '${cmd}' failed with exit code ${result.status}`,
        );
      }

      return MK_NIL();
    }),
    true,
  );

  return env;
}
