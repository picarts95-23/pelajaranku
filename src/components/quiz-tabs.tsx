import { Link } from "@tanstack/react-router";
import { Database, FileQuestion, BarChart3 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shared sub-navigation that presents Bank Soal, Tugas/Kuis and Laporan as ONE feature.
 * `active` highlights the current tab.
 */
export function QuizTabs({ active }: { active: "bank" | "tugas" | "laporan" }) {
  const { lang } = useLang();
  const tabs = [
    {
      key: "bank" as const,
      to: "/guru/bank-soal",
      icon: Database,
      label: lang === "id" ? "Buat Soal & Kirim" : "Build & Send",
    },
    {
      key: "tugas" as const,
      to: "/guru/kuis",
      icon: FileQuestion,
      label: lang === "id" ? "Hasil & Penilaian" : "Results & Grading",
    },
    {
      key: "laporan" as const,
      to: "/guru/laporan",
      icon: BarChart3,
      label: lang === "id" ? "Laporan Progres" : "Progress Report",
    },
  ];

  return (
    <div className="mb-5 inline-flex rounded-2xl border-2 border-border bg-muted/40 p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            to={tab.to}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-display font-bold transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
