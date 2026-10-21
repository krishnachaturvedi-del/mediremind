import { useCallback, useEffect, useState } from "react";
import {
  History,
  Download,
  TrendingUp,
  CheckCircle2,
  SkipForward,
  XCircle,
  Clock3,
  RefreshCcw,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Medication, ReportRow, ReportSummary, RefillRequest } from "../lib/types";
import { formatDateLabel, shiftDateKey, todayKey } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Label,
  Select,
  Spinner,
} from "../components/ui";

interface TrendPoint {
  date: string;
  taken: number;
  skipped: number;
  pending: number;
}

export default function HistoryPage() {
  const today = todayKey();
  const [from, setFrom] = useState(shiftDateKey(today, -6));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("ALL");
  const [medicationId, setMedicationId] = useState("ALL");
  const [meds, setMeds] = useState<Medication[]>([]);
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [refillTx, setRefillTx] = useState<
    { id: string; quantitySupplied: number; confirmedAt: string; medication: { name: string; quantityUnit: string } }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ from, to });
      if (status !== "ALL") q.set("status", status);
      if (medicationId !== "ALL") q.set("medicationId", medicationId);
      const [report, trendData, refillData] = await Promise.all([
        api.get<{ rows: ReportRow[]; summary: ReportSummary }>(`/api/reports/doses?${q}`),
        api.get<{ trend: TrendPoint[] }>("/api/reports/trend?days=14"),
        api.get<{ transactions: typeof refillTx }>(`/api/reports/refills?${q}`),
      ]);
      setRows(report.rows);
      setSummary(report.summary);
      setTrend(trendData.trend);
      setRefillTx(refillData.transactions);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the report.");
    }
  }, [from, to, status, medicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api
      .get<{ medications: Medication[] }>("/api/medications")
      .then((d) => setMeds(d.medications))
      .catch(() => setMeds([]));
  }, []);

  const csvHref = () => {
    const q = new URLSearchParams({ from, to });
    if (status !== "ALL") q.set("status", status);
    if (medicationId !== "ALL") q.set("medicationId", medicationId);
    return `/api/reports/doses.csv?${q}`;
  };

  const maxTrend = Math.max(1, ...trend.map((t) => t.taken + t.skipped + t.pending));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Dose History &amp; Reports
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            Adherence is calculated from recorded doses. Future doses are never counted as missed.
          </p>
        </div>
        <a
          href={csvHref()}
          download
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden /> Export CSV
        </a>
      </div>

      {/* Filters */}
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="TAKEN">Taken</option>
              <option value="SKIPPED">Skipped</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="med">Medication</Label>
            <Select id="med" value={medicationId} onChange={(e) => setMedicationId(e.target.value)}>
              <option value="ALL">All medications</option>
              {meds.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {error && (
        <Card>
          <EmptyState
            icon={<XCircle className="h-7 w-7" />}
            title="Could not load the report"
            description={error}
            action={<Button onClick={() => void load()}>Try again</Button>}
          />
        </Card>
      )}

      {!summary && !error && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 border-2" />
        </div>
      )}

      {summary && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <SummaryTile label="Adherence" value={summary.adherencePercent != null ? `${summary.adherencePercent}%` : "—"} icon={<TrendingUp className="h-5 w-5" />} tone="accent" />
            <SummaryTile label="Taken" value={summary.taken} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
            <SummaryTile label="Skipped" value={summary.skipped} icon={<SkipForward className="h-5 w-5" />} tone="neutral" />
            <SummaryTile label="Missed" value={summary.missed} icon={<XCircle className="h-5 w-5" />} tone="danger" />
            <SummaryTile label="Overdue now" value={summary.overdue} icon={<Clock3 className="h-5 w-5" />} tone="warning" />
          </div>

          {/* Trend chart */}
          <Card>
            <CardHeader title="Last 14 days" subtitle="Recorded doses per day" icon={<TrendingUp className="h-5 w-5" />} />
            <div className="flex items-end gap-1.5 px-6 pb-6 pt-4 sm:gap-2" role="img" aria-label="Bar chart of doses over the last 14 days">
              {trend.map((t) => (
                <div key={t.date} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-col justify-end gap-0.5" style={{ height: 96 }}>
                    {t.pending > 0 && (
                      <div
                        className="w-full rounded-t bg-amber-300"
                        style={{ height: `${(t.pending / maxTrend) * 96}px` }}
                        title={`${t.pending} pending`}
                      />
                    )}
                    {t.skipped > 0 && (
                      <div
                        className="w-full bg-slate-300"
                        style={{ height: `${(t.skipped / maxTrend) * 96}px` }}
                        title={`${t.skipped} skipped`}
                      />
                    )}
                    {t.taken > 0 && (
                      <div
                        className="w-full bg-teal-500"
                        style={{ height: `${(t.taken / maxTrend) * 96}px` }}
                        title={`${t.taken} taken`}
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-navy-400">
                    {Number(t.date.slice(8))}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 border-t border-slate-100 px-6 py-3 text-xs text-navy-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Taken</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Skipped</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-300" /> Pending</span>
            </div>
          </Card>

          {/* Detailed log */}
          <Card>
            <CardHeader
              title="Dose log"
              subtitle={`${formatDateLabel(`${from}T12:00:00`)} → ${formatDateLabel(`${to}T12:00:00`)}`}
              icon={<History className="h-5 w-5" />}
            />
            {!rows || rows.length === 0 ? (
              <EmptyState
                icon={<History className="h-8 w-8" />}
                title="No doses in this range"
                description="Adjust the filters or record some doses to build your history."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-navy-400">
                      <th className="px-5 py-3 sm:px-6">Date</th>
                      <th className="px-3 py-3">Time</th>
                      <th className="px-3 py-3">Medication</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Recorded</th>
                      <th className="px-5 py-3 sm:px-6 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.slice(0, 200).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3 sm:px-6 text-navy-700">{r.dateKey}</td>
                        <td className="px-3 py-3 text-navy-500">{r.time}</td>
                        <td className="px-3 py-3 font-medium text-navy-900">{r.medication.name}</td>
                        <td className="px-3 py-3">
                          <Badge status={r.effectiveStatus} />
                        </td>
                        <td className="px-3 py-3 text-navy-400">
                          {r.actionAt
                            ? new Date(r.actionAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-right sm:px-6">
                          {r.quantityDelta < 0 ? (
                            <span className="font-medium text-red-600">{r.quantityDelta}</span>
                          ) : (
                            <span className="text-navy-300">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 200 && (
                  <p className="border-t border-slate-100 px-6 py-3 text-xs text-navy-400">
                    Showing the 200 most recent of {rows.length} entries — export CSV for the full log.
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Refill transactions */}
          <Card>
            <CardHeader
              title="Refill transactions"
              subtitle="Confirmed refills in this range"
              icon={<RefreshCcw className="h-5 w-5" />}
            />
            {refillTx.length === 0 ? (
              <p className="px-6 py-6 text-sm text-navy-400">No confirmed refills in this range.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {refillTx.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-3.5 sm:px-6">
                    <div>
                      <p className="text-sm font-semibold text-navy-900">{t.medication.name}</p>
                      <p className="text-xs text-navy-400">
                        Confirmed{" "}
                        {new Date(t.confirmedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                      +{t.quantitySupplied} {t.medication.quantityUnit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-navy-50 text-navy-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    accent: "bg-teal-50 text-teal-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-navy-500">{label}</p>
        <span className={`rounded-lg p-1.5 ${tones[tone]}`} aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold text-navy-900">{value}</p>
    </Card>
  );
}

export type { RefillRequest };
