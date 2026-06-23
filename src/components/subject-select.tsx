import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export interface TeacherSubject {
  id: string;
  name: string;
}

/** Query hook for the current teacher's subjects. */
export function useTeacherSubjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["teacher-subjects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_subjects")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as TeacherSubject[];
    },
  });
}

/**
 * Subject picker bound to the teacher's saved subjects.
 * A teacher can teach multiple subjects; new subjects are added inline and saved.
 */
export function SubjectSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const { data: subjects = [] } = useTeacherSubjects();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const addMut = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("not signed in");
      const trimmed = name.trim();
      if (!trimmed) throw new Error(lang === "id" ? "Nama mapel kosong" : "Empty subject name");
      const { error } = await supabase
        .from("teacher_subjects")
        .insert({ teacher_id: user.id, name: trimmed });
      if (error && error.code !== "23505") throw error; // ignore duplicate
      return trimmed;
    },
    onSuccess: (name) => {
      qc.invalidateQueries({ queryKey: ["teacher-subjects"] });
      onChange(name);
      setDraft("");
      setAdding(false);
      toast.success(lang === "id" ? "Mata pelajaran ditambahkan" : "Subject added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? (lang === "id" ? "Pilih mata pelajaran" : "Select subject")} />
        </SelectTrigger>
        <SelectContent>
          {subjects.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {lang === "id" ? "Belum ada mapel — tambahkan di bawah" : "No subjects yet — add below"}
            </div>
          ) : (
            subjects.map((s) => (
              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMut.mutate(draft); } }}
            placeholder={lang === "id" ? "Nama mapel baru…" : "New subject…"}
          />
          <Button type="button" size="icon" variant="guru" disabled={addMut.isPending || !draft.trim()} onClick={() => addMut.mutate(draft)}>
            {addMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }}>
            {lang === "id" ? "Batal" : "Cancel"}
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> {lang === "id" ? "Tambah mata pelajaran" : "Add subject"}
        </Button>
      )}
    </div>
  );
}

/**
 * Multi-select for the teacher's subjects. A class can have several subjects;
 * selected ones are toggle chips, and new subjects can be added inline.
 */
export function MultiSubjectSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { user } = useAuth();
  const { lang } = useLang();
  const qc = useQueryClient();
  const { data: subjects = [] } = useTeacherSubjects();
  const [draft, setDraft] = useState("");

  const toggle = (name: string) =>
    onChange(value.includes(name) ? value.filter((s) => s !== name) : [...value, name]);

  const addMut = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("not signed in");
      const trimmed = name.trim();
      if (!trimmed) throw new Error(lang === "id" ? "Nama mapel kosong" : "Empty subject name");
      const { error } = await supabase
        .from("teacher_subjects")
        .insert({ teacher_id: user.id, name: trimmed });
      if (error && error.code !== "23505") throw error; // ignore duplicate
      return trimmed;
    },
    onSuccess: (name) => {
      qc.invalidateQueries({ queryKey: ["teacher-subjects"] });
      if (!value.includes(name)) onChange([...value, name]);
      setDraft("");
      toast.success(lang === "id" ? "Mata pelajaran ditambahkan" : "Subject added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      {subjects.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => {
            const active = value.includes(s.name);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.name)}
                className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-sm font-display font-semibold transition ${
                  active ? "border-guru bg-guru/15 text-guru" : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {active && <Check className="size-3.5" />} {s.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {lang === "id" ? "Belum ada mapel — tambahkan di bawah." : "No subjects yet — add below."}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMut.mutate(draft); } }}
          placeholder={lang === "id" ? "Tambah mapel baru…" : "Add new subject…"}
        />
        <Button type="button" size="icon" variant="guru" disabled={addMut.isPending || !draft.trim()} onClick={() => addMut.mutate(draft)}>
          {addMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
