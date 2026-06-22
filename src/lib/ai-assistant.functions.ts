import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type AskInput = { messages: ChatMessage[] };

function parseInput(input: unknown): AskInput {
  const data = input as Partial<AskInput> | undefined;
  if (!data || !Array.isArray(data.messages)) throw new Error("messages required");
  const messages = data.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (messages.length === 0) throw new Error("messages required");
  return { messages };
}

const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk guru di aplikasi EduQuest Academy (sekolah Islam).
Bantu guru dengan: membuat soal & kunci jawaban, rencana pembelajaran (RPP), ide tugas dan misi,
rubrik penilaian, materi ajar, serta umpan balik untuk siswa.
Jawab ringkas, terstruktur (gunakan poin/markdown bila perlu), dan dalam Bahasa Indonesia
kecuali guru memintanya dalam bahasa lain. Bila relevan, kaitkan dengan nilai-nilai Islami yang baik.`;

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI_UNAVAILABLE");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (res.status === 402) throw new Error("CREDITS");
    if (!res.ok) throw new Error("AI_ERROR");

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { reply };
  });
