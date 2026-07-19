import { useMemo, useState } from "react";
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ID_HOLIDAYS, type Holiday } from "@/lib/id-holidays";

export type CalendarEvent = {
  id: string;
  title: string;
  start_at: string;
  end_at?: string | null;
  className?: string | null;
  color?: string;
};

type Props = {
  events: CalendarEvent[];
  onSelectEvent?: (id: string) => void;
  lang?: "id" | "en";
};

const DOW_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MonthCalendar({ events, onSelectEvent, lang = "id" }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const arr: Date[] = [];
    for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) arr.push(new Date(d));
    return arr;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = toISODate(new Date(e.start_at));
      const list = m.get(key) ?? [];
      list.push(e);
      m.set(key, list);
    }
    return m;
  }, [events]);

  const holidaysByDay = useMemo(() => {
    const m = new Map<string, Holiday[]>();
    for (const h of ID_HOLIDAYS) {
      const list = m.get(h.date) ?? [];
      list.push(h);
      m.set(h.date, list);
    }
    return m;
  }, []);

  const dow = lang === "id" ? DOW_ID : DOW_EN;
  const selectedISO = selected ? toISODate(selected) : null;
  const selectedEvents = selectedISO ? eventsByDay.get(selectedISO) ?? [] : [];
  const selectedHolidays = selectedISO ? holidaysByDay.get(selectedISO) ?? [] : [];

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-3 shadow-soft sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-display text-lg font-bold sm:text-xl">{format(cursor, "MMMM yyyy")}</div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => { setCursor(startOfMonth(new Date())); setSelected(new Date()); }}>
            {lang === "id" ? "Hari ini" : "Today"}
          </Button>
          <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Prev">
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border-2 border-border bg-border text-xs">
        {dow.map((d, i) => (
          <div key={d} className={`bg-muted px-2 py-1.5 text-center font-display font-bold ${i === 0 ? "text-destructive" : ""}`}>{d}</div>
        ))}
        {days.map((d) => {
          const iso = toISODate(d);
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, new Date());
          const isSelected = selected && isSameDay(d, selected);
          const dayEvents = eventsByDay.get(iso) ?? [];
          const dayHolidays = holidaysByDay.get(iso) ?? [];
          const isSunday = d.getDay() === 0;
          const isHoliday = dayHolidays.length > 0;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(d)}
              className={`min-h-[68px] bg-card p-1.5 text-left transition sm:min-h-[92px] ${
                inMonth ? "" : "opacity-40"
              } ${isSelected ? "ring-2 ring-quest ring-inset" : "hover:bg-muted/50"}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-grid size-6 place-items-center rounded-full text-xs font-display font-bold ${
                    isToday ? "bg-quest text-quest-foreground" : isSunday || isHoliday ? "text-destructive" : ""
                  }`}
                >
                  {d.getDate()}
                </span>
                {isHoliday && <span className="size-1.5 rounded-full bg-destructive" title={dayHolidays[0]!.name} />}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayHolidays.slice(0, 1).map((h) => (
                  <div key={h.name} className="truncate rounded bg-destructive/10 px-1 py-0.5 text-[10px] font-display font-bold text-destructive" title={h.name}>
                    {h.name}
                  </div>
                ))}
                {dayEvents.slice(0, 2).map((e) => (
                  <div key={e.id} className="truncate rounded bg-quest/15 px-1 py-0.5 text-[10px] font-display font-bold text-quest" title={e.title}>
                    • {e.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} {lang === "id" ? "lagi" : "more"}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-quest" /> {lang === "id" ? "Kegiatan Anda" : "Your event"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-destructive" /> {lang === "id" ? "Libur / Hari Raya" : "Holiday"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-muted-foreground/40" /> {lang === "id" ? "Bulan lain" : "Other month"}</span>
      </div>

      {/* Detail hari terpilih */}
      {selected && (
        <div className="mt-3 rounded-xl border-2 border-border bg-background p-3">
          <div className="mb-2 font-display font-bold">
            {format(selected, "EEEE, dd MMMM yyyy")}
          </div>
          {selectedHolidays.length === 0 && selectedEvents.length === 0 && (
            <div className="text-xs text-muted-foreground">
              {lang === "id" ? "Tidak ada kegiatan pada hari ini." : "No events on this day."}
            </div>
          )}
          {selectedHolidays.map((h) => (
            <div key={h.name} className="mb-1 flex items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-display font-bold ${h.kind === "national" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                {h.kind === "national" ? (lang === "id" ? "Libur Nasional" : "National") : (lang === "id" ? "Hari Raya" : "Religious")}
              </span>
              <span>{h.name}</span>
            </div>
          ))}
          {selectedEvents.map((e) => (
            <button
              key={e.id}
              onClick={() => onSelectEvent?.(e.id)}
              className="mt-1 flex w-full items-start gap-2 rounded-lg border border-border bg-card p-2 text-left hover:bg-muted/50"
            >
              <span className="mt-1 size-2 shrink-0 rounded-full bg-quest" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-bold">{e.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {format(new Date(e.start_at), "HH:mm")}
                  {e.end_at ? `–${format(new Date(e.end_at), "HH:mm")}` : ""}
                  {e.className ? ` · ${e.className}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
