"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type ProviderKey = "openai" | "gemini" | "anthropic" | "deepseek" | "openrouter";

type ProviderConfig = {
  key: ProviderKey;
  label: string;
  hint: string;
  defaultModel: string;
  models: string[];
  docsUrl: string;
};

type CliEntry = {
  id: string;
  type: "command" | "response" | "system";
  text: string;
  provider: ProviderKey;
  timestamp: number;
};

const providerCatalog: Record<ProviderKey, ProviderConfig> = {
  openai: {
    key: "openai",
    label: "OpenAI",
    hint: "ChatGPT, GPT-4.1, GPT-4o, function calling, code generation",
    defaultModel: "gpt-4.1-mini",
    models: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-3.5-turbo"],
    docsUrl: "https://platform.openai.com/docs/api-reference"
  },
  gemini: {
    key: "gemini",
    label: "Google Gemini",
    hint: "Gemini 1.5 Pro + Flash, multimodal reasoning",
    defaultModel: "gemini-1.5-pro-latest",
    models: ["gemini-1.5-pro-latest", "gemini-1.5-flash-latest"],
    docsUrl: "https://ai.google.dev/gemini-api/docs"
  },
  anthropic: {
    key: "anthropic",
    label: "Anthropic Claude",
    hint: "Claude 3 family, constitutional AI, long context",
    defaultModel: "claude-3-5-sonnet-20240620",
    models: [
      "claude-3-5-sonnet-20240620",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307"
    ],
    docsUrl: "https://docs.anthropic.com/claude/reference/messages_post"
  },
  deepseek: {
    key: "deepseek",
    label: "DeepSeek",
    hint: "Fast reasoning models tuned for coding",
    defaultModel: "deepseek-coder",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    docsUrl: "https://platform.deepseek.com/api-docs"
  },
  openrouter: {
    key: "openrouter",
    label: "OpenRouter",
    hint: "Router to 100+ models including Llama, Mistral, Qwen",
    defaultModel: "google/gemini-flash-1.5",
    models: [
      "google/gemini-flash-1.5",
      "meta-llama/llama-3.1-70b-instruct",
      "anthropic/claude-3.5-sonnet",
      "mistralai/mixtral-8x7b-instruct"
    ],
    docsUrl: "https://openrouter.ai/docs"
  }
};

const defaultPrompt = `You are an elite full-stack engineer orchestrating a React web application build. 
Create a production-ready scaffold with UI components, data layer, deployment strategy, and edge cases. 
Return runnable code blocks, architectural rationale, and launch checklist in Markdown.`;

const cliBootMessage =
  "Agentic CLI initialized. Use `scaffold`, `refine`, `test`, `deploy`, or ask natural language questions. Every command will be routed through your selected model.";

const reactActivationHint =
  "Preview requires a React compliant output. Generate or refine your target app as a React project, then activate.";

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const markdownToHtml = async (markdown: string) => {
  const unifiedLib = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkRehype = (await import("remark-rehype")).default;
  const rehypeStringify = (await import("rehype-stringify")).default;
  const processor = (unifiedLib.unified as unknown as any)();
  processor.use(remarkParse as any);
  processor.use(remarkRehype as any);
  processor.use(rehypeStringify as any);
  const file = await processor.process(markdown);
  return String(file);
};

export default function HomePage() {
  const [provider, setProvider] = useState<ProviderKey>("openai");
  const [model, setModel] = useState<string>(providerCatalog.openai.defaultModel);
  const [prompt, setPrompt] = useState<string>(defaultPrompt);
  const [loading, setLoading] = useState<boolean>(false);
  const [output, setOutput] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [cliHistory, setCliHistory] = useState<CliEntry[]>(() => [
    {
      id: createId(),
      type: "system",
      provider: "openai",
      text: cliBootMessage,
      timestamp: Date.now()
    }
  ]);
  const [cliInput, setCliInput] = useState("");
  const [reactPreviewReady, setReactPreviewReady] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cliBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (output) {
      markdownToHtml(output)
        .then((html) => setPreviewHtml(html))
        .catch(() => setPreviewHtml(`<pre>${output}</pre>`));
      setReactPreviewReady(/react/i.test(output));
    } else {
      setPreviewHtml("");
      setReactPreviewReady(false);
      setIsPreviewActive(false);
    }
  }, [output]);

  useEffect(() => {
    cliBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cliHistory.length]);

  const providerOptions = useMemo(() => Object.values(providerCatalog), []);

  const handleProviderChange = useCallback((option: ProviderConfig) => {
    setProvider(option.key);
    setModel(option.defaultModel);
  }, []);

  const executeRequest = useCallback(
    async (payload: { prompt: string; mode: "composer" | "cli" }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/llm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            provider,
            model,
            prompt: payload.prompt,
            mode: payload.mode
          })
        });
        if (!response.ok) {
          const errorResponse = await response.json().catch(() => ({}));
          throw new Error(errorResponse?.error ?? response.statusText);
        }
        const data = (await response.json()) as { output: string };
        setOutput(data.output);
        return data.output;
      } catch (err) {
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Unknown provider error occurred";
        setError(message);
        setOutput("");
        return "";
      } finally {
        setLoading(false);
      }
    },
    [model, provider]
  );

  const handleComposerRun = useCallback(async () => {
    await executeRequest({ prompt, mode: "composer" });
  }, [executeRequest, prompt]);

  const handleCliSubmit = useCallback(async () => {
    if (!cliInput.trim()) {
      return;
    }
    const commandEntry: CliEntry = {
      id: createId(),
      type: "command",
      text: cliInput.trim(),
      provider,
      timestamp: Date.now()
    };
    setCliHistory((prev) => [...prev, commandEntry]);
    setCliInput("");
    const response = await executeRequest({
      mode: "cli",
      prompt: `You are an interactive AI CLI for a unified web app builder. Interpret and execute the following command while remaining grounded in practical engineering discipline. Return results in Markdown with clear code fences when sharing code. Command:\n${commandEntry.text}`
    });
    if (response) {
      const responseHtml = await markdownToHtml(response);
      const responseEntry: CliEntry = {
        id: createId(),
        type: "response",
        text: responseHtml,
        provider,
        timestamp: Date.now()
      };
      setCliHistory((prev) => [...prev, responseEntry]);
    }
  }, [cliInput, executeRequest, provider]);

  const handleActivatePreview = useCallback(() => {
    setIsPreviewActive((prev) => !prev && reactPreviewReady);
  }, [reactPreviewReady]);

  const activeProvider = providerCatalog[provider];

  return (
    <main className="flex flex-col gap-8 px-6 py-10 lg:px-12">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.35em] text-indigo-300">
              Agentic Fusion Platform
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">
                Connected
              </span>
              <span className="hidden sm:inline text-slate-500">
                {new Date().toLocaleString()}
              </span>
            </div>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50">
            Online Code Creator & Agentic CLI
          </h1>
          <p className="max-w-3xl text-base text-slate-300">
            Ship production-grade React experiences with a unified interface that
            orchestrates OpenAI, Gemini, Anthropic, DeepSeek, and OpenRouter.
            Compose prompts, execute agentic CLI flows, and preview your React app
            scaffold in one place.
          </p>
        </header>
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-6 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-lg shadow-blue-900/20 backdrop-blur">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Provider Mesh
                </span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {providerOptions.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => handleProviderChange(option)}
                      className={clsx(
                        "flex h-full flex-col items-start rounded-xl border px-4 py-3 text-left transition",
                        provider === option.key
                          ? "border-indigo-400/80 bg-indigo-500/10 text-indigo-50 shadow"
                          : "border-slate-700/70 bg-slate-900/70 text-slate-300 hover:border-indigo-400/40 hover:text-indigo-100"
                      )}
                    >
                      <span className="text-sm font-semibold">{option.label}</span>
                      <span className="text-xs text-slate-400">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-slate-300">
                    Model Selection ({activeProvider.label})
                  </span>
                  <select
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    {activeProvider.models.map((modelOption) => (
                      <option key={modelOption} value={modelOption}>
                        {modelOption}
                      </option>
                    ))}
                  </select>
                </label>
                <a
                  href={activeProvider.docsUrl}
                  target="_blank"
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-400 transition hover:border-indigo-500/60 hover:text-indigo-200"
                  rel="noreferrer"
                >
                  <span>API Reference</span>
                  <span aria-hidden>↗</span>
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label htmlFor="prompt" className="text-sm font-medium text-slate-300">
                  App Blueprint Prompt
                </label>
                <button
                  className="text-xs text-indigo-300 transition hover:text-indigo-200"
                  onClick={() => setPrompt(defaultPrompt)}
                >
                  Reset
                </button>
              </div>
              <textarea
                id="prompt"
                rows={8}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="w-full resize-y rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm leading-relaxed text-slate-100 shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="Describe the React app you want to build..."
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Auto-injects tooling context for Firebase, Google AI Studio, and
                  Bolt.new style workflows.
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-700/30 transition hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  onClick={handleComposerRun}
                  disabled={loading}
                >
                  {loading ? "Generating…" : "Generate Build Spec"}
                </button>
              </div>
            </div>
            {error && (
              <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-4">
              <span className="text-sm font-medium text-slate-200">LLM Output</span>
              <div className="max-h-[420px] min-h-[220px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-5 text-sm leading-relaxed text-slate-200 shadow-inner">
                {output ? (
                  <article
                    className="prose prose-invert max-w-none prose-pre:bg-slate-900 prose-pre:text-slate-200 prose-code:text-indigo-200"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <p className="text-slate-500">
                    Compose a prompt to see code generation and deployment steps here.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 shadow-lg shadow-blue-900/20">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-100">Agentic CLI</h2>
                <span className="text-xs text-slate-500">
                  Routed via {activeProvider.label}
                </span>
              </div>
              <div className="mb-3 h-60 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 p-4 font-mono text-xs leading-relaxed text-slate-200">
                {cliHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className={clsx(
                      "mb-3 whitespace-pre-wrap last:mb-0",
                      entry.type === "command" && "text-indigo-200",
                      entry.type === "system" && "text-slate-500"
                    )}
                  >
                    <span className="mr-1 text-slate-500">
                      [{new Date(entry.timestamp).toLocaleTimeString()}]
                    </span>
                    {entry.type === "command" ? (
                      <span>
                        <span className="text-emerald-400">agent@fusion</span>${" "}
                        {entry.text}
                      </span>
                    ) : entry.type === "system" ? (
                      entry.text
                    ) : (
                      <span dangerouslySetInnerHTML={{ __html: entry.text }} />
                    )}
                  </div>
                ))}
                <div ref={cliBottomRef} />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={cliInput}
                  onChange={(event) => setCliInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCliSubmit();
                    }
                  }}
                  placeholder="> scaffold auth-dashboard --stack nextjs-tailwind-firebase"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  onClick={handleCliSubmit}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-indigo-500/80 hover:text-white"
                >
                  Run
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-5 shadow-lg shadow-indigo-900/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">App Preview</h2>
                  <p className="text-xs text-indigo-200/80">
                    {reactPreviewReady
                      ? "React compliance detected. Activate to stage interactive preview."
                      : reactActivationHint}
                  </p>
                </div>
                <button
                  onClick={handleActivatePreview}
                  disabled={!reactPreviewReady}
                  className={clsx(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-300",
                    reactPreviewReady
                      ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                      : "bg-slate-800 text-slate-400"
                  )}
                >
                  {isPreviewActive ? "Preview Active" : "Activate React Preview"}
                </button>
              </div>
              <div className="mt-4 min-h-[180px] rounded-xl border border-indigo-500/30 bg-slate-950/60 p-4 text-sm text-slate-200">
                {isPreviewActive && previewHtml ? (
                  <iframe
                    title="React Preview"
                    className="h-64 w-full rounded-lg border border-slate-800 bg-slate-900"
                    srcDoc={`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><style>body{font-family:Inter,system-ui;background:#020617;color:#e2e8f0;padding:24px;}pre{background:#0f172a;padding:12px;border-radius:12px;overflow:auto;}code{color:#a5b4fc;}</style></head><body>${previewHtml}</body></html>`}
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-indigo-200/80">
                      Generate your React surface and activate preview to stage the
                      output. The renderer understands JSX snippets and deployment
                      playbooks.
                    </p>
                    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 font-mono text-xs text-indigo-100/90">
                      <span className="block text-indigo-200/70">
                        Example activation prompt:
                      </span>
                      <pre className="mt-2 whitespace-pre-wrap">
                        {`scaffold dashboard --stack nextjs+firebase --features auth, realtime-logs --ui bolt.new`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-5 shadow-lg shadow-slate-900/20">
              <h2 className="text-lg font-semibold text-slate-100">
                Workspace Integrations
              </h2>
              <div className="mt-4 grid gap-4 text-sm text-slate-300">
                <div className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-4">
                  <h3 className="text-sm font-semibold text-indigo-200">Firebase</h3>
                  <p className="mt-2 text-slate-400">
                    Generate Firestore schemas, authentication rules, Cloud
                    Functions, and hosting configurations. The CLI auto-suggests
                    commands like <code>firebase init hosting</code> and scaffolds
                    emulators inside the LLM output.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-4">
                  <h3 className="text-sm font-semibold text-indigo-200">
                    Google AI Studio
                  </h3>
                  <p className="mt-2 text-slate-400">
                    Rapidly iterate on Gemini-based agents with inline schema design
                    and evaluation prompts. Use <code>studio eval --scenario app</code>{" "}
                    inside the CLI to simulate datasets.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-4">
                  <h3 className="text-sm font-semibold text-indigo-200">Bolt.new</h3>
                  <p className="mt-2 text-slate-400">
                    Trigger `bolt deploy` sequences, generate UI flows, and export
                    clean React component trees compatible with Bolt&apos;s runtime.
                    Run <code>bolt stage design-system</code> to get multi-step
                    options.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
