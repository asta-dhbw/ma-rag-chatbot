'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Bot,
  User,
  Plus,
  Send,
  Sparkles,
  Settings,
  Loader2,
  KeyRound,
  X,
  Check,
} from 'lucide-react';
import MilvusResults from '@/components/milvus/MilvusResults';
import {
  retrieveContext,
  structureResults,
  askLLMDirect,
} from '@/lib/browser-llm';

const LLM_STORAGE_KEY = 'stuv-copilot.llm-config.v1';

function loadLLMConfig() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LLM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      baseURL: typeof parsed.baseURL === 'string' ? parsed.baseURL : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
    };
  } catch {
    return null;
  }
}

function saveLLMConfig(cfg) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

function clearLLMConfig() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LLM_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export default function ChatWindow() {
  const [messages, setMessages] = useState([]);
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [llmConfig, setLlmConfig] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const viewportRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    setLlmConfig(loadLLMConfig());
  }, []);

  useEffect(() => {
    fetch('/api/milvus?action=files')
      .then((r) => r.json())
      .then((d) => {
        if (d.filenames) setKnowledgeFiles(d.filenames);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Abort any in-flight LLM request if the component unmounts
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const llmEnabled = Boolean(llmConfig?.apiKey);

  async function onSend() {
    if (!value.trim()) return;
    const text = value.trim();
    setValue('');
    const userMsg = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);

    setSending(true);

    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1. RAG retrieval – always via our server (only the search query
      //    leaves the browser here, no LLM key involved).
      const raw = await retrieveContext(text, { pageLimit: 4, chunkLimit: 8 });
      const structured = structureResults(raw);

      if (!llmEnabled) {
        // No key configured -> only show the retrieved sources.
        const reply = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          structured: { type: 'milvus_results', results: structured },
        };
        setMessages((m) => [...m, reply]);
        return;
      }

      // 2. With key: build full history and call the LLM DIRECTLY from the
      //    browser. The key never touches our backend.
      const messageHistory = [...messages, userMsg].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const llm = await askLLMDirect({
        messages: messageHistory,
        structured,
        llmConfig,
        signal: controller.signal,
      });

      const reply = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: llm.text,
        structured: { type: 'milvus_results', results: structured },
        model: llm.model,
      };
      setMessages((m) => [...m, reply]);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('Chat error:', error);
      const errorMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ ${error?.message || 'Unbekannter Fehler.'}`,
      };
      setMessages((m) => [...m, errorMsg]);
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function handleSaveSettings(next) {
    if (!next.apiKey || !next.apiKey.trim()) {
      clearLLMConfig();
      setLlmConfig(null);
    } else {
      const clean = {
        apiKey: next.apiKey.trim(),
        baseURL: next.baseURL?.trim() || '',
        model: next.model?.trim() || '',
      };
      saveLLMConfig(clean);
      setLlmConfig(clean);
    }
    setSettingsOpen(false);
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-2 sm:px-4 min-h-0">
        <Card className="flex h-full min-h-0 flex-col gap-0 py-0 overflow-hidden border-muted/40 bg-[hsl(220,10%,6%)] text-muted-foreground shadow-[0_0_0_1px_hsl(220,10%,12%)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-medium text-white">
                  StuV-Copilot
                </div>
                <div className="text-xs text-muted-foreground">V.0.1</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors',
                      llmEnabled
                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        : 'bg-[hsl(220,10%,14%)] text-muted-foreground hover:bg-[hsl(220,10%,18%)]'
                    )}
                  >
                    <KeyRound className="h-3 w-3" />
                    {llmEnabled ? 'LLM aktiv' : 'Nur Suche'}
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8}>
                  {llmEnabled
                    ? 'API-Key liegt nur in deinem Browser. Klicken zum Bearbeiten.'
                    : 'Kein API-Key hinterlegt. Klicken, um ein LLM zu aktivieren.'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-white"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8}>Einstellungen</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Separator className="bg-muted/30" />

          {knowledgeFiles.length > 0 && (
            <div className="px-4 py-2 border-b border-muted/20">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                Wissensdatenbank
              </div>
              <div className="flex flex-wrap gap-1.5">
                {knowledgeFiles.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center rounded-md bg-[hsl(220,10%,12%)] px-2 py-0.5 text-[11px] text-muted-foreground border border-muted/20"
                  >
                    {f.replace(/\.pdf$/i, '')}
                  </span>
                ))}
              </div>
            </div>
          )}

          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full" viewportRef={viewportRef}>
              <div className="space-y-4 px-4 py-4">
                {messages.map((m) => (
                  <MessageBubble key={m.id} role={m.role} message={m}>
                    {m.content}
                  </MessageBubble>
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Denke nach...
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>

          <div className="px-3 pb-3 pt-1">
            <div
              className={cn(
                'group relative flex items-center gap-2 rounded-2xl border',
                'border-[hsl(220,10%,16%)] bg-[hsl(220,10%,8%)]/90',
                'outline-none ring-0 transition-colors focus-within:border-[hsl(220,10%,26%)]'
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 h-9 w-9 rounded-full text-muted-foreground hover:text-white"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8}>
                  Attach or add tools
                </TooltipContent>
              </Tooltip>

              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Ask, Search or Chat…"
                className={cn(
                  'flex-1 bg-transparent py-4 text-sm text-white placeholder:text-muted-foreground',
                  'outline-none'
                )}
              />

              <Badge
                variant="secondary"
                className="hidden sm:inline-flex select-none items-center gap-1 rounded-full bg-[hsl(220,10%,14%)] px-3 py-1 text-[11px] text-muted-foreground hover:bg-[hsl(220,10%,18%)]"
              >
                <Sparkles className="h-3 w-3" />{' '}
                {llmEnabled ? llmConfig?.model || 'LLM' : 'Auto'}
              </Badge>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onSend}
                    disabled={sending || !value.trim()}
                    size="icon"
                    className={cn(
                      'mr-1 h-9 w-9 rounded-full',
                      'bg-[hsl(217,90%,56%)] hover:bg-[hsl(217,90%,50%)]',
                      'disabled:opacity-50'
                    )}
                    aria-label="Fragen"
                  >
                    <Send className="h-4 w-4 text-white" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8}>Fragen</TooltipContent>
              </Tooltip>
            </div>

            <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
              <span>
                Enter drücken zum senden - Shift + Enter für neue Zeile
              </span>
              <span>@StuV - Mannheim</span>
            </div>
          </div>
        </Card>
      </div>

      {settingsOpen && (
        <LLMSettingsModal
          initial={llmConfig}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </TooltipProvider>
  );
}

function MessageBubble({ role, message, children }) {
  const isUser = role === 'user';
  const hasStructuredData = message?.structured?.results?.length > 0;
  const hasText = typeof children === 'string' && children.trim().length > 0;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-start gap-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          'rounded-2xl text-sm leading-relaxed',
          isUser
            ? 'max-w-[82%] px-3.5 py-2 bg-[hsl(217,90%,56%)] text-white shadow shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
            : hasStructuredData
            ? 'min-w-0 flex-1 bg-transparent shadow-none p-0 space-y-3'
            : 'max-w-[82%] px-3.5 py-2 bg-[hsl(220,10%,14%)] text-muted-foreground shadow shadow-[0_0_0_1px_hsl(220,10%,20%)]'
        )}
      >
        {!isUser && hasText && (
          <div
            className={cn(
              hasStructuredData
                ? 'rounded-2xl bg-[hsl(220,10%,14%)] px-3.5 py-2 text-muted-foreground shadow shadow-[0_0_0_1px_hsl(220,10%,20%)] whitespace-pre-wrap'
                : 'whitespace-pre-wrap'
            )}
          >
            {children}
          </div>
        )}

        {isUser && children}

        {!isUser && hasStructuredData && (
          <div>
            <div className="mb-1 px-1 text-[11px] uppercase tracking-wider text-muted-foreground/60">
              Quellen
            </div>
            <MilvusResults results={message.structured.results} />
          </div>
        )}
      </div>
      {isUser && (
        <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-[hsl(220,10%,18%)] text-white/80">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

function LLMSettingsModal({ initial, onClose, onSave }) {
  const [apiKey, setApiKey] = useState(initial?.apiKey || '');
  const [baseURL, setBaseURL] = useState(initial?.baseURL || '');
  const [model, setModel] = useState(initial?.model || '');
  const [showKey, setShowKey] = useState(false);

  // ESC closes modal
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="llm-settings-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-muted/30 bg-[hsl(220,10%,8%)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 id="llm-settings-title" className="text-sm font-semibold">
              LLM-Zugangsdaten
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-[hsl(220,10%,14%)] hover:text-white"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            Dein API-Key wird{' '}
            <strong className="text-white">
              ausschließlich in deinem Browser
            </strong>{' '}
            (localStorage) gespeichert und beim Senden{' '}
            <strong className="text-white">direkt</strong> an den
            LLM-Anbieter geschickt. Unser Server sieht den Schlüssel{' '}
            <strong className="text-white">zu keinem Zeitpunkt</strong>.
          </p>
          <p className="text-muted-foreground/80">
            Anthropic-API funktioniert direkt aus dem Browser. Für eigene
            Proxys / LongCat / vLLM muss der Endpoint CORS für diese Origin
            erlauben, sonst blockiert der Browser die Antwort.
          </p>
          <p className="text-amber-400/90">
            ⚠️ Der Key bleibt im Browser, daher: nutze nur Geräte/Browser, die
            du selbst kontrollierst, und lösche den Key, wenn du fertig bist.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground/70">
              API-Key
            </label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 bg-[hsl(220,10%,10%)] text-white"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowKey((s) => !s)}
                className="shrink-0 text-muted-foreground hover:text-white"
              >
                {showKey ? 'Verbergen' : 'Anzeigen'}
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground/70">
              Base URL{' '}
              <span className="normal-case text-muted-foreground/50">
                (optional)
              </span>
            </label>
            <Input
              type="url"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.anthropic.com"
              className="bg-[hsl(220,10%,10%)] text-white"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              Leer lassen für Anthropic Direct. Für eigene Proxys / LongCat
              etc. die Basis-URL eintragen (Endpoint muss CORS aktiviert
              haben).
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground/70">
              Modell{' '}
              <span className="normal-case text-muted-foreground/50">
                (optional)
              </span>
            </label>
            <Input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="claude-sonnet-4-5-20250929"
              className="bg-[hsl(220,10%,10%)] text-white"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setApiKey('');
              setBaseURL('');
              setModel('');
              onSave({ apiKey: '', baseURL: '', model: '' });
            }}
            className="text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            Löschen
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground hover:text-white"
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={() => onSave({ apiKey, baseURL, model })}
              className="bg-[hsl(217,90%,56%)] text-white hover:bg-[hsl(217,90%,50%)]"
            >
              <Check className="mr-1 h-4 w-4" />
              Speichern
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}