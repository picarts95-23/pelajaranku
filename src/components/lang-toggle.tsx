import { useLang, LANG_OPTIONS } from "@/lib/i18n";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border-2 border-border bg-card p-1 shadow-soft sm:gap-1">
      <Globe className="mx-1 size-4 shrink-0 text-muted-foreground sm:mx-2" />
      {LANG_OPTIONS.map((opt) => (
        <Button
          variant="ghost"
          size="sm"
          key={opt.code}
          onClick={() => setLang(opt.code)}
          title={opt.native}
          aria-pressed={lang === opt.code}
          className={`h-7 shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-xs font-display font-semibold transition-all sm:px-3 ${
            lang === opt.code
              ? "bg-gradient-magic text-primary-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
