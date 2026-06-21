import { useLang, type Lang } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex items-center gap-1 rounded-full border-2 border-border bg-card p-1 shadow-soft">
      <Globe className="ml-2 size-4 text-muted-foreground" />
      {(["id", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-full px-3 py-1 text-xs font-display font-semibold transition-all ${
            lang === l
              ? "bg-gradient-magic text-primary-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
