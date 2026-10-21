import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  HeartHandshake,
  RefreshCcw,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { CaregiverLink } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { formatDateTime, relativeTime } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  FormError,
  Input,
  Label,
  Modal,
  Spinner,
  StatCard,
  useToast,
} from "../components/ui";

interface Scopes {
  shareAdherence: boolean;
  shareMissed: boolean;
  shareUpcoming: boolean;
  shareRefills: boolean;
  shareInventory: boolean;
}

const SCOPE_LABELS: { key: keyof Scopes; label: string; hint: string }[] = [
  { key: "shareAdherence", label: "Adherence summary", hint: "7-day taken / skipped / missed counts" },
  { key: "shareMissed", label: "Missed doses", hint: "Recent doses that were skipped or never recorded" },
  { key: "shareUpcoming", label: "Upcoming doses", hint: "Today's remaining scheduled doses" },
  { key: "shareRefills", label: "Refill requests", hint: "Status of refill requests you raise" },
  { key: "shareInventory", label: "Inventory levels", hint: "Remaining quantities and thresholds" },
];

const DEFAULT_SCOPES: Scopes = {
  shareAdherence: true,
  shareMissed: true,
  shareUpcoming: true,
  shareRefills: true,
  shareInventory: false,
};

export default function CaregiverPage() {
  const { user } = useAuth();
  if (user?.role === "CAREGIVER") return <CaregiverDashboard />;
  return <PatientCaregiverManager />;
}

// ------------------------------------------------------------- patient side

function PatientCaregiverManager() {
  const toast = useToast();
  const [links, setLinks] = useState<CaregiverLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ links: CaregiverLink[] }>("/api/caregiver/links");
      setLinks(data.links);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load caregiver access.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    try {
      await api.delete(`/api/caregiver/links/${id}`);
      toast.push("Caregiver access revoked immediately.", "info");
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not revoke access.", "error");
    }
  };

  if (error && !links) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7" />}
          title="Could not load caregiver access"
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
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Caregiver Access
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-navy-500">
            You decide exactly what each caregiver can see, and you can revoke access instantly. No
            one sees your data without an active consent link.
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <UserPlus className="h-4 w-4" aria-hidden /> Invite caregiver
        </Button>
      </div>

      <FormError error={error} />

      {!links ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8 border-2" />
        </div>
      ) : links.length === 0 ? (
        <Card>
          <EmptyState
            icon={<HeartHandshake className="h-8 w-8" />}
            title="No caregivers yet"
            description="Invite a family member or caregiver by email. They must accept before they can see anything, and only the scopes you share are visible."
            action={<Button onClick={() => setShowInvite(true)}>Invite caregiver</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {links.map((l) => (
            <Card key={l.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold text-navy-900">{l.caregiver?.name ?? "Caregiver"}</p>
                    <Badge status={l.status} />
                  </div>
                  <p className="text-sm text-navy-400">{l.caregiver?.email}</p>
                  <p className="mt-0.5 text-xs text-navy-300">
                    Invited {formatDateTime(l.createdAt)} ·{" "}
                    {l.status === "PENDING"
                      ? "waiting for their acceptance"
                      : l.status === "REVOKED"
                        ? "revoked — invite again to restore access"
                        : "active access"}
                  </p>
                </div>
                {l.status !== "REVOKED" && (
                  <Button size="sm" variant="danger" onClick={() => void revoke(l.id)}>
                    Revoke access
                  </Button>
                )}
              </div>
              <ScopeEditor link={l} onSaved={() => void load()} />
            </Card>
          ))}
        </div>
      )}

      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onCreated={() => {
          setShowInvite(false);
          void load();
        }}
      />
    </div>
  );
}

function ScopeEditor({ link, onSaved }: { link: CaregiverLink; onSaved: () => void }) {
  const toast = useToast();
  const [scopes, setScopes] = useState<Scopes>({
    shareAdherence: link.shareAdherence,
    shareMissed: link.shareMissed,
    shareUpcoming: link.shareUpcoming,
    shareRefills: link.shareRefills,
    shareInventory: link.shareInventory,
  });
  const [saving, setSaving] = useState(false);

  const dirty =
    scopes.shareAdherence !== link.shareAdherence ||
    scopes.shareMissed !== link.shareMissed ||
    scopes.shareUpcoming !== link.shareUpcoming ||
    scopes.shareRefills !== link.shareRefills ||
    scopes.shareInventory !== link.shareInventory;

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/caregiver/links/${link.id}/scopes`, scopes);
      toast.push("Sharing settings updated.", "success");
      onSaved();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not update scopes.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl bg-slate-50 p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy-400">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> What they can see
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {SCOPE_LABELS.map((s) => (
          <label
            key={s.key}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-white p-2.5 ring-1 ring-inset ring-slate-200 hover:ring-teal-300"
          >
            <Checkbox
              checked={scopes[s.key]}
              disabled={link.status === "REVOKED"}
              onChange={(e) => setScopes((p) => ({ ...p, [s.key]: e.target.checked }))}
            />
            <span>
              <span className="block text-sm font-semibold text-navy-800">{s.label}</span>
              <span className="block text-xs text-navy-400">{s.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={!dirty || link.status === "REVOKED"} loading={saving} onClick={() => void save()}>
          Save sharing settings
        </Button>
      </div>
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [scopes, setScopes] = useState<Scopes>(DEFAULT_SCOPES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setScopes(DEFAULT_SCOPES);
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/caregiver/invite", { email: email.trim().toLowerCase(), ...scopes });
      toast.push("Invitation sent. They must accept before seeing anything.", "success");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the invitation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite a caregiver">
      <div className="space-y-4">
        <div>
          <Label htmlFor="cg-email">Caregiver email address</Label>
          <Input
            id="cg-email"
            type="email"
            autoComplete="off"
            placeholder="caregiver@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-navy-400">
            They need a MediRemind account registered as a caregiver, using this exact email.
            Caregivers register themselves — you cannot invite a patient or chemist account.
          </p>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-navy-800">Choose what to share</p>
          <div className="space-y-2">
            {SCOPE_LABELS.map((s) => (
              <label
                key={s.key}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-slate-50 p-3 hover:bg-slate-100"
              >
                <Checkbox
                  checked={scopes[s.key]}
                  onChange={(e) => setScopes((p) => ({ ...p, [s.key]: e.target.checked }))}
                />
                <span>
                  <span className="block text-sm font-semibold text-navy-800">{s.label}</span>
                  <span className="block text-xs text-navy-400">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <FormError error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            <UserPlus className="h-4 w-4" aria-hidden /> Send invitation
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------- caregiver side

interface PatientSummary {
  patient: { id: string };
  scopes: Scopes;
  adherence7d?: { taken: number; skipped: number; missed: number; adherencePercent: number | null };
  recentMissedDoses?: { id: string; medication: string; scheduledAt: string; status: string }[];
  upcomingDoses?: { id: string; medication: string; dose: string; scheduledAt: string; snoozed: boolean }[];
  refillRequests?: { id: string; medication: string; quantityUnit: string; status: string; createdAt: string }[];
  inventory?: {
    id: string;
    name: string;
    currentQuantity: number;
    quantityUnit: string;
    refillThreshold: number;
    status: string;
  }[];
}

function CaregiverDashboard() {
  const toast = useToast();
  const [invitations, setInvitations] = useState<CaregiverLink[]>([]);
  const [patients, setPatients] = useState<{ id: string; name: string; since: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [inv, pat] = await Promise.all([
        api.get<{ links: CaregiverLink[] }>("/api/caregiver/invitations"),
        api.get<{ patients: { id: string; name: string; since: string }[] }>("/api/caregiver/patients"),
      ]);
      setInvitations(inv.links);
      setPatients(pat.patients);
      setError(null);
      setSelected((prev) => prev ?? pat.patients[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load your patients.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setSummary(null);
      return;
    }
    setSummary(null);
    setSummaryError(null);
    api
      .get<PatientSummary>(`/api/caregiver/patients/${selected}/summary`)
      .then(setSummary)
      .catch((err) =>
        setSummaryError(err instanceof ApiError ? err.message : "Could not load this patient.")
      );
  }, [selected]);

  const respond = async (id: string, accept: boolean) => {
    try {
      await api.post(`/api/caregiver/invitations/${id}/respond`, { accept });
      toast.push(accept ? "Invitation accepted." : "Invitation declined.", accept ? "success" : "info");
      await load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not respond.", "error");
    }
  };

  const pending = invitations.filter((l) => l.status === "PENDING");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">My Patients</h1>
        <p className="mt-1 max-w-2xl text-sm text-navy-500">
          You only see what each patient explicitly shared. Revoked links stop working immediately.
        </p>
      </div>

      <FormError error={error} />

      {pending.length > 0 && (
        <Card>
          <CardHeader
            title="Pending invitations"
            subtitle="Accept to start viewing a patient's shared information"
            icon={<UserPlus className="h-5 w-5" />}
          />
          <ul className="divide-y divide-slate-100">
            {pending.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-sm font-bold text-navy-900">{l.patient?.name ?? "A patient"}</p>
                  <p className="text-xs text-navy-400">Invited you {relativeTime(l.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" onClick={() => void respond(l.id, true)}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Accept
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void respond(l.id, false)}>
                    <XCircle className="h-4 w-4" aria-hidden /> Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {patients.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No patients yet"
            description="Ask a patient to invite you from their Caregiver Access page. You will see their invitation here once they send it."
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          <Card className="h-fit lg:col-span-1">
            <CardHeader title="Patients" icon={<Users className="h-5 w-5" />} />
            <ul className="divide-y divide-slate-100">
              {patients.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelected(p.id)}
                    className={`flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left transition-colors sm:px-6 ${
                      selected === p.id ? "bg-teal-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold text-navy-900">{p.name}</span>
                      <span className="block text-xs text-navy-400">since {formatDateTime(p.since)}</span>
                    </span>
                    {selected === p.id && <Eye className="h-4 w-4 text-teal-600" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-4 lg:col-span-3">
            {summaryError && (
              <Card>
                <EmptyState
                  icon={<ShieldCheck className="h-7 w-7" />}
                  title="Access unavailable"
                  description={summaryError}
                />
              </Card>
            )}
            {!summary && !summaryError && (
              <div className="flex justify-center py-16">
                <Spinner className="h-8 w-8 border-2" />
              </div>
            )}
            {summary && <SummaryView summary={summary} />}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryView({ summary }: { summary: PatientSummary }) {
  const s = summary.scopes;
  const shared = [
    s.shareAdherence && "adherence",
    s.shareMissed && "missed doses",
    s.shareUpcoming && "upcoming doses",
    s.shareRefills && "refills",
    s.shareInventory && "inventory",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-600">
        <ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden />
        Shared with you:
        <span className="font-normal text-navy-400">{shared || "nothing yet"}</span>
      </p>

      {summary.adherence7d && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="7-day adherence"
            value={
              summary.adherence7d.adherencePercent != null
                ? `${summary.adherence7d.adherencePercent}%`
                : "—"
            }
            icon={<HeartHandshake className="h-5 w-5" />}
            tone="accent"
          />
          <StatCard
            label="Taken"
            value={summary.adherence7d.taken}
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="success"
          />
          <StatCard
            label="Skipped"
            value={summary.adherence7d.skipped}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="warning"
          />
          <StatCard
            label="Missed"
            value={summary.adherence7d.missed}
            icon={<XCircle className="h-5 w-5" />}
            tone="danger"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {summary.upcomingDoses && (
          <Card>
            <CardHeader title="Upcoming doses today" icon={<CalendarClock className="h-5 w-5" />} />
            {summary.upcomingDoses.length === 0 ? (
              <p className="px-6 py-6 text-sm text-navy-400">No remaining doses today.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.upcomingDoses.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                    <div>
                      <p className="text-sm font-semibold text-navy-900">{d.medication}</p>
                      <p className="text-xs text-navy-400">{d.dose}</p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                      {formatDateTime(d.scheduledAt)}
                      {d.snoozed ? " (snoozed)" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {summary.recentMissedDoses && (
          <Card>
            <CardHeader title="Recent missed doses" icon={<XCircle className="h-5 w-5" />} />
            {summary.recentMissedDoses.length === 0 ? (
              <p className="px-6 py-6 text-sm text-navy-400">Nothing missed in the past week. 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.recentMissedDoses.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                    <div>
                      <p className="text-sm font-semibold text-navy-900">{d.medication}</p>
                      <p className="text-xs text-navy-400">{formatDateTime(d.scheduledAt)}</p>
                    </div>
                    <Badge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {summary.refillRequests && (
          <Card>
            <CardHeader title="Refill requests" icon={<RefreshCcw className="h-5 w-5" />} />
            {summary.refillRequests.length === 0 ? (
              <p className="px-6 py-6 text-sm text-navy-400">No refill requests.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.refillRequests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                    <div>
                      <p className="text-sm font-semibold text-navy-900">{r.medication}</p>
                      <p className="text-xs text-navy-400">requested {relativeTime(r.createdAt)}</p>
                    </div>
                    <Badge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {summary.inventory && (
          <Card>
            <CardHeader title="Inventory" icon={<AlertTriangle className="h-5 w-5" />} />
            <ul className="divide-y divide-slate-100">
              {summary.inventory.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{m.name}</p>
                    <p className="text-xs text-navy-400">
                      {m.currentQuantity} {m.quantityUnit} left · threshold {m.refillThreshold}
                    </p>
                  </div>
                  <Badge status={m.status} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
