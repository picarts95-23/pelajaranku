import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardShell, PageHeader } from "@/components/dashboard-shell";
import { PracticeGenerator, PracticeTutor } from "@/components/ai-practice";
import type { PracticeQuestion } from "@/lib/ai-practice";

const TITLE = "Latihan AI Siswa · Pelajaranku";
const DESC = "Buat sesi latihan adaptif dengan tutor AI: petunjuk bertahap, umpan balik instan, dan pembahasan langkah demi langkah.";

export const Route = createFileRoute("/_authenticated/siswa/latihan-ai")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC },
    { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SiswaLatihanAi,
});

function SiswaLatihanAi() {
  const [questions, setQuestions] = useState<PracticeQuestion[] | null>(null);
  return (
    <DashboardShell accent="siswa">
      <PageHeader title="Latihan AI" subtitle="Pilih materi, lalu kerjakan soal satu per satu bersama tutor AI." />
      {questions
        ? <PracticeTutor questions={questions} onRestart={() => setQuestions(null)} />
        : <PracticeGenerator onReady={(qs) => setQuestions(qs)} />}
    </DashboardShell>
  );
}
