import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  LogOut,
  PackageCheck,
  RefreshCcw,
  Store,
  Users,
  XCircle,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { RefillRequest } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { Logo } from "../components/Layout";
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
  Spinner,
  StatCard,
  Textarea,
  useToast,
} from "../components/ui";

type ChemistRequest = RefillRequest & {
  user?: { id: string; name: string; phone: string | null };
  alert?: { id: string; status: string } | null;
};

interface Transaction {
  id: string;
  quantitySupplied: number;
  confirmedAt: string;
  medication: { name: string; quantityUnit: string };
  refillRequest: { id: string; user: { name: string } };
}

type Tab = "requests" | "transactions" | "patients";

export default function ChemistConsole() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("requests");

  useEffect(() => {
    if (!loading && (!user || user.role !== "CHEMIST")) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  if (loading || !user || user.role !== "CHEMIST") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 border-2" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
    { id: "requests", label: "Refill requests", icon: RefreshCcw },
    { id: "transactions", label: "Transactions", icon: ClipboardList },
    { id: "patients", label: "My patients", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 ring-1 ring-inset ring-teal-200 sm:inline-flex">
              Chemist console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-navy-900">{user.name}</p>
              <p className="text-xs text-navy-400">{user.email}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6" aria-label="Chemist console">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === id ? "bg-teal-600 text-white shadow-sm" : "text-navy-600 hover:bg-slate-100"
              }`}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {tab === "requests" && <RequestsTab />}
        {tab === "transactions" && <TransactionsTab />}
        {tab === "patients" && <PatientsTab />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- requests

function RequestsTab() {
  const toast = useToast();
  const [requests, setRequests] = useState<ChemistRequest[] | null>(null);
  const [filter, setFilter] = useState<string>("OPEN");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<ChemistRequest | null>(null);
  const [completeFor, setCompleteFor] = useState<ChemistRequest | null>(null);

  const load = useCallback(async () => {
    try {
      const query =
        filter === "OPEN" || filter === "ALL" ? "" : `?status=${encodeURIComponent(filter)}`;
      const data = await api.get<{ requests: ChemistRequest[] }>(`/api/chemist/refills${query}`);
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load requests.");
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (
    id: string,
    action: "ACCEPT" | "READY" | "COMPLETE" | "CANCEL",
    quantitySupplied?: number
  ) => {
    setBusyId(id);
    try {
      await api.post(`/api/chemist/refills/${id}/action`, {
        action,
        ...(quantitySupplied != null ? { quantitySupplied } : {}),
      });
      toast.push(
        action === "ACCEPT"
          ? "Request accepted."
          : action === "READY"
            ? "Marked ready for collection."
            : action === "CANCEL"
              ? "Request cancelled — no stock was added."
              : "Refill completed — patient stock updated.",
        "success"
      );
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not process the request.", "error");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const shown =
    requests?.filter((r) =>
      filter === "ALL"
        ? true
        : filter === "OPEN"
          ? ["PENDING", "ACCEPTED", "READY"].includes(r.status)
          : r.status === filter
    ) ?? [];

  if (error && !requests) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7" />}
          title="Could not load refill requests"
          description={error}
          action={<Button onClick={() => void load()}>Try again</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Refill requests</h1>
          <p className="mt-1 text-sm text-navy-500">
            Requests from patients linked to your shop. Completing a request is the only action that
            adds stock to a patient's inventory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["OPEN", "ALL", "PENDING", "ACCEPTED", "READY", "COMPLETED", "REJECTED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 ring-inset transition-colors ${
                filter === f
                  ? "bg-navy-900 text-white ring-navy-900"
                  : "bg-white text-navy-600 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {f === "OPEN" ? "Open" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <FormError error={error} />

      {!requests ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 border-2" />
        </div>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PackageCheck className="h-8 w-8" />}
            title={filter === "OPEN" ? "No open requests" : "Nothing here"}
            description={
              filter === "OPEN"
                ? "You're all caught up. New patient refill requests will appear here."
                : "No requests match this filter."
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {shown.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold text-navy-900">{r.medication.name}</p>
                    <Badge status={r.status} />
                    {r.origin === "AUTO" && (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                        Auto threshold alert
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-navy-500">
                    {r.user?.name ?? "Patient"}
                    {r.user?.phone ? ` · ${r.user.phone}` : ""} · prescribed{" "}
                    {r.medication.doseAmount} {r.medication.doseUnit} per dose
                  </p>
                  <p className="mt-1 text-xs text-navy-400">
                    Current stock: {r.medication.currentQuantity} {r.medication.quantityUnit} ·
                    requested {r.quantityRequested ? `${r.quantityRequested} units` : "restock"} ·{" "}
                    {relativeTime(r.createdAt)}
                  </p>
                  {r.patientNote && (
                    <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs italic text-navy-600">
                      “{r.patientNote}”
                    </p>
                  )}
                  {r.rejectReason && r.status === "REJECTED" && (
                    <p className="mt-2 text-xs font-medium text-red-600">Reason: {r.rejectReason}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {r.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        loading={busyId === r.id}
                        onClick={() => void act(r.id, "ACCEPT")}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden /> Accept
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setRejectFor(r)}>
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyId === r.id}
                        onClick={() => void act(r.id, "CANCEL")}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {r.status === "ACCEPTED" && (
                    <>
                      <Button size="sm" variant="success" onClick={() => setCompleteFor(r)}>
                        Complete &amp; add stock
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === r.id}
                        onClick={() => void act(r.id, "READY")}
                      >
                        Mark ready
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejectFor(r)}>
                        Reject
                      </Button>
                    </>
                  )}
                  {r.status === "READY" && (
                    <Button size="sm" variant="success" onClick={() => setCompleteFor(r)}>
                      Complete &amp; add stock
                    </Button>
                  )}
                  {r.status === "COMPLETED" && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                      <PackageCheck className="h-4 w-4" aria-hidden />
                      +{r.transactions.reduce((s, t) => s + t.quantitySupplied, 0)}{" "}
                      {r.medication.quantityUnit} supplied
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <RejectModal
        request={rejectFor}
        busy={busyId === rejectFor?.id}
        onClose={() => setRejectFor(null)}
        onConfirm={async (reason) => {
          if (!rejectFor) return;
          setBusyId(rejectFor.id);
          try {
            await api.post(`/api/chemist/refills/${rejectFor.id}/action`, {
              action: "REJECT",
              rejectReason: reason,
            });
            toast.push("Request rejected.", "info");
            setRejectFor(null);
            await load();
          } catch (err) {
            toast.push(err instanceof ApiError ? err.message : "Could not reject.", "error");
          } finally {
            setBusyId(null);
          }
        }}
      />

      <CompleteModal
        request={completeFor}
        busy={busyId === completeFor?.id}
        onClose={() => setCompleteFor(null)}
        onConfirm={async (qty) => {
          if (!completeFor) return;
          await act(completeFor.id, "COMPLETE", qty);
          setCompleteFor(null);
        }}
      />
    </div>
  );
}

function RejectModal({
  request,
  busy,
  onClose,
  onConfirm,
}: {
  request: ChemistRequest | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (request) setReason("");
  }, [request]);

  if (!request) return null;
  return (
    <Modal open onClose={onClose} title={`Reject — ${request.medication.name}`}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="reject-reason" hint="shown to the patient">
            Reason
          </Label>
          <Textarea
            id="reject-reason"
            maxLength={300}
            placeholder="e.g. Manufacturer out of stock this week"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={() => onConfirm(reason.trim() || "No reason provided")}>
            Reject request
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CompleteModal({
  request,
  busy,
  onClose,
  onConfirm,
}: {
  request: ChemistRequest | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}) {
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setQty(request.quantityRequested ? String(request.quantityRequested) : "");
      setError(null);
    }
  }, [request]);

  if (!request) return null;

  const confirm = () => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter the quantity supplied (greater than 0).");
      return;
    }
    onConfirm(n);
  };

  return (
    <Modal open onClose={onClose} title={`Complete refill — ${request.medication.name}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Confirming creates a refill transaction that{" "}
          <strong>
            adds {qty || "?"} {request.medication.quantityUnit}
          </strong>{" "}
          to {request.user?.name ?? "the patient"}'s stock. This cannot be double-confirmed.
        </div>
        <div>
          <Label htmlFor="complete-qty" hint={`unit: ${request.medication.quantityUnit}`}>
            Quantity supplied
          </Label>
          <Input
            id="complete-qty"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        <FormError error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="success" loading={busy} onClick={confirm}>
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Confirm completed refill
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------ transactions

function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ transactions: Transaction[] }>("/api/chemist/transactions")
      .then((d) => setTransactions(d.transactions))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load transactions."));
  }, []);

  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<XCircle className="h-7 w-7" />}
          title="Could not load transactions"
          description={error}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Confirmed refill transactions"
        subtitle="Only these transactions increase patient stock"
        icon={<ClipboardList className="h-5 w-5" />}
      />
      {!transactions ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 border-2" />
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No transactions yet"
          description="Completed refills will be recorded here with quantity, patient and timestamp."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-navy-400">
                <th className="px-5 py-3 sm:px-6">Patient</th>
                <th className="px-3 py-3">Medication</th>
                <th className="px-3 py-3">Quantity</th>
                <th className="px-5 py-3 sm:px-6 text-right">Confirmed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium text-navy-900 sm:px-6">
                    {t.refillRequest?.user?.name ?? "Patient"}
                  </td>
                  <td className="px-3 py-3 text-navy-700">{t.medication.name}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      +{t.quantitySupplied} {t.medication.quantityUnit}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-navy-400 sm:px-6">
                    {formatDateTime(t.confirmedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- patients

function PatientsTab() {
  const [data, setData] = useState<{
    shop: { id: string; name: string; address: string; phone: string };
    patients: { id: string; name: string; phone: string | null }[];
  } | null>(null);
  const [openRequests, setOpenRequests] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<NonNullable<typeof data>>("/api/chemist/patients")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load patients."));
    api
      .get<{ requests: ChemistRequest[] }>("/api/chemist/refills")
      .then((d) =>
        setOpenRequests(
          d.requests.filter((r) => ["PENDING", "ACCEPTED", "READY"].includes(r.status)).length
        )
      )
      .catch(() => setOpenRequests(0));
  }, []);

  if (error) {
    return (
      <Card>
        <EmptyState icon={<XCircle className="h-7 w-7" />} title="Could not load patients" description={error} />
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 border-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-teal-50 p-3 text-teal-600">
            <Store className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-bold text-navy-900">{data.shop.name}</p>
            <p className="text-sm text-navy-500">
              {data.shop.address} · {data.shop.phone}
            </p>
            <p className="mt-1 text-xs text-navy-400">
              You only see patients who chose this shop — no other patient data is visible to you.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Registered patients"
          value={data.patients.length}
          icon={<Users className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard label="Shop" value={data.shop.name} icon={<Store className="h-5 w-5" />} />
        <StatCard
          label="Open requests"
          value={openRequests}
          sub="current queue"
          icon={<RefreshCcw className="h-5 w-5" />}
          tone={openRequests > 0 ? "warning" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader title="Registered patients" icon={<Users className="h-5 w-5" />} />
        {data.patients.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No patients linked yet"
            description="Patients are added when they select your shop as their chemist."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.patients.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-50 text-sm font-bold text-navy-600">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{p.name}</p>
                    {p.phone && <p className="text-xs text-navy-400">{p.phone}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
