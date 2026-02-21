import * as ast from "./ast.js";
import { SyntaxError, EngineError } from "./errors.js";
import { Token, TokenType } from "./lexer.js";

export class Parser {
  private pos: number = 0;
  private tokens: Token[] = [];

  // helper functions
  private at(): Token {
    return this.tokens[this.pos];
  }

  private peek(): Token {
    return this.tokens[this.pos + 1];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(expected: TokenType): Token {
    const prev = this.advance();
    if (!prev || prev.type !== expected) {
      throw new SyntaxError(
        `Expected ${TokenType[expected]}, got ${TokenType[prev.type]}`,
        prev.line,
        prev.col,
      );
    }
    return prev;
  }

  private isEOF(): boolean {
    return this.at().type === TokenType.EOF;
  }

  public produceAST(tokens: Token[]): ast.Program {
    this.pos = 0;
    this.tokens = tokens;

    const program: ast.Program = {
      kind: "Program",
      body: [],
    };

    while (!this.isEOF()) {
      switch (this.at().type) {
        case TokenType.Let:
        case TokenType.Const:
        case TokenType.Env:
          program.body.push(this.parseVarDecl());
          break;
        case TokenType.Tool:
          program.body.push(this.parseToolDecl());
          break;
        case TokenType.Task:
          program.body.push(this.parseTaskDecl());
          break;
        default:
          const tk = this.at();
          throw new SyntaxError(
            `Unexpected token '${tk.value}'.`,
            tk.line,
            tk.col,
          );
      }
    }

    return program;
  }

  private parseStmt(): ast.Stmt {
    switch (this.at().type) {
      case TokenType.Let:
      case TokenType.Const:
      case TokenType.Env:
        return this.parseVarDecl();
      case TokenType.Plat:
      case TokenType.Arch:
        return this.parsePlatformBlock();
      default:
        return this.parseExpr();
    }
  }

  private parseTaskDecl(): ast.Stmt {
    this.expect(TokenType.Task);

    const nameToken = this.expect(TokenType.Identifier);
    const taskName = nameToken.value;

    const dependencies: string[] = [];

    // optional: depends ...
    if (this.at().type === TokenType.Depends) {
      this.advance(); // consume 'depends'

      if (this.at().type === TokenType.OParen) {
        // depends (a, b, c)
        this.advance(); // consume '('

        dependencies.push(this.expect(TokenType.Identifier).value);

        while (this.at().type === TokenType.Comma) {
          this.advance(); // consume ','
          dependencies.push(this.expect(TokenType.Identifier).value);
        }

        this.expect(TokenType.CParen);
      } else {
        // depends xyz
        dependencies.push(this.expect(TokenType.Identifier).value);
      }
    }

    const seen = new Set<string>();

    for (const dep of dependencies) {
      if (dep === taskName) {
        throw new SyntaxError(
          `Task '${taskName}' cannot depend on itself`,
          nameToken.line,
          nameToken.col,
        );
      }

      if (seen.has(dep)) {
        throw new SyntaxError(
          `Duplicate dependency '${dep}' in task '${taskName}'`,
          nameToken.line,
          nameToken.col,
        );
      }

      seen.add(dep);
    }

    this.expect(TokenType.OBrace);

    const body: ast.Stmt[] = [];

    while (!this.isEOF() && this.at().type !== TokenType.CBrace) {
      body.push(this.parseStmt());
    }

    this.expect(TokenType.CBrace);

    return {
      kind: "TaskDeclaration",
      symbol: taskName,
      dependencies,
      body,
    } as ast.TaskDeclaration;
  }

  private parseToolDecl(): ast.Stmt {
    // tool name {
    //   platform: value
    //   [platform, arch]: value
    // }

    this.expect(TokenType.Tool);

    const toolName = this.expect(TokenType.Identifier);
    this.expect(TokenType.OBrace);

    const options: {
      platform: string;
      arch: string | null;
      expr: ast.Expr;
    }[] = [];

    while (!this.isEOF() && this.at().type !== TokenType.CBrace) {
      let platform: string;
      let arch: string | null = null;

      if (this.at().type === TokenType.Identifier) {
        // linux: ...
        platform = this.advance().value;
      } else if (this.at().type === TokenType.OBracket) {
        // [linux, arm64]: ...
        this.advance(); // [

        platform = this.expect(TokenType.Identifier).value;
        this.expect(TokenType.Comma);
        arch = this.expect(TokenType.Identifier).value;

        this.expect(TokenType.CBracket);
      } else {
        const tk = this.at();
        throw new SyntaxError(
          "Expected platform identifier or [platform, arch] tuple",
          tk.line,
          tk.col,
        );
      }

      this.expect(TokenType.Colon);
      const expr = this.parseExpr();

      options.push({ platform, arch, expr });
    }

    this.expect(TokenType.CBrace);

    return {
      kind: "ToolDeclaration",
      symbol: toolName.value,
      options,
    } as ast.ToolDeclaration;
  }

  private parseVarDecl(): ast.Stmt {
    // let myVar = "value"
    // const myNum = 123
    // env PORT = 5500
    // const env PORT = 5500
    const prefix = this.advance();

    const constant = prefix.type === TokenType.Const;
    let isEnv = prefix.type === TokenType.Env;

    // const env PORT = ...
    if (constant && this.at().type === TokenType.Env) {
      this.advance(); // consume 'env'
      isEnv = true;
    }

    const identifierToken = this.expect(TokenType.Identifier);
    const identifier = identifierToken.value;

    this.expect(TokenType.Equals);

    const value: ast.Expr = this.parseExpr();

    return {
      kind: "VarDeclaration",
      isConst: constant,
      isEnv,
      identifier,
      value,
    } as ast.VarDeclaration;
  }

  private parseExpr(): ast.Expr {
    return this.parseAssignmentExpr();
  }

  private parseAssignmentExpr(): ast.Expr {
    const assignee = this.parseAdditiveExpr();

    if (this.at().type === TokenType.Equals) {
      this.advance();
      const value = this.parseAssignmentExpr();
      return {
        value,
        assignee,
        kind: "AssignmentExpr",
      } as ast.AssignmentExpr;
    }

    return assignee;
  }

  private parseAdditiveExpr(): ast.Expr {
    let lhs = this.parseMultiplicativeExpr();

    while (this.at().value === "+" || this.at().value === "-") {
      const operator = this.advance().value;
      const rhs = this.parseMultiplicativeExpr();

      lhs = {
        kind: "BinaryExpr",
        left: lhs,
        right: rhs,
        operator,
      } as ast.BinaryExpr;
    }
    return lhs;
  }

  private parseMultiplicativeExpr(): ast.Expr {
    let left = this.parseCallExpr();

    while (
      this.at().value === "*" ||
      this.at().value === "/" ||
      this.at().value === "%"
    ) {
      const operator = this.advance().value;
      const right = this.parseCallExpr();

      left = {
        kind: "BinaryExpr",
        left,
        right,
        operator,
      } as ast.BinaryExpr;
    }
    return left;
  }

  private parseCallExpr(): ast.Expr {
    let expr = this.parsePrimaryExpr();

    while (this.at().type === TokenType.OParen) {
      this.advance();

      const args: ast.Expr[] = [];

      if (this.at().type !== TokenType.CParen) {
        args.push(this.parseCallArgument());

        while (this.at().type === TokenType.Comma) {
          this.advance();
          args.push(this.parseCallArgument());
        }
      }

      this.expect(TokenType.CParen);

      expr = {
        kind: "CallExpr",
        callee: expr,
        args,
      } as ast.CallExpr;
    }

    return expr;
  }

  private parseCallArgument(): ast.Expr {
    // spread
    if (
      this.at().type === TokenType.Dot &&
      this.peek().type === TokenType.Dot
    ) {
      for (let i = 3; i--; this.expect(TokenType.Dot)) {} // consume ...
      const arg = this.parseExpr();
      return {
        kind: "SpreadElement",
        argument: arg,
      } as ast.SpreadElement;
    }

    // named argument
    if (
      this.at().type === TokenType.Identifier &&
      this.peek().type === TokenType.Colon
    ) {
      const name = this.advance().value;
      this.advance(); // ':'
      const value = this.parseExpr();

      return {
        kind: "NamedArg",
        name,
        value,
      } as ast.NamedArg;
    }

    // positional
    return this.parseExpr();
  }

  private parsePlatformBlock(): ast.Stmt {
    const token = this.advance(); // plat or arch
    const type = token.type === TokenType.Plat ? "plat" : "arch";

    const nameToken = this.expect(TokenType.Identifier);
    const symbol = nameToken.value;

    this.expect(TokenType.OBrace);

    const body: ast.Stmt[] = [];
    while (!this.isEOF() && this.at().type !== TokenType.CBrace) {
      body.push(this.parseStmt());
    }

    this.expect(TokenType.CBrace);

    let elseBody: ast.Stmt[] | undefined;

    // optional else {...}
    if (this.at().type === TokenType.Else) {
      this.advance(); // else
      this.expect(TokenType.OBrace);

      elseBody = [];
      while (!this.isEOF() && this.at().type !== TokenType.CBrace) {
        elseBody.push(this.parseStmt());
      }

      this.expect(TokenType.CBrace);
    }

    return {
      kind: "PlatformBlock",
      type,
      symbol,
      body,
      elseBody,
    } as ast.PlatformBlock;
  }

  private parseArrayElement(): ast.Expr {
    if (
      this.at().type === TokenType.Dot &&
      this.peek().type === TokenType.Dot
    ) {
      for (let i = 3; i--; this.expect(TokenType.Dot)) {} // consume ...
      const arg = this.parseExpr();
      return {
        kind: "SpreadElement",
        argument: arg,
      } as ast.SpreadElement;
    }
    return this.parseExpr();
  }

  private parsePrimaryExpr(): ast.Expr {
    const type = this.at().type;
    let value;
    switch (type) {
      case TokenType.Identifier:
        return {
          kind: "Identifier",
          symbol: this.advance().value,
        } as ast.Identifier;
      case TokenType.Number:
        return {
          kind: "NumericLiteral",
          value: parseFloat(this.advance().value),
        } as ast.NumericLiteral;
      case TokenType.OParen:
        this.advance();
        value = this.parseExpr();
        this.expect(TokenType.CParen);
        return value;
      case TokenType.String:
        return {
          kind: "StringLiteral",
          value: this.advance().value,
        } as ast.StringLiteral;
      case TokenType.OBracket: {
        // for arrays
        this.advance(); // [
        const elems: ast.Expr[] = [];
        if (this.at().type !== TokenType.CBracket) {
          elems.push(this.parseArrayElement());
          while (this.at().type === TokenType.Comma) {
            this.advance();
            elems.push(this.parseArrayElement());
          }
        }

        this.expect(TokenType.CBracket); // ]
        return {
          kind: "ArrayLiteral",
          elements: elems,
        } as ast.ArrayLiteral;
      }
      default:
        const tk = this.at();
        throw new SyntaxError(
          `Unexpected token '${tk.value}'. Expected a primary expression.`,
          tk.line,
          tk.col,
        );
    }
  }
}
