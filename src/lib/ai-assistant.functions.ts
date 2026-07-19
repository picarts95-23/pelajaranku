import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type AiProvider = "gemini" | "openai";

type AskInput = { messages: ChatMessage[]; provider: AiProvider };

function parseInput(input: unknown): AskInput {
  const data = input as Partial<AskInput> | undefined;
  if (!data || !Array.isArray(data.messages)) throw new Error("messages required");
  const messages = data.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (messages.length === 0) throw new Error("messages required");
  const provider: AiProvider = data.provider === "openai" ? "openai" : "gemini";
  return { messages, provider };
}

const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk guru di aplikasi Pelajaranku (sekolah Islam).
Bantu guru dengan: membuat soal & kunci jawaban, rencana pembelajaran (RPP), ide tugas dan misi,
rubrik penilaian, materi ajar, serta umpan balik untuk siswa.
Jawab ringkas, terstruktur (gunakan poin/markdown bila perlu), dan dalam Bahasa Indonesia
kecuali guru memintanya dalam bahasa lain. Bila relevan, kaitkan dengan nilai-nilai Islami yang baik.`;

/** OpenAI-compatible chat (OpenAI direct, or Lovable AI gateway). */
async function chatOpenAiCompatible(baseUrl: string, key: string, model: string, messages: ChatMessage[]) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages] }),
  });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("CREDITS");
  if (!res.ok) throw new Error("AI_ERROR");
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Google Gemini native API. */
async function chatGeminiNative(key: string, model: string, messages: ChatMessage[]) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      }),
    },
  );
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error("AI_ERROR");
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isGuru } = await supabase.rpc("has_role", { _user_id: userId, _role: "guru" });
    if (!isGuru) throw new Error("FORBIDDEN");

    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    let reply = "";
    if (data.provider === "openai") {
      if (openaiKey) {
        reply = await chatOpenAiCompatible("https://api.openai.com/v1", openaiKey, "gpt-4o-mini", data.messages);
      } else if (lovableKey) {
        reply = await chatOpenAiCompatible("https://ai.gateway.lovable.dev/v1", lovableKey, "openai/gpt-5-mini", data.messages);
      } else {
        throw new Error("AI_UNAVAILABLE");
      }
    } else {
      if (geminiKey) {
        reply = await chatGeminiNative(geminiKey, "gemini-2.0-flash", data.messages);
      } else if (lovableKey) {
        reply = await chatOpenAiCompatible("https://ai.gateway.lovable.dev/v1", lovableKey, "google/gemini-3-flash-preview", data.messages);
      } else {
        throw new Error("AI_UNAVAILABLE");
      }
    }
    return { reply };
  });
