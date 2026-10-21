import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Link2, RefreshCcw, Send, XCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { InventoryItem, Medication, RefillAlert, RefillRequest } from "../lib/types";
import { formatDateTime, relativeTime } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  FormError,
  Input,
  Label,
  Modal,
  Select,
  Spinner,
  StatCard,
  Textarea,
  useToast,
} from "../components/ui";

const CANCELLABLE = ["PENDING", "ACCEPTED"];

export default function RefillsPage() {
  const toast = useToast();
  const [requests, setRequests] = useState<RefillRequest[] | null>(null);
  const [alerts, setAlerts] = useState<RefillAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ requests: RefillRequest[]; alerts: RefillAlert[] }>("/api/refills");
      setRequests(data.requests);
      setAlerts(data.alerts);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load refill requests.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      await api.post(`/api/refills/${id}/cancel`);
      toast.push("Refill request cancelled.", "info");
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not cancel the request.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const openAlerts = alerts.filter((a) => a.status === "OPEN");
  const active = requests?.filter((r) => CANCELLABLE.includes(r.status)) ?? [];
  const done = requests?.filter((r) => !CANCELLABLE.includes(r.status)) ?? [];

  if (error && !requests) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7" />}
          title="Could not load refills"
          description={error}
          action={<Button onClick={() => void load()}>Try again</Button>}
        />
      </Card>
    );
  }

  if (!requests) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8 border-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Refill Management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-500">
            Requests go to your linked chemist. Stock increases only when the chemist completes the
            refill and the transaction is confirmed.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Send className="h-4 w-4" aria-hidden /> New refill request
        </Button>
      </div>

      <FormError error={error} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active requests"
          value={active.length}
          icon={<RefreshCcw className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          label="Open stock alerts"
          value={openAlerts.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={openAlerts.length > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Completed"
          value={requests.filter((r) => r.status === "COMPLETED").length}
          icon={<RefreshCcw className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Rejected / cancelled"
          value={requests.filter((r) => r.status === "REJECTED" || r.status === "CANCELLED").length}
          icon={<XCircle className="h-5 w-5" />}
          tone="danger"
        />
      </div>

      {openAlerts.length > 0 && (
        <Card>
          <CardHeader
            title="Stock alerts"
            subtitle="Raised automatically when a medicine hits its refill threshold"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <ul className="divide-y divide-slate-100">
            {openAlerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 sm:px-6">
                <div>
                  <p className="text-sm font-semibold text-navy-900">{a.medication.name}</p>
                  <p className="text-xs text-navy-400">
                    {a.quantityAtTrigger} {a.medication.quantityUnit} left at trigger · threshold{" "}
                    {a.threshold} · {formatDateTime(a.triggeredAt)}
                  </p>
                </div>
                <Badge status="REFILL_REQUIRED" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Active requests"
          subtitle="Waiting on your chemist"
          icon={<RefreshCcw className="h-5 w-5" />}
        />
        {active.length === 0 ? (
          <EmptyState
            icon={<RefreshCcw className="h-8 w-8" />}
            title="No active refill requests"
            description="Request a refill when a medicine runs low — it will appear here until the chemist completes it."
            action={<Button onClick={() => setShowNew(true)}>Request a refill</Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((r) => (
              <li key={r.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-navy-900">{r.medication.name}</p>
                      <Badge status={r.status} />
                      {r.origin === "AUTO" && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                          Auto-raised
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-navy-400">
                      {r.quantityRequested
                        ? `Requested ${r.quantityRequested} ${r.medication.quantityUnit} · `
                        : ""}
                      {r.chemistShop
                        ? `${r.chemistShop.name}, ${r.chemistShop.address}`
                        : "No chemist linked"}{" "}
                      · requested {relativeTime(r.createdAt)}
                    </p>
                    {r.patientNote && (
                      <p className="mt-1 text-xs italic text-navy-500">“{r.patientNote}”</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyId === r.id}
                    onClick={() => void cancel(r.id)}
                  >
                    Cancel request
                  </Button>
                </div>
                <ProgressRail status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="History" subtitle="Past and completed requests" icon={<RefreshCcw className="h-5 w-5" />} />
        {done.length === 0 ? (
          <p className="px-6 py-6 text-sm text-navy-400">No refill history yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-navy-900">{r.medication.name}</p>
                    <Badge status={r.status} />
                  </div>
                  <p className="mt-1 text-xs text-navy-400">
                    {r.transactions.length > 0
                      ? `Confirmed +${r.transactions.reduce((s, t) => s + t.quantitySupplied, 0)} ${r.medication.quantityUnit} added`
                      : "No stock added"}
                    {r.rejectReason ? ` · ${r.rejectReason}` : ""} · {formatDateTime(r.updatedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <NewRequestModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={() => {
          setShowNew(false);
          void load();
        }}
      />
    </div>
  );
}

function ProgressRail({ status }: { status: RefillRequest["status"] }) {
  const steps = ["PENDING", "ACCEPTED", "READY", "COMPLETED"] as const;
  const reached = status === "REJECTED" || status === "CANCELLED" ? 0 : steps.indexOf(status) + 1;
  if (status === "REJECTED" || status === "CANCELLED") return null;
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-label={`Progress: ${status}`}>
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col gap-1">
          <div className={`h-1.5 rounded-full ${i < reached ? "bg-teal-500" : "bg-slate-200"}`} />
          <span className={`text-[10px] font-semibold ${i < reached ? "text-teal-700" : "text-navy-300"}`}>
            {s === "READY" ? "Ready" : s.charAt(0) + s.slice(1).toLowerCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

function NewRequestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [medicationId, setMedicationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setQuantity("");
    setError(null);
    void Promise.all([
      api.get<{ medications: Medication[] }>("/api/medications"),
      api.get<{ inventory: InventoryItem[] }>("/api/inventory"),
    ])
      .then(([m, i]) => {
        const active = m.medications.filter((x) => x.status === "ACTIVE");
        setMeds(active);
        setInventory(i.inventory);
        setMedicationId(active[0]?.id ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load medications."));
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!medicationId) {
      setError("Choose a medication.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { medicationId };
      if (quantity.trim()) body.quantityRequested = Number(quantity);
      if (note.trim()) body.patientNote = note.trim();
      await api.post("/api/refills", body);
      toast.push("Refill request sent.", "success");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the request.");
    } finally {
      setSaving(false);
    }
  };

  const selected = inventory.find((i) => i.id === medicationId);

  return (
    <Modal open onClose={onClose} title="Request a refill">
      <div className="space-y-4">
        {meds.length === 0 ? (
          <p className="text-sm text-navy-500">Add an active medication first.</p>
        ) : (
          <>
            <div>
              <Label htmlFor="req-med">Medication</Label>
              <Select id="req-med" value={medicationId} onChange={(e) => setMedicationId(e.target.value)}>
                {meds.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.doseAmount} {m.doseUnit}
                  </option>
                ))}
              </Select>
              {selected && (
                <p className="mt-1.5 text-xs text-navy-400">
                  Currently {selected.currentQuantity} {selected.quantityUnit} · threshold{" "}
                  {selected.refillThreshold}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="req-qty" hint="optional">
                Quantity requested
              </Label>
              <Input
                id="req-qty"
                type="number"
                min={1}
                placeholder="e.g. 30"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="req-note" hint="optional">
                Note for the chemist
              </Label>
              <Textarea
                id="req-note"
                maxLength={500}
                placeholder="Anything the chemist should know…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </>
        )}
        <FormError error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void submit()} disabled={meds.length === 0}>
            <Send className="h-4 w-4" aria-hidden /> Send request
          </Button>
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-navy-500">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Requests are sent to your linked chemist shop. If none is linked, add one from Profile &amp;
          Settings.
        </p>
      </div>
    </Modal>
  );
}
