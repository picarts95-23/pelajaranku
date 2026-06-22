import { Link2, Gamepad2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/lib/i18n";

/** Inputs for an external question link and a game link. */
export function LinkFields({
  quizLink,
  gameLink,
  onQuiz,
  onGame,
}: {
  quizLink: string;
  gameLink: string;
  onQuiz: (v: string) => void;
  onGame: (v: string) => void;
}) {
  const { lang } = useLang();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label className="flex items-center gap-1.5"><Link2 className="size-3.5 text-primary" /> {lang === "id" ? "Link Soal" : "Question Link"}</Label>
        <Input type="url" inputMode="url" value={quizLink} onChange={(e) => onQuiz(e.target.value)} placeholder="https://quizizz.com/…" />
      </div>
      <div>
        <Label className="flex items-center gap-1.5"><Gamepad2 className="size-3.5 text-accent" /> {lang === "id" ? "Link Permainan" : "Game Link"}</Label>
        <Input type="url" inputMode="url" value={gameLink} onChange={(e) => onGame(e.target.value)} placeholder="https://wordwall.net/…" />
      </div>
    </div>
  );
}

/** Clickable badges that open the question/game links in a new tab. */
export function LinkBadges({ quizLink, gameLink }: { quizLink?: string | null; gameLink?: string | null }) {
  const { lang } = useLang();
  if (!quizLink && !gameLink) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {quizLink && (
        <a
          href={quizLink}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-display font-bold text-primary hover:bg-primary/20"
        >
          <Link2 className="size-3.5" /> {lang === "id" ? "Buka Soal" : "Open Quiz"}
        </a>
      )}
      {gameLink && (
        <a
          href={gameLink}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-display font-bold text-accent hover:bg-accent/20"
        >
          <Gamepad2 className="size-3.5" /> {lang === "id" ? "Main Game" : "Play Game"}
        </a>
      )}
    </div>
  );
}
