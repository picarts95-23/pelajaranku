import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { subject: string; grade: string; topic: string; count: number };

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["objectives"],
  properties: { objectives: { type: "array", items: { type: "object", additionalProperties: false, required: ["code", "description"], properties: { code: { type: "string" }, description: { type: "string" } } } } },
} as const;

export const draftObjectives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input): Input => {
    const subject = String(d?.subject ?? "").trim().slice(0, 100);
    if (!subject) throw new Error("Mata pelajaran wajib diisi");
    return { subject, grade: String(d?.grade ?? "").slice(0, 60), topic: String(d?.topic ?? "").slice(0, 1500), count: Math.min(10, Math.max(1, Number(d?.count) || 5)) };
  })
  .handler(async ({ data }): Promise<{ objectives: { code: string; description: string }[]; error?: string }> => {
    const prompt = `Susun ${data.count} Tujuan Pembelajaran (TP) Kurikulum Merdeka dalam Bahasa Indonesia.
Mata pelajaran: ${data.subject}
Kelas/Fase: ${data.grade || "-"}
Materi/Capaian Pembelajaran: ${data.topic || "-"}
Aturan: setiap TP diawali kata kerja operasional terukur (mis. menjelaskan, menganalisis, menghitung), satu kalimat ringkas tanpa kata "Peserta didik mampu" dan tanpa titik di akhir. "code" berformat TP1, TP2, dst. Kembalikan JSON.`;
    try {
      const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!geminiKey) return { objectives: [], error: "Fitur AI belum aktif. Admin perlu mengisi GOOGLE_API_KEY (Gemini)." };
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "Kamu ahli kurikulum sekolah Indonesia." }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseJsonSchema: SCHEMA },
        }),
      });
      if (r.status === 429) return { objectives: [], error: "Kuota Gemini sedang penuh. Coba lagi sebentar." };
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        console.error("draftObjectives gemini", r.status, await r.text());
        return { objectives: [], error: "API key Gemini ditolak. Periksa kembali key-nya." };
      }
      if (!r.ok) throw new Error(`gemini ${r.status}: ${await r.text()}`);
      const j: any = await r.json();
      const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
      const list = (JSON.parse(text || "{}").objectives ?? [])
        .map((o: any) => ({ code: String(o.code ?? "").trim().slice(0, 20), description: String(o.description ?? "").trim().slice(0, 500) }))
        .filter((o: any) => o.description);
      if (!list.length) return { objectives: [], error: "AI belum menghasilkan TP. Coba lagi." };
      return { objectives: list.slice(0, data.count) };
    } catch (e) {
      console.error("draftObjectives", e);
      return { objectives: [], error: "Gagal membuat draft TP." };
    }
  });
