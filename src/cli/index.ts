#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import { parseArgs } from "node:util"

import { translateJson } from "../index.js"

const USAGE = `Usage: jsontranslator --input <file> --locales <list> [options]

Options:
  -i, --input    <path>     Path to a JSON file containing an array of strings to translate.
  -l, --locales  <list>     Comma-separated target locales (e.g. "ru,fr,de").
  -o, --output   <path>     Path to write the JSON result. Defaults to stdout.
  -n, --notes    <text>     Optional translator notes (tone, glossary, etc.).
  -m, --model    <name>     OpenAI chat model (default: gpt-4o-mini).
      --api-url  <url>      Override the chat completions URL.
  -h, --help                Show this help.

Environment:
  OPENAI_API_KEY            API key used for authentication.

Input file must contain a JSON array of English strings, e.g. ["Hello", "Welcome"].`

const fail = (message: string, code = 1): never => {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

const { values } = parseArgs({
  options: {
    input: { type: "string", short: "i" },
    locales: { type: "string", short: "l" },
    output: { type: "string", short: "o" },
    notes: { type: "string", short: "n" },
    model: { type: "string", short: "m" },
    "api-url": { type: "string" },
    help: { type: "boolean", short: "h" },
  },
  strict: true,
})

if (values.help) {
  process.stdout.write(`${USAGE}\n`)
  process.exit(0)
}

if (!values.input) fail("Missing required option: --input\n\n" + USAGE)
if (!values.locales) fail("Missing required option: --locales\n\n" + USAGE)

const raw = await readFile(values.input as string, "utf8")
let parsed: unknown
try {
  parsed = JSON.parse(raw)
} catch (error) {
  fail(`Failed to parse JSON from ${values.input}: ${(error as Error).message}`)
}

if (
  !Array.isArray(parsed) ||
  !parsed.every((item): item is string => typeof item === "string")
) {
  fail("Input JSON must be an array of strings.")
}

const targetLocales = (values.locales as string)
  .split(",")
  .map((locale) => locale.trim())
  .filter(Boolean)

if (targetLocales.length === 0) {
  fail("No target locales provided.")
}

const result = await translateJson({
  texts: parsed as string[],
  targetLocales,
  notes: values.notes,
  model: values.model,
  apiUrl: values["api-url"],
})

const serialized = `${JSON.stringify(result, null, 2)}\n`

if (values.output) {
  await writeFile(values.output, serialized, "utf8")
} else {
  process.stdout.write(serialized)
}
