// Curated, attractive emoji set for gamification badges.
export const BADGE_EMOJIS: { label: string; emojis: string[] }[] = [
  {
    label: "Penghargaan",
    emojis: ["🏅", "🥇", "🥈", "🥉", "🏆", "🎖️", "🏵️", "👑", "💎", "🎗️"],
  },
  {
    label: "Bintang & Magic",
    emojis: ["⭐", "🌟", "✨", "💫", "🌠", "🔥", "⚡", "💥", "🌈", "🎇"],
  },
  {
    label: "Semangat",
    emojis: ["🚀", "🎯", "🎓", "📚", "🧠", "💡", "🔬", "🧪", "📈", "🏁"],
  },
  {
    label: "Karakter",
    emojis: ["🦁", "🐯", "🦅", "🦉", "🐉", "🦄", "🐺", "🦊", "🐝", "🦋"],
  },
  {
    label: "Hati & Sosial",
    emojis: ["❤️", "💪", "🤝", "🙌", "👏", "🫶", "😊", "🥳", "🎉", "🤩"],
  },
  {
    label: "Islami",
    emojis: ["🕌", "📖", "🤲", "☪️", "🌙", "🕋", "📿", "✝️", "🌿", "💚"],
  },
];

export const ALL_BADGE_EMOJIS = BADGE_EMOJIS.flatMap((g) => g.emojis);
