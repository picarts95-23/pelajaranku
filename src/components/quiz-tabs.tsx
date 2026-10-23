import { Link } from "@tanstack/react-router";
import { Database, FileQuestion } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Shared sub-navigation linking the question library (Bank Soal) and the
 * Tugas/Kuis grading hub (Results & Grading). The progress report now lives
 * inside Rekap Nilai, so it is no longer a tab here.
 */
export function QuizTabs({ active }: { active: "bank" | "tugas" }) {
  const { lang } = useLang();
  const tabs = [
    {
      key: "bank" as const,
      to: "/guru/bank-soal",
      icon: Database,
      label: lang === "id" ? "Bank Soal (Perpustakaan)" : "Question Bank",
    },
    {
      key: "tugas" as const,
      to: "/guru/tugas",
      icon: FileQuestion,
      label: lang === "id" ? "Tugas & Penilaian" : "Tasks & Grading",
    },
  ];

  return (
    <div className="mb-5 grid w-full min-w-0 grid-cols-2 rounded-2xl border-2 border-border bg-muted/40 p-1 sm:inline-flex sm:w-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            to={tab.to}
            className={cn(
              "inline-flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 text-xs font-display font-bold transition-colors sm:px-4 sm:text-sm",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
