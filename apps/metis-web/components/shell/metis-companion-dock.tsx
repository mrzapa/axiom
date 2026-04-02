"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bootstrapAssistant,
  clearAssistantMemory,
  fetchAssistant,
  reflectAssistant,
  updateAssistant,
  type AssistantSnapshot,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProgressIndicator } from "@/components/ui/progress-indicator";
import { cn } from "@/lib/utils";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Cpu,
  Send,
  Square,
  AlertTriangle,
} from "lucide-react";
import { BrainIcon } from "@/components/icons";
import { useArrowState } from "@/hooks/use-arrow-state";
import { useWebGPUCompanion } from "@/lib/webgpu-companion/use-webgpu-companion";

interface MetisCompanionDockProps {
  sessionId?: string | null;
  runId?: string | null;
  className?: string;
}

export function MetisCompanionDock({
  sessionId,
  runId,
  className,
}: MetisCompanionDockProps) {
  const [snapshot, setSnapshot] = useArrowState<AssistantSnapshot | null>(null);
  const [loading, setLoading] = useArrowState(true);
  const [busyAction, setBusyAction] = useArrowState<"" | "toggle" | "reflect" | "clear" | "bootstrap">("");
  const [showWhy, setShowWhy] = useArrowState(false);
  const [error, setError] = useArrowState<string | null>(null);
  const requestIdRef = useRef(0);
  const previousContextRef = useRef<{ sessionId?: string | null; runId?: string | null } | null>(null);

  // WebGPU companion – only activated when no server-side runtime is configured
  const webgpu = useWebGPUCompanion();
  const [quickAsk, setQuickAsk] = useState("");

  const load = useCallback(async (autoBootstrap = true) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      let next = await fetchAssistant();
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (
        autoBootstrap &&
        next.runtime.auto_bootstrap &&
        !next.status.recommended_model_name &&
        ["pending", "fallback", "recommended"].includes(next.status.bootstrap_state)
      ) {
        next = await bootstrapAssistant(false);
        if (requestId !== requestIdRef.current) {
          return;
        }
      }
      setSnapshot(next);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load companion");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [setError, setLoading, setSnapshot]);

  useEffect(() => {
    const hasPreviousContext = previousContextRef.current !== null;
    previousContextRef.current = { sessionId, runId };
    void load(!hasPreviousContext);
  }, [load, sessionId, runId]);

  const latestMemory = useMemo(
    () => snapshot?.memory?.[0] ?? null,
    [snapshot],
  );
  const minimized = Boolean(snapshot?.identity.minimized);

  // True when no dedicated runtime is wired up on the server side.
  // WebGPU fills this gap with a fully in-browser model.
  const noRuntime =
    !loading &&
    snapshot?.identity.companion_enabled === true &&
    !snapshot?.status.runtime_source;

  /** Build the prompt fed to the WebGPU model for a context-aware reflection. */
  function buildReflectionMessages(): Array<{ role: string; content: string }> {
    const ctx =
      snapshot?.status.latest_summary ??
      snapshot?.memory?.[0]?.summary ??
      "";
    return [
      {
        role: "system",
        content:
          "You are METIS, a concise research companion. Give 2-3 sentence replies. Be direct and actionable. Never use lists or headers.",
      },
      {
        role: "user",
        content: ctx
          ? `Context: "${ctx.slice(0, 400)}"\n\nGiven that context, what is the single most useful next step or insight right now?`
          : "What is one high-leverage question a researcher should ask themselves at the start of a new session?",
      },
    ];
  }

  if (snapshot && !snapshot.identity.docked) {
    return null;
  }

  async function handleTogglePause() {
    if (!snapshot) return;
    setBusyAction("toggle");
    setError(null);
    try {
      const next = await updateAssistant({
        status: { paused: !snapshot.status.paused },
      });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update companion");
    } finally {
      setBusyAction("");
    }
  }

  async function handleReflect() {
    setBusyAction("reflect");
    setError(null);
    try {
      await reflectAssistant({
        trigger: "manual",
        session_id: sessionId ?? "",
        run_id: runId ?? "",
        force: true,
      });
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reflection failed");
    } finally {
      setBusyAction("");
    }
  }

  async function handleClearMemory() {
    setBusyAction("clear");
    setError(null);
    try {
      await clearAssistantMemory(5);
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear memory");
    } finally {
      setBusyAction("");
    }
  }

  async function handleBootstrap() {
    setBusyAction("bootstrap");
    setError(null);
    try {
      const next = await bootstrapAssistant(true);
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to install companion runtime");
    } finally {
      setBusyAction("");
    }
  }

  async function handleMinimizeToggle() {
    if (!snapshot) return;
    try {
      const next = await updateAssistant({
        identity: { minimized: !snapshot.identity.minimized },
      });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dock state");
    }
  }

  return (
    <aside
      className={cn(
        "pointer-events-auto fixed bottom-4 right-4 z-40",
        minimized ? "w-auto" : "w-[min(24rem,calc(100vw-2rem))]",
        className,
      )}
      aria-label="METIS companion"
    >
      <div className={cn(
        "home-liquid-glass border border-white/10 shadow-2xl shadow-black/40",
        minimized ? "rounded-full" : "rounded-[1.6rem]",
      )}>
        <div className={cn(
          "flex items-center",
          minimized ? "gap-2 px-2.5 py-1.5" : "gap-3 border-b border-white/8 px-4 py-3",
        )}>
          <span className={cn(
            "flex items-center justify-center rounded-full bg-primary/15 text-primary",
            minimized ? "size-7" : "size-9",
          )}>
            <Bot className={minimized ? "size-3.5" : "size-4"} />
          </span>
          {!minimized && (
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold tracking-[-0.03em] text-foreground">
                {snapshot?.identity.name ?? "METIS"}
              </p>
              <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {snapshot?.status.runtime_source === "dedicated_local"
                  ? "Dedicated local companion"
                  : "Companion overlay"}
              </p>
            </div>
          )}
          {minimized && (
            <span className="text-sm font-medium text-foreground">
              {snapshot?.identity.name ?? "METIS"}
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleMinimizeToggle()}
            className={cn(
              "rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground",
              minimized ? "ml-0.5 p-1" : "ml-auto p-1.5",
            )}
            aria-label={minimized ? "Expand companion" : "Minimize companion"}
          >
            {minimized ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-4" />}
          </button>
        </div>

        {!minimized ? (
          <div className="space-y-4 px-4 py-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading companion state…
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm leading-6 text-foreground">
                    {latestMemory?.summary || snapshot?.identity.greeting || "I’m here and ready to guide the next step."}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {snapshot?.status.bootstrap_message || "I keep local reflections and learned links while leaving normal chat and RAG flows alone."}
                  </p>
                </div>

                {latestMemory?.why || snapshot?.status.latest_why ? (
                  <div className="rounded-[1.15rem] border border-white/8 bg-white/4 px-3 py-2.5 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => setShowWhy((current) => !current)}
                      className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium uppercase tracking-[0.18em] text-primary"
                    >
                      Why this suggestion?
                      {showWhy ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                    </button>
                    {showWhy ? (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {latestMemory?.why || snapshot?.status.latest_why}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => void handleTogglePause()}
                    disabled={busyAction !== ""}
                  >
                    {busyAction === "toggle" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : snapshot?.status.paused ? (
                      <Play className="size-4" />
                    ) : (
                      <Pause className="size-4" />
                    )}
                    {snapshot?.status.paused ? "Resume" : "Pause"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => void handleReflect()}
                    disabled={busyAction !== ""}
                  >
                    {busyAction === "reflect" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Reflect Now
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => void handleClearMemory()}
                    disabled={busyAction !== ""}
                  >
                    {busyAction === "clear" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Clear Recent
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => void load(false)}
                    disabled={busyAction !== ""}
                  >
                    <BrainIcon size={16} className="shrink-0" />
                    Refresh
                  </Button>
                </div>

                {/* ── WebGPU browser-local companion ─────────────────────────
                    Shown only when no server runtime is configured.
                    All inference runs client-side via @huggingface/transformers
                    + WebGPU.  Model (~2 GB) is cached in IndexedDB after the
                    first download. ─────────────────────────────────────────── */}
                {noRuntime && (
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/4 px-3 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <Cpu className="size-3.5 shrink-0 text-primary" />
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                        Browser companion
                      </p>
                    </div>

                    {/* Unsupported browser */}
                    {webgpu.status === "unsupported" && (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        In-browser AI requires{" "}
                        <a
                          href="https://caniuse.com/webgpu"
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          Chrome / Edge 113+
                        </a>{" "}
                        or Firefox Nightly with WebGPU enabled.
                      </p>
                    )}

                    {/* Idle – invite the user to enable */}
                    {webgpu.status === "idle" && (
                      <>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          LFM2 runs entirely in your browser via WebGPU — no API key or server needed.
                          The model (~2 GB) is downloaded once and cached.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-3 gap-2"
                          onClick={webgpu.load}
                        >
                          <Cpu className="size-4 shrink-0" />
                          Enable browser companion
                        </Button>
                      </>
                    )}

                    {/* Loading / downloading */}
                    {webgpu.status === "loading" && (
                      <div className="mt-3 space-y-2">
                        <ProgressIndicator
                          value={webgpu.progress?.pct ?? undefined}
                          label={
                            webgpu.progress && webgpu.progress.totalBytes > 0
                              ? `${(webgpu.progress.loadedBytes / 1e9).toFixed(2)} GB of ${(webgpu.progress.totalBytes / 1e9).toFixed(2)} GB`
                              : "Downloading LFM2…"
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Cached in your browser — won&apos;t re-download next time.
                        </p>
                      </div>
                    )}

                    {/* Ready or generating – show quick-ask interface */}
                    {(webgpu.status === "ready" || webgpu.status === "generating") && (
                      <div className="mt-3 space-y-2">
                        {/* Streamed output */}
                        {webgpu.output && (
                          <div className="max-h-36 overflow-y-auto rounded-[0.9rem] border border-white/8 bg-black/20 px-3 py-2 text-sm leading-6 text-foreground">
                            {webgpu.output}
                            {webgpu.status === "generating" && (
                              <span className="ml-0.5 inline-block w-1.5 animate-pulse rounded-sm bg-primary align-middle">
                                &nbsp;
                              </span>
                            )}
                          </div>
                        )}

                        {/* Quick-reflect button */}
                        {webgpu.status === "ready" && !webgpu.output && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2"
                            onClick={() => webgpu.send(buildReflectionMessages())}
                          >
                            <RefreshCw className="size-4" />
                            Reflect on session
                          </Button>
                        )}

                        {/* Quick-ask input */}
                        <div className="flex gap-2">
                          <Textarea
                            value={quickAsk}
                            onChange={(e) => setQuickAsk(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey && quickAsk.trim()) {
                                e.preventDefault();
                                webgpu.send([
                                  { role: "system", content: "You are METIS, a concise research companion. Be direct. Keep replies under 3 sentences." },
                                  { role: "user", content: quickAsk.trim() },
                                ]);
                                setQuickAsk("");
                              }
                            }}
                            placeholder="Ask anything… (Enter to send)"
                            className="min-h-0 resize-none py-1.5 text-xs"
                            disabled={webgpu.status === "generating"}
                            rows={1}
                          />
                          {webgpu.status === "generating" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 self-end"
                              onClick={webgpu.stop}
                              aria-label="Stop generation"
                            >
                              <Square className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              className="shrink-0 self-end"
                              disabled={!quickAsk.trim()}
                              onClick={() => {
                                if (!quickAsk.trim()) return;
                                webgpu.send([
                                  { role: "system", content: "You are METIS, a concise research companion. Be direct. Keep replies under 3 sentences." },
                                  { role: "user", content: quickAsk.trim() },
                                ]);
                                setQuickAsk("");
                              }}
                              aria-label="Send"
                            >
                              <Send className="size-4" />
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Running locally · LFM2 8B · WebGPU
                        </p>
                      </div>
                    )}

                    {/* OOM – targeted advice */}
                    {webgpu.status === "oom" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-start gap-2 text-xs text-amber-400">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                          <span>
                            GPU memory full. Close other GPU-heavy tabs or browser windows, then retry.
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={webgpu.reset}
                        >
                          <RefreshCw className="size-4" />
                          Retry
                        </Button>
                      </div>
                    )}

                    {/* Generic error */}
                    {webgpu.status === "error" && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-destructive line-clamp-3">
                          {webgpu.error}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={webgpu.reset}
                        >
                          <RefreshCw className="size-4" />
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {snapshot &&
                snapshot.status.runtime_source !== "dedicated_local" &&
                snapshot.status.recommended_model_name ? (                  <div className="rounded-[1.2rem] border border-primary/20 bg-primary/6 px-3 py-3 backdrop-blur-sm">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                      Lightweight local runtime
                    </p>
                    <p className="mt-1 text-sm leading-6 text-foreground">
                      Recommended: {snapshot.status.recommended_model_name}
                      {snapshot.status.recommended_quant ? ` · ${snapshot.status.recommended_quant}` : ""}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Install a small dedicated GGUF model so I can handle reflections locally without changing the main chat runtime.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={() => void handleBootstrap()}
                      disabled={busyAction !== ""}
                    >
                      {busyAction === "bootstrap" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <BrainIcon size={16} className="shrink-0" />
                      )}
                      Install Local Companion
                    </Button>
                  </div>
                ) : null}

                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
