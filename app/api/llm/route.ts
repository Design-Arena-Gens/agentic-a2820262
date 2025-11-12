import { NextRequest, NextResponse } from "next/server";

type ProviderKey = "openai" | "gemini" | "anthropic" | "deepseek" | "openrouter";

type RequestPayload = {
  provider: ProviderKey;
  model?: string;
  prompt?: string;
  mode?: "composer" | "cli";
};

const systemPrompts: Record<NonNullable<RequestPayload["mode"]>, string> = {
  composer: `You are an elite full-stack architect specializing in React, Next.js, and composable web platforms. 
Design production-grade solutions with attention to Firebase integration, Google AI Studio workflows, and Bolt.new style component trees. 
Return answers in Markdown with clear section headers, runnable code blocks, deployment steps, environment variable tables, and risk analysis.`,
  cli: `You are an interactive agentic CLI that mirrors firebase, Google AI Studio, and bolt.new developer tooling. 
Interpret each command, reason, and reply in Markdown with concise outputs, code fences, shell snippets, and follow-up guidance. 
Always focus on React and Next.js delivery with deployment-ready insights.`
};

const providerBaselines: Record<ProviderKey, string> = {
  openai: "gpt-4.1-mini",
  gemini: "gemini-1.5-pro-latest",
  anthropic: "claude-3-5-sonnet-20240620",
  deepseek: "deepseek-chat",
  openrouter: "google/gemini-flash-1.5"
};

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const normalizeMarkdown = (content?: string | null) =>
  (content ?? "").trim() || "⚠️ Provider returned an empty response.";

export async function POST(request: NextRequest) {
  let body: RequestPayload;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload.");
  }

  const provider = body.provider;
  if (!provider) {
    return errorResponse("Provider is required.");
  }
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return errorResponse("Prompt is required.");
  }

  const mode = body.mode ?? "composer";
  const systemPrompt = systemPrompts[mode];
  const model = body.model || providerBaselines[provider];

  try {
    const output = await dispatchToProvider({
      provider,
      model,
      prompt,
      systemPrompt
    });
    return NextResponse.json({ output: normalizeMarkdown(output) }, { status: 200 });
  } catch (error) {
    console.error("LLM provider error", error);
    const message =
      error instanceof Error ? error.message : "Unexpected provider failure.";
    return errorResponse(message, 500);
  }
}

const dispatchToProvider = async ({
  provider,
  model,
  prompt,
  systemPrompt
}: {
  provider: ProviderKey;
  model: string;
  prompt: string;
  systemPrompt: string;
}) => {
  switch (provider) {
    case "openai":
      return callOpenAI({ model, prompt, systemPrompt });
    case "gemini":
      return callGemini({ model, prompt, systemPrompt });
    case "anthropic":
      return callAnthropic({ model, prompt, systemPrompt });
    case "deepseek":
      return callDeepSeek({ model, prompt, systemPrompt });
    case "openrouter":
      return callOpenRouter({ model, prompt, systemPrompt });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

const callOpenAI = async ({
  model,
  prompt,
  systemPrompt
}: {
  model: string;
  prompt: string;
  systemPrompt: string;
}) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "OpenAI request failed.");
  }
  return data?.choices?.[0]?.message?.content;
};

const callGemini = async ({
  model,
  prompt,
  systemPrompt
}: {
  model: string;
  prompt: string;
  systemPrompt: string;
}) => {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not configured.");
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\nUser Prompt:\n${prompt}`
              }
            ]
          }
        ],
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Gemini request failed.");
  }
  return data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part?.text ?? "")
    .join("\n");
};

const callAnthropic = async ({
  model,
  prompt,
  systemPrompt
}: {
  model: string;
  prompt: string;
  systemPrompt: string;
}) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Anthropic request failed.");
  }
  const content = data?.content?.[0]?.text;
  return typeof content === "string" ? content : JSON.stringify(data?.content ?? {});
};

const callDeepSeek = async ({
  model,
  prompt,
  systemPrompt
}: {
  model: string;
  prompt: string;
  systemPrompt: string;
}) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "DeepSeek request failed.");
  }
  return data?.choices?.[0]?.message?.content;
};

const callOpenRouter = async ({
  model,
  prompt,
  systemPrompt
}: {
  model: string;
  prompt: string;
  systemPrompt: string;
}) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://agentic-a2820262.vercel.app",
      "X-Title": "Agentic Code Creator"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "OpenRouter request failed.");
  }
  return data?.choices?.[0]?.message?.content;
};
