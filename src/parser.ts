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

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(expected: TokenType, msg?: string): Token {
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
      program.body.push(this.parseStmt());
    }

    return program;
  }

  private parseStmt(): ast.Stmt {
    switch (this.at().type) {
      case TokenType.Let:
      case TokenType.Const:
      case TokenType.Env:
        return this.parseVarDecl();
      default:
        return this.parseExpr();
    }
  }

  private parseVarDecl(): ast.Stmt {
    // let myVar = "value"
    // const myNum = 123
    // env PORT = 5500
    // const env PORT = 5500

    const prefix = this.advance();

    const constant = prefix.type === TokenType.Const;
    let isEnv = prefix.type === TokenType.Env;
    let identifier = null;

    if (constant) {
      let next = this.advance();
      // next could be either an identifier or env
      if (next.type === TokenType.Env) isEnv = true;
      else {
        identifier = next;
      }
    } else {
      identifier = this.expect(TokenType.Identifier).value;
    }

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
    let left = this.parsePrimaryExpr();

    while (
      this.at().value === "*" ||
      this.at().value === "/" ||
      this.at().value === "%"
    ) {
      const operator = this.advance().value;
      const right = this.parsePrimaryExpr();

      left = {
        kind: "BinaryExpr",
        left,
        right,
        operator,
      } as ast.BinaryExpr;
    }
    return left;
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
