import { SyntaxError } from "./errors.js";

export enum TokenType {
  // BASIC LANGUAGE TOKENS
  Number, // 0-9
  Identifier, // a-z A-Z 0-9 _ $
  Equals, // =
  BinaryOperator, // + - * /
  OParen, // (
  CParen, // )
  Let, // let
  Const, // const
  SemiColon, // ;
  Comma, // ,
  Colon, // :
  OBrace, // {
  CBrace, // }
  OBracket, // [
  CBracket, // ]
  Dot, // .
  ComparisonOperator, // < == > != >= <=
  String, // "..." '...'
  While, // while
  Else,
  EOF,

  // DSL SPECIFIC TOKENS
  Task,
  Depends,
  Tool,
  Import,
  Env,
  Plat,
  Arch,
}

const KEYWORDS: Record<string, TokenType> = {
  let: TokenType.Let,
  const: TokenType.Const,
  while: TokenType.While,
  task: TokenType.Task,
  depends: TokenType.Depends,
  tool: TokenType.Tool,
  import: TokenType.Import,
  env: TokenType.Env,
  plat: TokenType.Plat,
  arch: TokenType.Arch,
  else: TokenType.Else,
};

export interface Token {
  value: string;
  type: TokenType;
  line: number;
  col: number;
}

function isAlpha(code: number): boolean {
  // a-z (97-122) or A-Z (65-90)
  return (code >= 97 && code <= 122) || (code >= 65 && code <= 90);
}

function isDigit(code: number): boolean {
  // 0-9 (48-57)
  return code >= 48 && code <= 57;
}

function isAlphaNumeric(code: number): boolean {
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 65 && code <= 90) || // A-Z
    (code >= 48 && code <= 57) // 0-9
  );
}

function isSkippable(code: number): boolean {
  // Space, Tab, CR, or DEL
  return code === 32 || code === 9 || code === 13 || code === 127;
}

export function tokenize(src: string): Token[] {
  const tokens = new Array<Token>();
  const len = src.length;

  let cursor = 0;
  let currentLn = 1;
  let lineStart = 0;

  const push = (type: TokenType, value: string, startCursor: number) => {
    tokens.push({
      value,
      type,
      line: currentLn,
      col: startCursor - lineStart + 1,
    });
  };

  while (cursor < len) {
    const charCode = src.charCodeAt(cursor);

    // handle newlines
    if (charCode === 10) {
      // \n
      currentLn++;
      cursor++;
      lineStart = cursor;
      continue;
    }

    // skip whitespace (space, \r, \t)
    if (isSkippable(charCode)) {
      cursor++;
      continue;
    }

    const start = cursor; // mark start for column tracking

    // single character tokens
    switch (charCode) {
      case 40: // (
        push(TokenType.OParen, "(", start);
        cursor++;
        continue;
      case 41: // )
        push(TokenType.CParen, ")", start);
        cursor++;
        continue;
      case 123: // {
        push(TokenType.OBrace, "{", start);
        cursor++;
        continue;
      case 125: // }
        push(TokenType.CBrace, "}", start);
        cursor++;
        continue;
      case 91: // [
        push(TokenType.OBracket, "[", start);
        cursor++;
        continue;
      case 93: // ]
        push(TokenType.CBracket, "]", start);
        cursor++;
        continue;
      case 59: // ;
        push(TokenType.SemiColon, ";", start);
        cursor++;
        continue;
      case 44: // ,
        push(TokenType.Comma, ",", start);
        cursor++;
        continue;
      case 58: // :
        push(TokenType.Colon, ":", start);
        cursor++;
        continue;
      // math + - *
      case 43: // +
      case 45: // -
      case 42: // *
        push(TokenType.BinaryOperator, src[cursor], start);
        cursor++;
        continue;
    }

    // complex tokens (multichar logic)

    // forward slash = division or comment
    if (charCode === 47) {
      // /
      if (cursor + 1 < len && src.charCodeAt(cursor + 1) === 47) {
        // comment: skip until newline
        cursor += 2;
        while (cursor < len && src.charCodeAt(cursor) !== 10) {
          cursor++;
        }
      } else {
        push(TokenType.BinaryOperator, "/", start);
        cursor++;
      }
      continue;
    }

    // equals or equality
    if (charCode === 61) {
      // =
      if (cursor + 1 < len && src.charCodeAt(cursor + 1) === 61) {
        push(TokenType.ComparisonOperator, "==", start);
        cursor += 2;
      } else {
        push(TokenType.Equals, "=", start);
        cursor++;
      }
      continue;
    }

    // less than
    if (charCode === 60) {
      // <
      if (cursor + 1 < len && src.charCodeAt(cursor + 1) === 61) {
        push(TokenType.ComparisonOperator, "<=", start);
        cursor += 2;
      } else {
        push(TokenType.ComparisonOperator, "<", start);
        cursor++;
      }
      continue;
    }

    // greater than
    if (charCode === 62) {
      // >
      if (cursor + 1 < len && src.charCodeAt(cursor + 1) === 61) {
        push(TokenType.ComparisonOperator, ">=", start);
        cursor += 2;
      } else {
        push(TokenType.ComparisonOperator, ">", start);
        cursor++;
      }
      continue;
    }

    // bang / not equals
    if (charCode === 33) {
      // !
      if (cursor + 1 < len && src.charCodeAt(cursor + 1) === 61) {
        push(TokenType.ComparisonOperator, "!=", start);
        cursor += 2;
        continue;
      }
      // this condition should never be reached once i add unary operators (above this)
      throw new SyntaxError(
        `Unexpected character: !`,
        currentLn,
        start - lineStart + 1,
      );
    }

    // strings (" or ')
    if (charCode === 34 || charCode === 39) {
      const quoteChar = charCode;
      cursor++; // skip opening
      const stringStart = cursor;

      while (cursor < len && src.charCodeAt(cursor) !== quoteChar) {
        cursor++;
      }

      const value = src.slice(stringStart, cursor);
      push(TokenType.String, value, start);

      if (cursor < len) cursor++; // skip closing
      continue;
    }

    // numbers (0-9) and dots
    if (
      isDigit(charCode) ||
      (charCode === 46 &&
        cursor + 1 < len &&
        isDigit(src.charCodeAt(cursor + 1)))
    ) {
      // its a number (starting with digit or starting with .123)
      let hasDecimal = charCode === 46;
      cursor++; // consume first char

      while (cursor < len) {
        const c = src.charCodeAt(cursor);
        if (isDigit(c)) {
          cursor++;
        } else if (c === 46 && !hasDecimal) {
          hasDecimal = true;
          cursor++;
        } else {
          break;
        }
      }

      push(TokenType.Number, src.slice(start, cursor), start);
      continue;
    }

    // just a dot .
    if (charCode === 46) {
      push(TokenType.Dot, ".", start);
      cursor++;
      continue;
    }

    // identifiers
    if (isAlpha(charCode) || charCode === 95 || charCode === 36) {
      // _ or $
      while (cursor < len) {
        const c = src.charCodeAt(cursor);
        if (isAlphaNumeric(c) || c === 95 || c === 36) {
          cursor++;
        } else {
          break;
        }
      }

      const value = src.slice(start, cursor);
      const reserved = KEYWORDS[value];

      if (reserved !== undefined) {
        push(reserved, value, start);
      } else {
        push(TokenType.Identifier, value, start);
      }
      continue;
    }

    // error
    throw new SyntaxError(
      `Unexpected character: ${src[cursor]}`,
      currentLn,
      start - lineStart + 1,
    );
  }

  push(TokenType.EOF, "EOF", cursor);

  return tokens;
}
