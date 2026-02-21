#!/usr/bin/env node
import { Command } from "commander";
import { existsSync, readFileSync, statSync } from "node:fs";
import { tokenize } from "./lexer.js";
import { Parser } from "./parser.js";
import { createGlobalEnv } from "./environment.js";
import { Engine } from "./interpreter.js";
import { findPackageJSON } from "node:module";
import * as path from "node:path";
import chalk from "chalk";

import {
  RuntimeError,
  SyntaxError as BuildSyntaxError,
  EngineError,
} from "./errors.js";

let programData = null;

try {
  const packagePath = findPackageJSON(import.meta.url);
  if (!packagePath) throw new Error("Can't locate package.json");
  programData = JSON.parse(readFileSync(packagePath, "utf8"));
} catch (e) {
  handleFatal(e);
}

const program = new Command();

program
  .name(programData.name)
  .description(programData.description)
  .version(programData.version)
  .argument("[task]", "The task to run", "default")
  .option("-f, --file <path>", "Path to the Buildfile")
  .action((task, options) => {
    let targetFile: string;
    if (options.file) {
      targetFile = path.resolve(process.cwd(), options.file);
      if (!existsSync(targetFile) || !statSync(targetFile).isFile()) {
        console.error(
          chalk.red.bold("Error:") +
            " " +
            chalk.white(`No ${options.file} found at ${targetFile}.`),
        );
        process.exit(1);
      }
    } else {
      const foundPath = getNearestBuildfile(process.cwd());
      if (!foundPath) {
        console.error(
          chalk.red.bold("Error:") +
            " " +
            chalk.white(
              `No Buildfile found in ${process.cwd()} or any parent directories.`,
            ),
        );
        process.exit(1);
      }
      targetFile = foundPath;
    }

    try {
      const src = readFileSync(targetFile, "utf8");
      const targetDir = path.dirname(targetFile);

      // parse
      const tokens = tokenize(src);
      const parser = new Parser();
      const ast = parser.produceAST(tokens);

      // engine setup
      const env = createGlobalEnv(targetDir);
      const engine = new Engine(env);

      // load and run
      engine.load(ast);
      engine.run(task);
    } catch (e) {
      handleFatal(e);
    }
  });

function handleFatal(err: unknown): never {
  const useColor = process.stderr.isTTY;

  const red = useColor ? chalk.red : (s: string) => s;
  const boldRed = useColor ? chalk.red.bold : (s: string) => s;
  const boldYellow = useColor ? chalk.yellow.bold : (s: string) => s;
  const engineTag = useColor
    ? chalk.bgRed.white.bold(" ENGINE ERROR ")
    : "ENGINE ERROR";

  if (err instanceof EngineError) {
    console.error(engineTag + "\n" + red(err.stack || err.message));
  } else if (err instanceof RuntimeError) {
    console.error(boldRed("Runtime Error:") + " " + err.message);
  } else if (err instanceof BuildSyntaxError) {
    console.error(boldYellow("Syntax Error:") + " " + err.message);
  } else if (err instanceof Error) {
    console.error(boldRed("Error:") + " " + err.message);
  } else {
    console.error(boldRed("Unknown fatal error:") + " " + String(err));
  }

  process.exit(1);
}

function getNearestBuildfile(startDir: string): string | null {
  let cwd = path.resolve(startDir);
  while (true) {
    const targetPath = path.join(cwd, "Buildfile");
    if (existsSync(targetPath) && statSync(targetPath).isFile())
      return targetPath;

    const parent = path.dirname(cwd);
    if (parent === cwd) break;
    cwd = parent;
  }
  return null;
}

program.parse(process.argv);
