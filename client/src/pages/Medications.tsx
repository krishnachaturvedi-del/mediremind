import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Pill,
  Plus,
  Search,
  Pencil,
  Pause,
  Play,
  Clock3,
  CalendarDays,
  AlertTriangle,
  Boxes,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Medication, ChemistShop } from "../lib/types";
import { FREQUENCY_LABELS, formatTime12 } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FieldError,
  FormError,
  Input,
  Label,
  Modal,
  Select,
  Spinner,
  useToast,
} from "../components/ui";

const emptyForm = {
  name: "",
  doseAmount: "",
  doseUnit: "mg",
  quantityPerDose: "1",
  quantityUnit: "tablets",
  frequency: "ONCE_DAILY",
  times: ["08:00"],
  currentQuantity: "",
  refillThreshold: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  chemistShopId: "",
};

const FREQ_TIMES: Record<string, number> = {
  ONCE_DAILY: 1,
  TWICE_DAILY: 2,
  THREE_TIMES_DAILY: 3,
  FOUR_TIMES_DAILY: 4,
};

function MedicationForm({
  initial,
  shops,
  onClose,
  onSaved,
}: {
  initial: Medication | null;
  shops: ChemistShop[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name,
          doseAmount: String(initial.doseAmount),
          doseUnit: initial.doseUnit,
          quantityPerDose: String(initial.quantityPerDose),
          quantityUnit: initial.quantityUnit,
          frequency: initial.frequency,
          times: initial.times,
          currentQuantity: String(initial.currentQuantity),
          refillThreshold: String(initial.refillThreshold),
          startDate: initial.startDate.slice(0, 10),
          endDate: initial.endDate ? initial.endDate.slice(0, 10) : "",
          chemistShopId: initial.chemistShopId ?? "",
        }
      : emptyForm
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  const setFrequency = (freq: string) => {
    const count = FREQ_TIMES[freq];
    setForm((f) => {
      const times = [...f.times];
      if (count) {
        const defaults = ["08:00", "14:00", "20:00", "22:00"];
        const next = times.slice(0, count);
        while (next.length < count) next.push(defaults[next.length]);
        return { ...f, frequency: freq, times: next.sort() };
      }
      return { ...f, frequency: freq, times: times.length ? times : ["08:00"] };
    });
  };

  const setTime = (i: number, v: string) =>
    setForm((f) => {
      const times = [...f.times];
      times[i] = v;
      return { ...f, times };
    });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErr({});
    setBusy(true);
    const payload = {
      name: form.name,
      doseAmount: Number(form.doseAmount),
      doseUnit: form.doseUnit,
      quantityPerDose: Number(form.quantityPerDose) || 1,
      quantityUnit: form.quantityUnit,
      frequency: form.frequency,
      times: form.times,
      currentQuantity: Number(form.currentQuantity),
      refillThreshold: Number(form.refillThreshold),
      startDate: form.startDate,
      endDate: form.endDate || null,
      chemistShopId: form.chemistShopId || null,
    };
    try {
      if (initial) {
        await api.patch(`/api/medications/${initial.id}`, payload);
        toast.push("Medication updated.", "success");
      } else {
        await api.post("/api/medications", payload);
        toast.push("Medication added.", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const fe: Record<string, string | undefined> = {};
        for (const issue of err.issues) fe[issue.path] = issue.message;
        setFieldErr(fe);
      } else {
        setError("Could not save the medication. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError error={error} />
      <div>
        <Label htmlFor="med-name">Medication name</Label>
        <Input
          id="med-name"
          required
          value={form.name}
          invalid={!!fieldErr.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Metformin 500"
        />
        <FieldError message={fieldErr.name} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="dose-amount" hint="as prescribed">
            Prescribed dose
          </Label>
          <Input
            id="dose-amount"
            type="number"
            step="any"
            min="0.01"
            required
            value={form.doseAmount}
            invalid={!!fieldErr.doseAmount}
            onChange={(e) => setForm((f) => ({ ...f, doseAmount: e.target.value }))}
            placeholder="500"
          />
          <FieldError message={fieldErr.doseAmount} />
        </div>
        <div>
          <Label htmlFor="dose-unit">Dose unit</Label>
          <Select
            id="dose-unit"
            value={form.doseUnit}
            onChange={(e) => setForm((f) => ({ ...f, doseUnit: e.target.value }))}
          >
            {["mg", "mcg", "g", "ml", "IU", "tablet", "capsule", "unit", "puff", "drop"].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="qty-per-dose" hint="stock used per dose">
            Units consumed per dose
          </Label>
          <Input
            id="qty-per-dose"
            type="number"
            step="any"
            min="0.01"
            required
            value={form.quantityPerDose}
            invalid={!!fieldErr.quantityPerDose}
            onChange={(e) => setForm((f) => ({ ...f, quantityPerDose: e.target.value }))}
          />
          <FieldError message={fieldErr.quantityPerDose} />
        </div>
        <div>
          <Label htmlFor="qty-unit">Quantity unit</Label>
          <Select
            id="qty-unit"
            value={form.quantityUnit}
            onChange={(e) => setForm((f) => ({ ...f, quantityUnit: e.target.value }))}
          >
            {["tablets", "capsules", "ml", "puffs", "drops", "sachets", "units", "injections"].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="frequency">Frequency</Label>
        <Select
          id="frequency"
          value={form.frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-semibold text-navy-800">
          Scheduled times
        </legend>
        <div className="flex flex-wrap gap-3">
          {form.times.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="time"
                aria-label={`Scheduled time ${i + 1}`}
                value={t}
                invalid={!!fieldErr.times}
                onChange={(e) => setTime(i, e.target.value)}
                className="w-36"
              />
              {form.frequency === "CUSTOM" && form.times.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, times: f.times.filter((_, j) => j !== i) }))
                  }
                  className="rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove time ${i + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {form.frequency === "CUSTOM" && form.times.length < 8 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setForm((f) => ({ ...f, times: [...f.times, "12:00"] }))}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add time
            </Button>
          )}
        </div>
        <FieldError message={fieldErr.times} />
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="qty" hint="in stock now">
            Starting quantity
          </Label>
          <Input
            id="qty"
            type="number"
            min="0"
            step="any"
            required
            value={form.currentQuantity}
            invalid={!!fieldErr.currentQuantity}
            onChange={(e) => setForm((f) => ({ ...f, currentQuantity: e.target.value }))}
            placeholder="30"
          />
          <FieldError message={fieldErr.currentQuantity} />
        </div>
        <div>
          <Label htmlFor="threshold" hint="alert me at or below">
            Refill threshold
          </Label>
          <Input
            id="threshold"
            type="number"
            min="0"
            step="any"
            required
            value={form.refillThreshold}
            invalid={!!fieldErr.refillThreshold}
            onChange={(e) => setForm((f) => ({ ...f, refillThreshold: e.target.value }))}
            placeholder="8"
          />
          <FieldError message={fieldErr.refillThreshold} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start">Start date</Label>
          <Input
            id="start"
            type="date"
            required
            value={form.startDate}
            invalid={!!fieldErr.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
          <FieldError message={fieldErr.startDate} />
        </div>
        <div>
          <Label htmlFor="end" hint="optional">
            End date
          </Label>
          <Input
            id="end"
            type="date"
            value={form.endDate}
            invalid={!!fieldErr.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          />
          <FieldError message={fieldErr.endDate} />
        </div>
      </div>

      <div>
        <Label htmlFor="shop" hint="for refill requests">
          Linked chemist shop
        </Label>
        <Select
          id="shop"
          value={form.chemistShopId}
          onChange={(e) => setForm((f) => ({ ...f, chemistShopId: e.target.value }))}
        >
          <option value="">None — use my account's linked chemist</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.address}
            </option>
          ))}
        </Select>
      </div>

      <p className="rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800">
        MediRemind records the dose exactly as prescribed by your doctor. It never
        suggests changing your prescribed dose.
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" size="lg" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="lg" loading={busy}>
          {initial ? "Save changes" : "Add medication"}
        </Button>
      </div>
    </form>
  );
}

export default function Medications() {
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [shops, setShops] = useState<ChemistShop[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modal, setModal] = useState<{ open: boolean; editing: Medication | null }>({
    open: false,
    editing: null,
  });
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (statusFilter !== "ALL") q.set("status", statusFilter);
      const data = await api.get<{ medications: Medication[] }>(`/api/medications?${q}`);
      setMeds(data.medications);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load medications.");
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    void api
      .get<{ shops: ChemistShop[] }>("/api/shops")
      .then((d) => setShops(d.shops))
      .catch(() => setShops([]));
  }, []);

  const setStatus = async (med: Medication, status: "ACTIVE" | "PAUSED" | "ENDED") => {
    try {
      await api.post(`/api/medications/${med.id}/status`, { status });
      toast.push(
        status === "PAUSED"
          ? `${med.name} paused — no new reminders will be created.`
          : status === "ACTIVE"
            ? `${med.name} resumed.`
            : `${med.name} ended.`,
        "success"
      );
      void load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Update failed.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">My Medications</h1>
          <p className="mt-1 text-sm text-navy-500">
            Manage prescriptions, schedules and refill thresholds.
          </p>
        </div>
        <Button size="lg" onClick={() => setModal({ open: true, editing: null })}>
          <Plus className="h-4 w-4" aria-hidden /> Add medication
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" aria-hidden />
          <Input
            aria-label="Search medications by name"
            className="pl-10"
            placeholder="Search medications…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label="Filter by status"
          className="sm:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="ENDED">Ended</option>
        </Select>
      </div>

      {error && (
        <Card>
          <EmptyState
            icon={<AlertTriangle className="h-7 w-7" />}
            title="Could not load medications"
            description={error}
            action={<Button onClick={() => void load()}>Try again</Button>}
          />
        </Card>
      )}

      {!meds && !error && (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8 border-2" />
        </div>
      )}

      {meds && meds.length === 0 && !error && (
        <Card>
          <EmptyState
            icon={<Pill className="h-8 w-8" />}
            title={search || statusFilter !== "ALL" ? "No medications match your filters" : "No medications yet"}
            description={
              search || statusFilter !== "ALL"
                ? "Try clearing the search or changing the status filter."
                : "Add your first medication to start tracking doses, inventory and refills."
            }
            action={
              !search && statusFilter === "ALL" ? (
                <Button onClick={() => setModal({ open: true, editing: null })}>
                  <Plus className="h-4 w-4" aria-hidden /> Add medication
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {meds && meds.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {meds.map((m) => (
            <Card key={m.id} className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-navy-900">{m.name}</h2>
                    <Badge status={m.status} />
                  </div>
                  <p className="mt-1 text-sm text-navy-500">
                    {m.doseAmount} {m.doseUnit} · {FREQUENCY_LABELS[m.frequency] ?? m.frequency}
                  </p>
                </div>
                {m.inventoryStatus && <Badge status={m.inventoryStatus} />}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-navy-300" aria-hidden />
                  <dd className="text-navy-700">
                    <dt className="sr-only">Schedule</dt>
                    {m.times.map(formatTime12).join(", ")}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-navy-300" aria-hidden />
                  <dd className="text-navy-700">
                    <dt className="sr-only">Quantity</dt>
                    {m.currentQuantity} {m.quantityUnit} left
                    {m.estimatedDaysLeft != null && (
                      <span className="text-navy-400"> · ~{m.estimatedDaysLeft}d supply</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-navy-300" aria-hidden />
                  <dd className="text-navy-700">
                    <dt className="sr-only">Threshold</dt>
                    Refill at {m.refillThreshold} {m.quantityUnit}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-navy-300" aria-hidden />
                  <dd className="text-navy-700">
                    <dt className="sr-only">Start date</dt>
                    Since {new Date(m.startDate).toLocaleDateString()}
                  </dd>
                </div>
              </dl>

              {m.chemistShop && (
                <p className="mt-3 text-xs text-navy-400">
                  Chemist: <span className="font-medium text-navy-600">{m.chemistShop.name}</span>
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModal({ open: true, editing: m })}
                >
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </Button>
                {m.status === "ACTIVE" ? (
                  <Button variant="secondary" size="sm" onClick={() => void setStatus(m, "PAUSED")}>
                    <Pause className="h-4 w-4" aria-hidden /> Pause
                  </Button>
                ) : m.status === "PAUSED" ? (
                  <Button variant="secondary" size="sm" onClick={() => void setStatus(m, "ACTIVE")}>
                    <Play className="h-4 w-4" aria-hidden /> Resume
                  </Button>
                ) : null}
                {m.status !== "ENDED" && (
                  <Button variant="ghost" size="sm" onClick={() => void setStatus(m, "ENDED")}>
                    Mark as ended
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing ? `Edit ${modal.editing.name}` : "Add medication"}
        wide
      >
        {modal.open && (
          <MedicationForm
            initial={modal.editing}
            shops={shops}
            onClose={() => setModal({ open: false, editing: null })}
            onSaved={() => void load()}
          />
        )}
      </Modal>
    </div>
  );
}
