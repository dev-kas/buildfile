const DIST_DIR = path("./dist")
const SRC_DIR  = path("./src")

env NODE_ENV = "development"

tool node {
    windows: "node.exe"
    any:     "node"
}

task clean {
    echo("Cleaning old build...")
    rm(DIST_DIR, force: true)
}

task build depends clean {
    echo("Compiling TypeScript...")
    node(path("node_modules/typescript/bin/tsc"))
}

task start depends build {
    echo("Starting Buildfile CLI...")
    node(path("${DIST_DIR}/index.js"))
}

task dev depends build {
    echo("Running self-test...")
    node(path("${DIST_DIR}/index.js"), "clean")
}

task default depends dev {
    echo("Build finished successfully!")
}
