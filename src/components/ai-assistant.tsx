import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { askAssistant, type ChatMessage, type AiProvider } from "@/lib/ai-assistant.functions";

const SUGGESTIONS_ID = [
  "Buatkan 5 soal pilihan ganda tentang wudhu untuk kelas 5",
  "Buat rencana pembelajaran 1 pertemuan materi pecahan",
  "Beri ide tugas proyek tema lingkungan",
];

/** Floating AI assistant for teachers. Uses Gemini or ChatGPT via an authenticated server function. */
export function AiAssistant() {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ask = useServerFn(askAssistant);

  const mut = useMutation({
    mutationFn: async (history: ChatMessage[]) => ask({ data: { messages: history, provider } }),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: "assistant", content: res.reply || "…" }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    },
    onError: (e: Error) => {
      const msg = e.message.includes("RATE_LIMIT") ? t("aiRateLimit") : e.message.includes("CREDITS") ? t("aiCredits") : t("aiError");
      toast.error(msg);
      setMessages((m) => m.slice(0, -1)); // drop the optimistic user turn on hard failure? keep it; just notify
    },
  });

  const send = (text: string) => {
    const value = text.trim();
    if (!value || mut.isPending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: value }];
    setMessages(next);
    setInput("");
    mut.mutate(next);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  return (
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          variant="guru"
          className="fixed bottom-5 right-5 z-50 h-14 gap-2 rounded-full px-5 shadow-magic"
          aria-label={t("aiAssistant")}
        >
          <Bot className="size-5" /> <span className="hidden sm:inline">{t("aiAssistant")}</span>
        </Button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(70vh,560px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-3xl border-2 border-border bg-card shadow-magic">
          <div className="flex items-center justify-between gap-2 border-b-2 border-border bg-gradient-magic px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2 font-display font-bold">
              <Bot className="size-5" /> {t("aiAssistant")}
            </div>
            <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-white/20" onClick={() => setOpen(false)} aria-label="Close">
              <X className="size-5" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-2xl bg-muted/50 p-3 text-sm">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-guru" />
                  <span>{t("aiHint")}</span>
                </div>
                <div className="space-y-2">
                  {(lang === "id" ? SUGGESTIONS_ID : SUGGESTIONS_ID).map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="block w-full rounded-xl border-2 border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-guru hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                    m.role === "user" ? "bg-guru text-white" : "border-2 border-border bg-muted/40",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {mut.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t("aiThinking")}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t-2 border-border p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("aiPlaceholder")}
              disabled={mut.isPending}
            />
            <Button type="submit" size="icon" variant="guru" disabled={mut.isPending || !input.trim()} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
