# Contributing to Buildfile

First off, thank you for considering contributing to **Buildfile**! It's people like you that make the open-source community such an amazing place to learn, inspire, and create.

We welcome contributions of all sizes—from fixing typos in the documentation to adding new features to the DSL.

## 🛠️ Development Setup

To get started with the codebase, you'll need **Node.js** (v18+ recommended) and **npm**.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/dev-kas/buildfile.git
    cd buildfile
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    ```bash
    npm run build
    ```

4.  **Link for local development:**
    To test your changes against a real `Buildfile` anywhere on your system, use `npm link`:
    ```bash
    npm link
    ```
    Now, running `build` in your terminal will use your local compiled version of the code.

## 🗺️ Codebase Overview

Buildfile is a tree-walking interpreter. If you are new to language development, here is a quick map of the `src/` directory to help you find your way:

*   **`index.ts`**: The CLI entry point. It handles argument parsing (using `commander`) and initiates the engine.
*   **`lexer.ts`**: Takes raw text (source code) and breaks it into `Tokens` (like `Task`, `Identifier`, `String`).
*   **`parser.ts`**: Takes `Tokens` and builds an Abstract Syntax Tree (AST). If you want to change grammar syntax, look here.
*   **`ast.ts`**: TypeScript interfaces defining the structure of the AST nodes.
*   **`interpreter.ts`**: Walks the AST and executes logic. This is the "brain" of the runtime.
*   **`environment.ts`**: Manages scopes, variables, and **built-in functions** (like `exec`, `rm`, `path`).
*   **`values.ts`**: Defines the runtime values (the internal representation of strings, numbers, arrays, etc.).

### Common Tasks

**1. Adding a new built-in function (e.g., `cp` or `fetch`)**
You mostly just need to edit `src/environment.ts`. Look for `createGlobalEnv` and follow the pattern of existing functions like `rm` or `mkdir`.

**2. Adding a new keyword**
1.  Add the token to `TokenType` in `src/lexer.ts`.
2.  Add the node type to `src/ast.ts`.
3.  Update `src/parser.ts` to handle the new token.
4.  Update `src/interpreter.ts` to execute the new node.

## 🧪 Testing Your Changes

Currently, we test by running the tool against sample Buildfiles.

1.  Create a file named `Buildfile` in the root (or a `test/` folder).
2.  Run the dev script:
    ```bash
    # Compiles TS and runs the local index.js
    npm run dev -- [task_name]
    ```

## 📮 Pull Request Process

1.  **Fork** the repo and create your branch from `main`.
2.  If you've added code that should be tested, add a test case or ensure the `default` task in the example `Buildfile` passes.
3.  Ensure your code builds without errors (`npm run build`).
4.  Format your code. We try to stick to standard Prettier/ESLint configurations.
5.  Open a Pull Request!

## 🐛 Reporting Issues

If you find a bug or have a feature request, please open an issue. Include:
*   The OS you are running on (Windows, macOS, Linux).
*   The `Buildfile` script that caused the error.
*   The stack trace or error message output.

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License defined in the root directory of this project.
