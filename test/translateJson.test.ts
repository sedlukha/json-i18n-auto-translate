import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { translateJson } from "../src/index.js"

const successPayload = {
  translations: {
    "Hello world": { ru: "Привет мир", fr: "Bonjour le monde" },
    "Welcome, {username}": {
      ru: "Добро пожаловать, {username}",
      fr: "Bienvenue, {username}",
    },
  },
}

const buildResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

const fetchReturning = (body: unknown): typeof fetch => {
  return (async () => buildResponse(body)) as typeof fetch
}

describe("translateJson", () => {
  test("returns empty object when texts array is empty", async () => {
    const result = await translateJson({
      texts: [],
      targetLocales: ["ru", "fr"],
      fetch: fetchReturning({}),
    })
    assert.deepEqual(result, {})
  })

  test("returns empty object when targetLocales array is empty", async () => {
    const result = await translateJson({
      texts: ["Hello world"],
      targetLocales: [],
      fetch: fetchReturning({}),
    })
    assert.deepEqual(result, {})
  })

  test("returns translations from OpenAI on success", async () => {
    const result = await translateJson({
      texts: ["Hello world", "Welcome, {username}"],
      targetLocales: ["ru", "fr"],
      fetch: fetchReturning({
        choices: [{ message: { content: JSON.stringify(successPayload) } }],
      }),
    })
    assert.deepEqual(result, successPayload.translations)
  })

  test("preserves placeholders like {username} in translated strings", async () => {
    const result = await translateJson({
      texts: ["Welcome, {username}"],
      targetLocales: ["ru"],
      fetch: fetchReturning({
        choices: [{ message: { content: JSON.stringify(successPayload) } }],
      }),
    })
    assert.match(result["Welcome, {username}"]?.ru ?? "", /\{username\}/)
  })

  test("falls back to original text when OpenAI returns malformed JSON", async () => {
    const result = await translateJson({
      texts: ["Hello world"],
      targetLocales: ["ru"],
      fetch: fetchReturning({
        choices: [{ message: { content: "not valid json {{{" } }],
      }),
    })
    assert.equal(result["Hello world"]?.ru, "Hello world")
  })

  test("falls back to original text when translations key is missing", async () => {
    const result = await translateJson({
      texts: ["Hello world"],
      targetLocales: ["ru"],
      fetch: fetchReturning({
        choices: [{ message: { content: JSON.stringify({ other: "data" }) } }],
      }),
    })
    assert.equal(result["Hello world"]?.ru, "Hello world")
  })

  test("falls back to original text when choices array is empty", async () => {
    const result = await translateJson({
      texts: ["Hello world"],
      targetLocales: ["ru", "fr"],
      fetch: fetchReturning({ choices: [] }),
    })
    assert.equal(result["Hello world"]?.ru, "Hello world")
    assert.equal(result["Hello world"]?.fr, "Hello world")
  })

  test("falls back to original text on network error", async () => {
    const result = await translateJson({
      texts: ["Hello world"],
      targetLocales: ["ru", "fr"],
      fetch: (async () => {
        throw new Error("network down")
      }) as typeof fetch,
    })
    assert.equal(result["Hello world"]?.ru, "Hello world")
    assert.equal(result["Hello world"]?.fr, "Hello world")
  })

  test("falls back to original when a translated value is empty string", async () => {
    const result = await translateJson({
      texts: ["Hello world"],
      targetLocales: ["ru"],
      fetch: fetchReturning({
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: { "Hello world": { ru: "   " } },
              }),
            },
          },
        ],
      }),
    })
    assert.equal(result["Hello world"]?.ru, "Hello world")
  })

  test("passes notes to the system prompt and uses configured model", async () => {
    let capturedBody: unknown
    let capturedUrl: string | undefined
    const captureFetch = (async (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedBody = JSON.parse(init.body as string)
      return buildResponse({
        choices: [{ message: { content: JSON.stringify(successPayload) } }],
      })
    }) as unknown as typeof fetch

    await translateJson({
      texts: ["Hello world"],
      targetLocales: ["ru"],
      notes: "informal tone",
      model: "gpt-4o",
      fetch: captureFetch,
    })

    const body = capturedBody as {
      model: string
      messages: { role: string; content: string }[]
    }
    const systemMessage = body.messages.find((m) => m.role === "system")
    assert.equal(body.model, "gpt-4o")
    assert.equal(capturedUrl, "https://api.openai.com/v1/chat/completions")
    assert.ok(systemMessage?.content.includes("informal tone"))
  })

  test("uses gpt-4o-mini as default model", async () => {
    let capturedBody: unknown
    const captureFetch = (async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return buildResponse({
        choices: [{ message: { content: JSON.stringify(successPayload) } }],
      })
    }) as unknown as typeof fetch

    await translateJson({
      texts: ["Hello world"],
      targetLocales: ["ru"],
      fetch: captureFetch,
    })

    assert.equal((capturedBody as { model: string }).model, "gpt-4o-mini")
  })
})
