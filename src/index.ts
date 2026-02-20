import { tokenize } from "./lexer.js";
import { Parser } from "./parser.js";
import { readFileSync } from "node:fs";

const src = readFileSync("protos/concept", "utf8");
const tokens = tokenize(src);
const parser = new Parser();
const ast = parser.produceAST(tokens);
console.dir(ast, { depth: null });
