# @dev-kas/buildfile Developer Guide for LLMs

This document defines the syntax, semantics, and standard library for the `@dev-kas/buildfile` DSL. Use this context to generate, debug, or explain `Buildfile` scripts. This document is specifically for LLMs and agents to understand and generate code compatibile with Buildfile.

## 1. Language Overview

**Buildfile** is a domain-specific language (DSL) for build automation, similar to Makefiles but with JavaScript-like syntax. It is **not** JavaScript; it is interpreted.

*   **File Name:** `Buildfile` (no extension).
*   **Execution:** Interpreted top-to-bottom.
*   **Scope:** Variables are function-scoped or global.

### Key Constraints (Do NOT use these)
*   ❌ Do not use `require()`, `import`, `module.exports`, or `process`.
*   ❌ Do not use `function`, `class`, or `if/else` (use `plat` blocks for OS logic).
*   ❌ Do not use `console.log` (use `echo`).
*   ❌ Do not use `try/catch`.

## 2. Syntax & Grammar

### Variables
*   **`const`**: Immutable global/local variable.
*   **`let`**: Mutable variable.
*   **`env`**: Sets an environment variable for the current process and child processes.

```javascript
const VERSION = "1.0.0"
let retries = 0
env NODE_ENV = "production"
```

### Strings
*   Double quotes `"..."` or single quotes `'...'`.
*   Template literals supported with `${VAR}` syntax.

```javascript
const SRC = "src"
const MAIN = "${SRC}/index.ts"
```

### Tasks
Tasks are units of execution. They can have dependencies.

```javascript
// Syntax: task [name] { ... }
task clean {
  rm("dist", force: true)
}

// Syntax: task [name] depends [dependency] { ... }
task build depends clean {
  echo("Building...")
}

// Syntax: task [name] depends ([dep1], [dep2]) { ... }
task all depends (clean, build) {
  echo("Done")
}
```

### Tools (Cross-Platform Binaries)
The `tool` keyword defines a callable executable mapped to specific platforms or architectures. This replaces `if (win32)` logic.

Supported keys: `windows`, `unix`, `any`.
Supported tuple keys: `[linux, arm64]`, `[darwin, x64]`.

```javascript
tool python {
  windows: "python.exe"
  unix:    "python3"
  [linux, arm64]: "python3-arm"
}

task run {
  // Usage: toolName(arg1, arg2, ...)
  python("main.py")
}
```

### Platform Blocks
Use `plat` (OS) or `arch` (CPU architecture) blocks for conditional logic.

```javascript
plat windows {
  echo("Windows specific setup")
} else {
  echo("Unix specific setup")
}

arch arm64 {
  echo("Configuring for ARM...")
}
```

## 3. Standard Library

These functions are available globally.

### File System

| Function | Signature | Description |
| :--- | :--- | :--- |
| `path` | `path(segments...)` | Joins path segments using OS separator. Returns String. |
| `glob` | `glob(pattern)` | Returns Array of absolute paths matching the glob pattern. |
| `rm` | `rm(path, force: bool)` | Removes a file or directory. Set `force: true` for recursive delete. |
| `mkdir` | `mkdir(path)` | Creates a directory recursively. |

### Execution & IO

| Function | Signature | Description |
| :--- | :--- | :--- |
| `echo` | `echo(msg...)` | Prints to stdout. |
| `warn` | `warn(msg...)` | Prints to stderr (yellow text). |
| `exec` | `exec(cmd, args..., opts?)` | Executes a command synchronously. Throws on non-zero exit code. |

### `exec` Usage
You can pass arguments positionally or via a named `args` array.

```javascript
// Positional
exec("git", "commit", "-m", "wip")

// Named 'args' (useful for array spreading)
const flags = ["--force", "--verbose"]
exec("npm", "install", args: flags)
```

## 4. Example: Complete Buildfile

Generate code following this structure:

```javascript
// Constants
const DIST = path("./dist")
const SRC = path("./src")

// Environment
env CI = "true"

// Tool definitions
tool compiler {
  windows: "tsc.cmd"
  any:     "tsc"
}

// Tasks
task clean {
  echo("Cleaning ${DIST}...")
  rm(DIST, force: true)
}

task build depends clean {
  mkdir(DIST)
  
  // Find all test files
  const tests = glob("${SRC}/**/*.test.ts")
  echo("Found tests:", tests)

  // Run compiler
  compiler() 
}

task start depends build {
  exec("node", path("${DIST}/index.js"))
}

task default depends start {
  echo("Build complete.")
}
```

## 5. Common Patterns

### Spreading Arrays
You can spread arrays into function calls using `...`.

```javascript
const flags = ["-rf", "/tmp"]
// Spread into array literal
const cmd = ["rm", ...flags]
// Spread into function call
exec("rm", ...flags)
```

### Named Arguments
Functions like `rm` and `exec` use named arguments. The syntax is `key: value`.

```javascript
// Correct
rm("folder", force: true)

// Incorrect
rm("folder", { force: true }) // Do not pass an object literal
```
