export interface TranslateJsonOptions {
  texts: string[]
  targetLocales: string[]
  notes?: string
  model?: string
  apiKey?: string
  apiUrl?: string
  fetch?: typeof fetch
}

export type TranslationMap = Record<string, Record<string, string>>

const DEFAULT_API_URL = "https://api.openai.com/v1/chat/completions"
const DEFAULT_MODEL = "gpt-4o-mini"

const createFallback = (
  texts: string[],
  targetLocales: string[]
): TranslationMap => {
  const result: TranslationMap = {}
  for (const text of texts) {
    const perLocale: Record<string, string> = {}
    for (const locale of targetLocales) {
      perLocale[locale] = text
    }
    result[text] = perLocale
  }
  return result
}

const buildSystemPrompt = (
  targetLocales: string[],
  notes: string | undefined
): string =>
  `You are a professional translator. Translate the provided English texts to the following languages: ${targetLocales.join(", ")}.
Return an object with a "translations" property containing all translations.
For each original text, provide translations for all requested languages.
Preserve any placeholders like {count}, {username}, etc. with the exact same format.
Example format:
{
  "translations": {
    "Hello world": {
      "ru": "Привет мир",
      "fr": "Bonjour le monde"
    },
    "Welcome, {username}": {
      "ru": "Добро пожаловать, {username}",
      "fr": "Bienvenue, {username}"
    }
  }
}

SPECIAL NOTES: ${notes ?? ""}`

export const translateJson = async (
  options: TranslateJsonOptions
): Promise<TranslationMap> => {
  const {
    texts,
    targetLocales,
    notes,
    model = DEFAULT_MODEL,
    apiKey = process.env.OPENAI_API_KEY,
    apiUrl = DEFAULT_API_URL,
    fetch: fetchImpl = fetch,
  } = options

  if (texts.length === 0 || targetLocales.length === 0) {
    return {}
  }

  try {
    const rawResponse = await fetchImpl(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(targetLocales, notes) },
          {
            role: "user",
            content: `Translate these texts: ${JSON.stringify(texts)}`,
          },
        ],
      }),
    })

    const data = (await rawResponse.json()) as {
      choices?: { message: { content: string | null } }[]
    }

    if (!data.choices || data.choices.length === 0) {
      return createFallback(texts, targetLocales)
    }

    const firstChoice = data.choices[0]
    const parsed = JSON.parse(firstChoice?.message.content ?? "{}") as {
      translations?: Record<string, Record<string, string>>
    }

    if (!parsed.translations || typeof parsed.translations !== "object") {
      return createFallback(texts, targetLocales)
    }

    const { translations } = parsed
    const result: TranslationMap = {}

    for (const text of texts) {
      const perLocale: Record<string, string> = {}
      for (const locale of targetLocales) {
        const value = translations[text]?.[locale]
        perLocale[locale] =
          typeof value === "string" && value.trim() !== "" ? value : text
      }
      result[text] = perLocale
    }

    return result
  } catch {
    return createFallback(texts, targetLocales)
  }
}
