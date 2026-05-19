# jsontranslator

[![CI](https://github.com/sedlukha/jsontranslator/actions/workflows/ci.yml/badge.svg)](https://github.com/sedlukha/jsontranslator/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/jsontranslator.svg)](https://www.npmjs.com/package/jsontranslator)
[![npm downloads](https://img.shields.io/npm/dm/jsontranslator.svg)](https://www.npmjs.com/package/jsontranslator)
[![license](https://img.shields.io/npm/l/jsontranslator.svg)](LICENSE)

Batch-translate JSON string arrays into multiple locales via the **OpenAI chat API**. Preserves `{placeholders}`, returns a deterministic `{ text → { locale → translation } }` shape, and **always falls back to the original text** on any error so your build never breaks.

## Why?

Most i18n tooling either ships a heavyweight runtime, requires a vendor SDK, or fails noisily when the model returns garbage. `jsontranslator` is the opposite: a single function plus a tiny CLI that

- batches many strings into one OpenAI request (cheap + fast),
- preserves ICU-style placeholders like `{count}` and `{username}`,
- never throws — on network/API/JSON errors you get the original strings back,
- has **zero runtime dependencies** (Node's built-in `fetch`).

## Installation

```bash
npm install jsontranslator
```

Requires Node.js `>=18` (global `fetch`).

Set your API key in the environment:

```bash
export OPENAI_API_KEY=sk-...
```

## Quick start

```ts
import { translateJson } from "jsontranslator"

const result = await translateJson({
  texts: ["Hello world", "Welcome, {username}"],
  targetLocales: ["ru", "fr"],
})

// {
//   "Hello world":           { ru: "Привет мир",                 fr: "Bonjour le monde" },
//   "Welcome, {username}":   { ru: "Добро пожаловать, {username}", fr: "Bienvenue, {username}" }
// }
```

## CLI

```bash
npx jsontranslator --input texts.json --locales ru,fr --output translations.json
```

`texts.json` must be a JSON array of strings:

```json
["Hello world", "Welcome, {username}"]
```

### CLI flags

| Flag                 | Required | Default       | Description                                                |
| -------------------- | -------- | ------------- | ---------------------------------------------------------- |
| `-i`, `--input`      | **yes**  | —             | Path to a JSON file containing an array of strings.        |
| `-l`, `--locales`    | **yes**  | —             | Comma-separated target locales (e.g. `ru,fr,de`).          |
| `-o`, `--output`     | no       | stdout        | Path to write the JSON result.                             |
| `-n`, `--notes`      | no       | —             | Translator notes (tone, glossary, audience).               |
| `-m`, `--model`      | no       | `gpt-4o-mini` | OpenAI chat model.                                         |
| `--api-url`          | no       | OpenAI's URL  | Override the chat completions URL (proxies, gateways).     |
| `-h`, `--help`       | no       | —             | Show usage.                                                |

`OPENAI_API_KEY` is read from the environment.

## API

### `translateJson(options)`

```ts
import { translateJson, type TranslateJsonOptions, type TranslationMap } from "jsontranslator"
```

| Option          | Type            | Required | Default                                            | Description                                                                  |
| --------------- | --------------- | -------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `texts`         | `string[]`      | **yes**  | —                                                  | Source strings to translate. Empty array returns `{}`.                       |
| `targetLocales` | `string[]`      | **yes**  | —                                                  | BCP-47 / ISO locale codes. Empty array returns `{}`.                         |
| `notes`         | `string`        | no       | —                                                  | Extra instructions appended to the system prompt (tone, glossary, context). |
| `model`         | `string`        | no       | `"gpt-4o-mini"`                                    | Any OpenAI chat-completions model that supports `response_format: json`.    |
| `apiKey`        | `string`        | no       | `process.env.OPENAI_API_KEY`                       | OpenAI API key.                                                              |
| `apiUrl`        | `string`        | no       | `"https://api.openai.com/v1/chat/completions"`     | Useful for proxies, gateways, or LLM mocks.                                  |
| `fetch`         | `typeof fetch`  | no       | global `fetch`                                     | Inject a custom fetch implementation (testing, retries, telemetry).          |

Returns `Promise<TranslationMap>` where `TranslationMap = Record<string, Record<string, string>>` — keyed first by source text, then by locale.

## Placeholders

The model is explicitly instructed to keep placeholders intact, so `{count}`, `{username}`, `{0}`, etc. survive the round-trip:

```ts
await translateJson({
  texts: ["You have {count} new messages"],
  targetLocales: ["ru"],
})
// { "You have {count} new messages": { ru: "У вас {count} новых сообщений" } }
```

## Fallback behavior

`translateJson` is designed to **never throw**. If anything goes wrong — network error, non-2xx response, missing `choices`, malformed JSON in the response, missing `translations` key, empty string for a locale — every requested `(text, locale)` cell falls back to the original `text`:

```ts
const result = await translateJson({
  texts: ["Hello world"],
  targetLocales: ["ru", "fr"],
})
// On failure:
// { "Hello world": { ru: "Hello world", fr: "Hello world" } }
```

This means you can plug `translateJson` into a build step without `try/catch` and get a deterministic shape every time. Inspect the values for `text === translation` if you want to detect partial failures.

## Custom fetch (testing, retries)

```ts
import { translateJson } from "jsontranslator"

await translateJson({
  texts: ["Hello"],
  targetLocales: ["ru"],
  fetch: async (url, init) => {
    // add retries, logging, signed requests, etc.
    return fetch(url, init)
  },
})
```

## License

MIT
