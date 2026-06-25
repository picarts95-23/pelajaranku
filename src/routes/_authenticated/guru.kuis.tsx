import { createFileRoute, redirect } from "@tanstack/react-router";

// "Tugas & Penilaian" has been merged into the Tugas feature. This route now
// permanently redirects to /guru/tugas, where quizzes are graded alongside
// regular assignments (auto-scoring + audio playback & transcription).
export const Route = createFileRoute("/_authenticated/guru/kuis")({
  beforeLoad: () => {
    throw redirect({ to: "/guru/tugas" });
  },
});
