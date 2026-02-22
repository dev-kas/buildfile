# Buildfile

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

**Buildfile** is a lightweight, cross-platform build automation tool designed to replace `Makefile`s in JavaScript/TypeScript projects (and beyond). 

It features a simple, readable DSL (Domain Specific Language) that handles cross-platform path resolution, environment variables, and binary execution automatically. No more writing `rm -rf` for Unix and `del` for Windows.

## 📦 Installation

### Global Installation
Install it globally to use the `build` command anywhere:
```bash
npm i -g @dev-kas/buildfile
```

### Run via npx
Alternatively, run it without installation:
```bash
npx @dev-kas/buildfile [task]
```

---

## 🚀 Quick Start

Create a file named `Buildfile` in the root of your project:

```javascript
// Buildfile
const DIST = path("./dist")
const SRC  = path("./src")

// Automatically handles platform differences (node.exe vs node)
tool node {
    windows: "node.exe"
    any:     "node"
}

task clean {
    echo("Cleaning build artifacts...")
    rm(DIST, force: true)
}

task build depends clean {
    echo("Building project...")
    // "tsc" is strictly interpreted as a command here
    exec("tsc") 
}

task start depends build {
    // Uses the 'node' tool defined above
    node(path("${DIST}/index.js"))
}

task default depends start {
    echo("Done!")
}
```

Run a task:
```bash
build start
# or simply 'build' to run the 'default' task
```

---

## 📚 Language Reference

The `Buildfile` language is designed to look like a mix of JavaScript and a shell script.

### Variables

*   **`const`**: Immutable variables.
*   **`let`**: Mutable variables.
*   **`env`**: Sets a process environment variable.

```javascript
const VERSION = "1.0.0"
let retries = 3

// Sets process.env.PORT, accessible by child processes
env PORT = 8080 
```

### Tasks

Tasks are the core building blocks. They can depend on other tasks, ensuring they run in the correct order.

```javascript
// Basic task
task setup {
    mkdir("dist")
}

// Task with dependency (runs 'setup' first)
task build depends setup {
    echo("Building...")
}

// Task with multiple dependencies
task deploy depends (build, test) {
    echo("Deploying...")
}
```

### Tools (Cross-Platform Binaries)

The `tool` keyword solves the "it works on my machine" problem. You define a tool once, and map it to different binaries based on the OS or Architecture.

```javascript
tool python {
    windows: "py.exe"
    unix:    "python3"
    // Specific architecture support
    [linux, arm64]: "python3-arm" 
}

task run-script {
    // You can now call 'python' like a function
    python("script.py")
}
```

When you call `python(...)`, `Buildfile` checks your OS and executes the correct binary.

### Platform Blocks

If you need specific logic for a platform that isn't just swapping a binary, use `plat` or `arch` blocks.

```javascript
plat windows {
    echo("Running on Windows")
} else {
    echo("Running on Unix-like system")
}

arch arm64 {
    echo("Running on Apple Silicon or ARM")
}
```

---

## 🛠 API Reference (Built-in Functions)

These functions are available globally in any `Buildfile`.

### File System

#### `path(segments...)`
Resolves a path relative to the `Buildfile`'s directory. Handles Windows backslashes automatically.
```javascript
const p = path("src", "main.ts") 
// Windows: "C:\Project\src\main.ts"
// Linux:   "/app/src/main.ts"
```

#### `glob(pattern)`
Finds files matching a pattern. Returns an array of absolute paths.
```javascript
const files = glob("src/**/*.ts")
```

#### `rm(target, options?)`
Removes files or directories.
*   `force`: (boolean) If true, performs a recursive delete (like `rm -rf`).
```javascript
rm("./dist", force: true)
```

#### `mkdir(path)`
Creates a directory recursively (like `mkdir -p`).
```javascript
mkdir("dist/logs")
```

### Execution & Output

#### `echo(messages...)`
Prints to standard output.
```javascript
echo("Build started", "v1.0")
```

#### `warn(messages...)`
Prints yellow text to standard error.
```javascript
warn("Deprecation warning")
```

#### `exec(command, args..., options?)`
Executes a shell command synchronously.
*   `args`: (Named Argument) An array of additional arguments (useful if constructing args dynamically).
```javascript
// Simple
exec("git", "status")

// With dynamic args
const flags = ["--verbose", "--dry-run"]
exec("npm", "install", args: flags)
```

### Template Literals
Strings support variable interpolation using `${VAR}`.

```javascript
const OUT = "bin"
echo("Output directory: ${OUT}")
```

---

## ⌨️ CLI Usage

```bash
Usage: build [options] [task]

Arguments:
  task               The task to run (default: "default")

Options:
  -f, --file <path>  Path to a specific Buildfile (default: searches CWD and parents)
  -V, --version      Output the version number
  -h, --help         Display help for command
```

## 🤝 Contributing

We love contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to set up the local development environment, understand the interpreter architecture, and submit Pull Requests.

## 🤖 AI / LLM Context

Using **Cursor**, **Copilot**, or **ChatGPT** to write your `Buildfile`?

We have provided a dedicated context file to teach AI models the specific syntax of this DSL.
Feed them [LLMs.md](./LLMs.md) (or `@LLMs.md` in Cursor) to make them instant experts in writing valid Buildfiles.

---

## License

MIT © [dev-kas](https://github.com/dev-kas)
