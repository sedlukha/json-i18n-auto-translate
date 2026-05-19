import { chmod } from "node:fs/promises"

const binPath = new URL("../dist/cli/index.js", import.meta.url)
await chmod(binPath, 0o755)
