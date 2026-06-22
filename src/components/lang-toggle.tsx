import { useLang, LANG_OPTIONS } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex items-center gap-1 rounded-full border-2 border-border bg-card p-1 shadow-soft">
      <Globe className="mx-2 size-4 text-muted-foreground" />
      {LANG_OPTIONS.map((opt) => (
        <button
          key={opt.code}
          onClick={() => setLang(opt.code)}
          title={opt.native}
          aria-pressed={lang === opt.code}
          className={`rounded-full px-3 py-1 text-xs font-display font-semibold transition-all ${
            lang === opt.code
              ? "bg-gradient-magic text-primary-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
