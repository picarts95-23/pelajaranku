import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "guru" | "siswa";

export interface ProfileRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
  class_name: string | null;
  school_id_number: string | null;
  subject: string | null;
  xp: number;
  level: number;
  coins: number;
  gender?: string | null;
  birthdate?: string | null;
  hobby?: string | null;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  role: AppRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null, user: null, profile: null, role: null,
  loading: true, refresh: async () => {}, signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: r }, { data: priv }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase.from("profile_private").select("school_id_number, gender, birthdate, hobby").eq("id", uid).maybeSingle(),
    ]);
    if (p) {
      setProfile({
        ...(p as Record<string, unknown>),
        school_id_number: priv?.school_id_number ?? null,
        gender: priv?.gender ?? null,
        birthdate: priv?.birthdate ?? null,
        hobby: priv?.hobby ?? null,
      } as ProfileRow);
    } else {
      setProfile(null);
    }
    setRole(((r as { role: AppRole } | null)?.role) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, profile, role, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
