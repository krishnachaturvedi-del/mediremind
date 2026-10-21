import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  PackageCheck,
  RefreshCcw,
  ScrollText,
  ShoppingCart,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { InventoryItem, RefillRequest } from "../lib/types";
import { formatDateTime } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormError,
  Input,
  Label,
  Modal,
  Spinner,
  StatCard,
  useToast,
} from "../components/ui";

interface LedgerEntry {
  id: string;
  type: "DOSE_USED" | "REFILL_CONFIRMED";
  delta: number;
  at: string;
  label: string;
}

const ACTIVE_REQUEST = ["PENDING", "ACCEPTED", "READY"];

export default function InventoryPage() {
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [requests, setRequests] = useState<RefillRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ledgerFor, setLedgerFor] = useState<InventoryItem | null>(null);
  const [adjustFor, setAdjustFor] = useState<InventoryItem | null>(null);

  const load = useCallback(async () => {
    try {
      const [inv, refills] = await Promise.all([
        api.get<{ inventory: InventoryItem[] }>("/api/inventory"),
        api.get<{ requests: RefillRequest[] }>("/api/refills").catch(() => ({ requests: [] })),
      ]);
      setItems(inv.inventory);
      setRequests(refills.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load inventory.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requestRefill = async (med: InventoryItem) => {
    setBusyId(med.id);
    try {
      await api.post("/api/refills", { medicationId: med.id });
      toast.push(`Refill request sent to your chemist for ${med.name}.`, "success");
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not request a refill.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const lowCount = items?.filter((i) => i.inventoryStatus !== "IN_STOCK").length ?? 0;
  const refillCount = items?.filter((i) => i.inventoryStatus === "REFILL_REQUIRED").length ?? 0;

  if (error && !items) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7" />}
          title="Could not load inventory"
          description={error}
          action={<Button onClick={() => void load()}>Try again</Button>}
        />
      </Card>
    );
  }

  if (!items) {
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
            Medicine Inventory
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-500">
            Remaining = previous quantity − used by taken doses + confirmed refills. Skipping a dose
            never deducts stock.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          <RefreshCcw className="h-4 w-4" aria-hidden /> Refresh
        </Button>
      </div>

      <FormError error={error} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Medicines tracked"
          value={items.length}
          icon={<Boxes className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          label="In stock"
          value={items.filter((i) => i.inventoryStatus === "IN_STOCK").length}
          icon={<PackageCheck className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Low stock"
          value={lowCount - refillCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Refill required"
          value={refillCount}
          icon={<ShoppingCart className="h-5 w-5" />}
          tone="danger"
        />
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes className="h-8 w-8" />}
            title="No medicines yet"
            description="Add a medication with its quantity and refill threshold to start tracking inventory."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const pct =
              item.refillThreshold > 0
                ? Math.min(100, Math.round((item.currentQuantity / (item.refillThreshold * 2)) * 100))
                : 100;
            const bar =
              item.inventoryStatus === "IN_STOCK"
                ? "bg-emerald-500"
                : item.inventoryStatus === "LOW_STOCK"
                  ? "bg-amber-500"
                  : "bg-red-500";
            const hasActiveRequest = requests.some(
              (r) => r.medicationId === item.id && ACTIVE_REQUEST.includes(r.status)
            );
            return (
              <Card key={item.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-navy-900">{item.name}</p>
                    <p className="text-sm text-navy-500">
                      {item.currentQuantity} {item.quantityUnit} left · threshold {item.refillThreshold}
                    </p>
                  </div>
                  <Badge status={item.inventoryStatus} />
                </div>

                <div className="mt-4">
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-valuenow={item.currentQuantity}
                    aria-valuemin={0}
                    aria-label={`${item.name} remaining quantity`}
                  >
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(pct, 3)}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-navy-400">
                    <span>
                      {item.estimatedDaysLeft != null
                        ? `≈ ${item.estimatedDaysLeft} days left`
                        : "Not enough usage data"}
                    </span>
                    <span>Updated {formatDateTime(item.updatedAt)}</span>
                  </div>
                </div>

                {item.openAlert && (
                  <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    Refill alert open since {formatDateTime(item.openAlert.triggeredAt)}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busyId === item.id}
                    disabled={hasActiveRequest}
                    onClick={() => void requestRefill(item)}
                  >
                    <ShoppingCart className="h-4 w-4" aria-hidden />
                    {hasActiveRequest ? "Refill in progress" : "Request refill"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setLedgerFor(item)}>
                    <ScrollText className="h-4 w-4" aria-hidden /> Ledger
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdjustFor(item)}>
                    Adjust quantity
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <LedgerModal item={ledgerFor} onClose={() => setLedgerFor(null)} />
      <AdjustModal
        item={adjustFor}
        onClose={() => setAdjustFor(null)}
        onSaved={() => {
          setAdjustFor(null);
          void load();
        }}
      />
    </div>
  );
}

function LedgerModal({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setEntries(null);
    setError(null);
    api
      .get<{ entries: LedgerEntry[] }>(`/api/inventory/${item.id}/ledger`)
      .then((d) => setEntries(d.entries))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load ledger."));
  }, [item]);

  if (!item) return null;

  return (
    <Modal open onClose={onClose} title={`Inventory ledger — ${item.name}`} wide>
      {error && <FormError error={error} />}
      {!entries && !error && (
        <div className="flex justify-center py-10">
          <Spinner className="h-7 w-7 border-2" />
        </div>
      )}
      {entries && entries.length === 0 && (
        <p className="py-6 text-center text-sm text-navy-400">
          No recorded dose usage or confirmed refills yet.
        </p>
      )}
      {entries && entries.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={`${e.type}-${e.id}`} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold text-navy-900">{e.label}</p>
                <p className="text-xs text-navy-400">{formatDateTime(e.at)}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  e.type === "REFILL_CONFIRMED"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {e.type === "REFILL_CONFIRMED" ? "+" : ""}
                {e.delta} {item.quantityUnit}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-navy-500">
        Ledger shows taken doses (−) and confirmed refill transactions (+). Current balance:{" "}
        <strong>
          {item.currentQuantity} {item.quantityUnit}
        </strong>
        .
      </p>
    </Modal>
  );
}

function AdjustModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setValue(String(item.currentQuantity));
      setError(null);
    }
  }, [item]);

  if (!item) return null;

  const save = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setError("Enter a quantity of 0 or more.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/inventory/${item.id}/adjust`, { currentQuantity: n });
      toast.push(`${item.name} quantity updated to ${n}.`, "success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the quantity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Adjust quantity — ${item.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-navy-500">
          Use this for physical stock counts (spills, new packs opened outside the app). The change is
          recorded as an adjustment — refill transactions still come only from completed chemist
          refills.
        </p>
        <div>
          <Label htmlFor="adjust-qty" hint={`unit: ${item.quantityUnit}`}>
            Current quantity
          </Label>
          <Input
            id="adjust-qty"
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <FormError error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            Save quantity
          </Button>
        </div>
      </div>
    </Modal>
  );
}
