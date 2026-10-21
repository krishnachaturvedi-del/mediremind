import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  Pill,
  AlertTriangle,
  RefreshCcw,
  Clock,
  SkipForward,
  Plus,
  Sun,
  MoonStar,
  History,
  Boxes,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { DashboardData, Dose } from "../lib/types";
import { formatTime12, relativeTime } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Spinner,
  StatCard,
  useToast,
} from "../components/ui";

export function DoseActions({
  dose,
  onDone,
  compact = false,
}: {
  dose: Dose;
  onDone: () => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (action: "TAKEN" | "SKIPPED" | "SNOOZE") => {
    setBusy(action);
    try {
      await api.post(`/api/doses/${dose.id}/action`, {
        action,
        ...(action === "SNOOZE" ? { snoozeMinutes: 10 } : {}),
      });
      toast.push(
        action === "TAKEN"
          ? `${dose.medication.name} marked as taken.`
          : action === "SKIPPED"
            ? `${dose.medication.name} marked as skipped.`
            : `Reminder snoozed for 10 minutes.`,
        action === "SKIPPED" ? "info" : "success"
      );
      onDone();
    } catch (err) {
      toast.push(
        err instanceof ApiError ? err.message : "Could not record the dose. Try again.",
        "error"
      );
      onDone();
    } finally {
      setBusy(null);
    }
  };

  const size = compact ? "sm" : "md";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="success"
        size={size}
        loading={busy === "TAKEN"}
        onClick={() => void act("TAKEN")}
        aria-label={`Mark ${dose.medication.name} dose as taken`}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Taken
      </Button>
      <Button
        variant="secondary"
        size={size}
        loading={busy === "SKIPPED"}
        onClick={() => void act("SKIPPED")}
        aria-label={`Skip ${dose.medication.name} dose`}
      >
        <SkipForward className="h-4 w-4" aria-hidden /> Skip
      </Button>
      <Button
        variant="ghost"
        size={size}
        loading={busy === "SNOOZE"}
        onClick={() => void act("SNOOZE")}
        aria-label={`Snooze ${dose.medication.name} reminder for 10 minutes`}
      >
        <Clock className="h-4 w-4" aria-hidden /> Snooze 10 min
      </Button>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<DashboardData>("/api/dashboard"));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7" />}
          title="Could not load your dashboard"
          description={error}
          action={<Button onClick={() => void load()}>Try again</Button>}
        />
      </Card>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8 border-2" />
      </div>
    );
  }

  const todayDoses = data.schedule.doses;
  const now = new Date();
  const isNight = now.getHours() >= 18 || now.getHours() < 6;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            {greeting()}, {data.user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-navy-500">
            {isNight ? <MoonStar className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
            {data.date.label}
          </p>
        </div>
        <Link to="/app/medications">
          <Button>
            <Plus className="h-4 w-4" aria-hidden /> Add medication
          </Button>
        </Link>
      </div>

      {!data.hasMedications ? (
        <Card>
          <EmptyState
            icon={<Pill className="h-8 w-8" />}
            title="Add your first medication"
            description="Track doses, remaining quantities and refills. Add a medication to see today's schedule, reminders and inventory here."
            action={
              <Link to="/app/medications">
                <Button size="lg">
                  <Plus className="h-4 w-4" aria-hidden /> Add medication
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Doses taken today"
              value={`${data.schedule.taken}/${data.schedule.total}`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Pending doses"
              value={data.schedule.pending}
              sub={data.schedule.overdue > 0 ? `${data.schedule.overdue} overdue` : undefined}
              icon={<CalendarClock className="h-5 w-5" />}
              tone={data.schedule.overdue > 0 ? "danger" : "warning"}
            />
            <StatCard
              label="Active medications"
              value={data.medications.active}
              sub={data.medications.paused > 0 ? `${data.medications.paused} paused` : undefined}
              icon={<Pill className="h-5 w-5" />}
              tone="accent"
            />
            <StatCard
              label="Pending refills"
              value={data.refills.pendingCount}
              sub={data.inventory.lowStockCount > 0 ? `${data.inventory.lowStockCount} low stock` : undefined}
              icon={<RefreshCcw className="h-5 w-5" />}
              tone={data.inventory.lowStockCount > 0 ? "warning" : "neutral"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Today's schedule */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="Today's schedule"
                subtitle={`${data.schedule.skipped} skipped · ${data.schedule.pending} pending`}
                icon={<CalendarClock className="h-5 w-5" />}
                action={
                  <Link to="/app/schedule" className="text-sm font-semibold text-teal-600 hover:underline">
                    Full schedule
                  </Link>
                }
              />
              <div className="divide-y divide-slate-100">
                {todayDoses.length === 0 && (
                  <p className="px-6 py-10 text-center text-sm text-navy-400">
                    No doses scheduled today.
                  </p>
                )}
                {todayDoses.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3.5">
                      <div className="w-16 text-center">
                        <p className="text-sm font-bold text-navy-900">{formatTime12(d.timeStr)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-navy-900">{d.medication.name}</p>
                        <p className="text-sm text-navy-500">
                          {d.medication.doseAmount} {d.medication.doseUnit} · {d.medication.currentQuantity}{" "}
                          {d.medication.quantityUnit} left
                        </p>
                        {d.isSnoozed && d.snoozedUntil && (
                          <p className="mt-0.5 text-xs font-medium text-sky-600">
                            Snoozed until {formatTime12(new Date(d.snoozedUntil).toTimeString().slice(0, 5))}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.status === "PENDING" ? (
                        <DoseActions dose={d} onDone={load} compact />
                      ) : (
                        <Badge status={d.status} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Next dose */}
            <div className="space-y-6">
              <Card className="overflow-hidden">
                <div className={`px-5 py-5 ${data.nextDose?.isOverdue ? "bg-red-50" : "bg-teal-50/60"}`}>
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-navy-400">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {data.nextDose?.isOverdue ? "Overdue dose" : "Next dose"}
                  </p>
                  {data.nextDose ? (
                    <>
                      <p className="mt-2 text-xl font-bold text-navy-900">
                        {data.nextDose.medication.name}
                      </p>
                      <p className="mt-0.5 text-sm text-navy-500">
                        {data.nextDose.medication.doseAmount} {data.nextDose.medication.doseUnit} at{" "}
                        {formatTime12(data.nextDose.time)}
                      </p>
                      <div className="mt-4">
                        <DoseActions dose={data.nextDose as unknown as Dose} onDone={load} compact />
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-navy-500">
                      All scheduled doses for today are recorded. 🎉
                    </p>
                  )}
                </div>
              </Card>

              {/* Low stock */}
              <Card>
                <CardHeader
                  title="Inventory warnings"
                  icon={<Boxes className="h-5 w-5" />}
                  action={
                    <Link to="/app/inventory" className="text-sm font-semibold text-teal-600 hover:underline">
                      Inventory
                    </Link>
                  }
                />
                {data.inventory.lowStockCount === 0 ? (
                  <p className="px-6 py-6 text-sm text-navy-400">All medicines are comfortably in stock.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.inventory.lowStock.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                        <div className="flex items-center gap-2.5">
                          <AlertTriangle
                            className={`h-4 w-4 ${m.status === "REFILL_REQUIRED" ? "text-red-500" : "text-amber-500"}`}
                            aria-hidden
                          />
                          <div>
                            <p className="text-sm font-semibold text-navy-900">{m.name}</p>
                            <p className="text-xs text-navy-400">
                              {m.currentQuantity} {m.quantityUnit} left · threshold {m.refillThreshold}
                            </p>
                          </div>
                        </div>
                        <Badge status={m.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upcoming */}
            <Card>
              <CardHeader title="Upcoming reminders" icon={<CalendarClock className="h-5 w-5" />} />
              {data.upcoming.length === 0 ? (
                <p className="px-6 py-6 text-sm text-navy-400">Nothing else scheduled today.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.upcoming.map((u) => (
                    <li key={u.id} className="flex items-center justify-between px-5 py-3.5 sm:px-6">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{u.medication.name}</p>
                        <p className="text-xs text-navy-400">
                          {u.medication.doseAmount} {u.medication.doseUnit}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                        {formatTime12(u.time)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Recent activity */}
            <Card>
              <CardHeader
                title="Recent medication activity"
                icon={<History className="h-5 w-5" />}
                action={
                  <Link to="/app/history" className="text-sm font-semibold text-teal-600 hover:underline">
                    History
                  </Link>
                }
              />
              {data.recentActivity.length === 0 ? (
                <p className="px-6 py-6 text-sm text-navy-400">
                  Doses you record will appear here.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-5 py-3.5 sm:px-6">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{a.medication}</p>
                        <p className="text-xs text-navy-400">
                          {a.actionAt ? relativeTime(a.actionAt) : ""}
                          {a.quantityDelta < 0 ? ` · ${Math.abs(a.quantityDelta)} used` : ""}
                        </p>
                      </div>
                      <Badge status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Pending refill requests */}
          {data.refills.pendingCount > 0 && (
            <Card>
              <CardHeader
                title="Pending refill requests"
                icon={<RefreshCcw className="h-5 w-5" />}
                action={
                  <Link to="/app/refills" className="text-sm font-semibold text-teal-600 hover:underline">
                    Manage refills
                  </Link>
                }
              />
              <ul className="divide-y divide-slate-100">
                {data.refills.recent
                  .filter((r) => r.status !== "COMPLETED" && r.status !== "REJECTED" && r.status !== "CANCELLED")
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between px-5 py-3.5 sm:px-6">
                      <p className="text-sm font-semibold text-navy-900">{r.medication}</p>
                      <div className="flex items-center gap-3">
                        <Badge status={r.status} />
                        <span className="text-xs text-navy-400">{relativeTime(r.updatedAt)}</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
