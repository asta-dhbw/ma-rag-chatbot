'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
} from 'lucide-react';
import MilvusResults from '@/components/milvus/MilvusResults';

export default function ChatWindow() {
  const [messages, setMessages] = useState([

  ]);
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const viewportRef = useRef(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  async function onSend() {
    if (!value.trim()) return;
    const text = value.trim();
    setValue('');
    const userMsg = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);

    setSending(true);

    try {
      // Build message history for context (send all previous messages)
      const messageHistory = [...messages, userMsg].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch('/api/ollama', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messageHistory
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      const reply = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content[0].text,
        structured: data.structured || null,
        responseType: data.responseType || 'text',
      };

      setMessages((m) => [...m, reply]);
    } catch (error) {
      console.error('Error calling Ollama API:', error);
      const errorMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      };
      setMessages((m) => [...m, errorMsg]);
    } finally {
      setSending(false);
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-3xl px-2 sm:px-4">
        {/* Shell */}
        <Card className="border-muted/40 bg-[hsl(220,10%,6%)] text-muted-foreground shadow-[0_0_0_1px_hsl(220,10%,12%)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-medium text-white">
                  StuV-Copilot
                </div>
                <div className="text-xs text-muted-foreground">
                  Leben wieder schön machen
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-white"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8}>Einstellungen</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Separator className="bg-muted/30" />

          {/* Messages */}
          <CardContent className="p-0">
            <ScrollArea
              className="h-[52vh] sm:h-[60vh]"
              viewportRef={viewportRef}
            >
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

          {/* Composer */}
          <div className="px-3 pb-3 pt-1">
            <div
              className={cn(
                'group relative flex items-center gap-2 rounded-2xl border',
                'border-[hsl(220,10%,16%)] bg-[hsl(220,10%,8%)]/90',
                'outline-none ring-0 transition-colors focus-within:border-[hsl(220,10%,26%)]'
              )}
            >
              {/* Left actions (+) */}
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

              {/* Text input */}
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

              {/* Middle status pill (Auto) */}
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex select-none items-center gap-1 rounded-full bg-[hsl(220,10%,14%)] px-3 py-1 text-[11px] text-muted-foreground hover:bg-[hsl(220,10%,18%)]"
              >
                <Sparkles className="h-3 w-3" /> Auto
              </Badge>

              {/* Send button */}
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

            {/* Footer hint */}
            <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
              <span>
                Enter drücken zum senden - Shift + Enter für neue Zeile
              </span>
              <span>@StuV - Mannheim</span>
            </div>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function MessageBubble({ role, message, children }) {
  const isUser = role === 'user';
  const hasStructuredData = message?.structured?.results;

  return (
    <div
      className={cn(
        'flex w-full items-start gap-3',
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
          'rounded-2xl text-sm leading-relaxed shadow',
          hasStructuredData ? 'max-w-[95%] p-0' : 'max-w-[82%] px-3.5 py-2',
          isUser
            ? 'bg-[hsl(217,90%,56%)] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
            : hasStructuredData
            ? 'bg-transparent shadow-none'
            : 'bg-[hsl(220,10%,14%)] text-muted-foreground shadow-[0_0_0_1px_hsl(220,10%,20%)]'
        )}
      >
        {hasStructuredData ? (
          <MilvusResults results={message.structured.results} />
        ) : (
          children
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
