import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarClock, Sun } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Dose } from "../lib/types";
import { formatDateLabel, formatTime12, shiftDateKey, todayKey } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Spinner,
} from "../components/ui";
import { DoseActions } from "./Dashboard";

export default function Schedule() {
  const [date, setDate] = useState(todayKey());
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ doses: Dose[] }>(`/api/doses?date=${date}`);
      setDoses(data.doses);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load schedule.");
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayKey();
  // The current day is actionable: pending doses that are not yet due show a
  // "Scheduled" badge, while due/overdue ones expose the TAKEN / SKIP / SNOOZE
  // controls. Only strictly future days are read-only.
  const isFutureDay = date > today;
  const isPast = date < today;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Today's Schedule
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            Your medication timeline for the selected day.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDate((d) => shiftDateKey(d, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDate(today)}
            disabled={date === today}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDate((d) => shiftDateKey(d, 1))}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          title={formatDateLabel(`${date}T12:00:00`)}
          subtitle={
            date === today
              ? "Live schedule — reminders arrive while MediRemind is open."
              : isFutureDay
                ? "Planned doses for an upcoming day."
                : "Past day — pending doses were not recorded."
          }
          icon={date === today ? <Sun className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
        />
        {error && (
          <EmptyState
            icon={<CalendarClock className="h-7 w-7" />}
            title="Could not load the schedule"
            description={error}
            action={<Button onClick={() => void load()}>Try again</Button>}
          />
        )}
        {!doses && !error && (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8 border-2" />
          </div>
        )}
        {doses && doses.length === 0 && (
          <EmptyState
            icon={<CalendarClock className="h-8 w-8" />}
            title="Nothing scheduled"
            description="No doses are scheduled for this day. Add medications to build your schedule."
          />
        )}
        {doses && doses.length > 0 && (
          <ol className="relative space-y-0 divide-y divide-slate-100">
            {doses.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-xs font-bold ${
                      d.status === "TAKEN"
                        ? "bg-emerald-50 text-emerald-700"
                        : d.isOverdue
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-100 text-navy-600"
                    }`}
                  >
                    {formatTime12(d.timeStr).split(" ")[0]}
                    <span className="text-[10px] font-semibold">
                      {formatTime12(d.timeStr).split(" ")[1]}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-navy-900">{d.medication.name}</p>
                    <p className="text-sm text-navy-500">
                      {d.medication.doseAmount} {d.medication.doseUnit} · takes{" "}
                      {d.medication.quantityPerDose} {d.medication.quantityUnit}
                    </p>
                    {d.isSnoozed && d.snoozedUntil && (
                      <p className="mt-0.5 text-xs font-medium text-sky-600">
                        Snoozed until {new Date(d.snoozedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {d.status !== "PENDING" && d.actionAt && (
                      <p className="mt-0.5 text-xs text-navy-400">
                        Recorded {new Date(d.actionAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {d.status === "PENDING" && !isFutureDay ? (
                    <DoseActions dose={d} onDone={load} compact />
                  ) : d.status === "PENDING" ? (
                    <Badge status="SCHEDULED" />
                  ) : (
                    <Badge status={d.status} />
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        {isPast && doses && doses.some((d) => d.status === "PENDING") && (
          <p className="border-t border-slate-100 bg-amber-50/60 px-6 py-3 text-xs text-amber-800">
            Pending doses from past days count as <strong>missed</strong> in your reports — but
            you can still record them as taken if you did take them.
          </p>
        )}
      </Card>
    </div>
  );
}
