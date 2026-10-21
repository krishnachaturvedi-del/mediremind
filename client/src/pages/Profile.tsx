import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  KeyRound,
  Link2,
  Save,
  Store,
  Unlink,
  UserRound,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { ChemistShop, User } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { formatDateTime } from "../lib/utils";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  FormError,
  Input,
  Label,
  Spinner,
  useToast,
} from "../components/ui";

interface MyLink {
  id: string;
  status: string;
  chemistShop: ChemistShop;
}

export default function ProfilePage() {
  const { updateLocalUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ user: User }>("/api/profile");
      setProfile(data.user);
      setName(data.user.name);
      setPhone(data.user.phone ?? "");
      setProfileError(null);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Failed to load your profile.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      const data = await api.patch<{ user: User }>("/api/profile", {
        name: name.trim(),
        phone: phone.trim(),
      });
      updateLocalUser(data.user);
      setProfile(data.user);
      toast.push("Profile updated.", "success");
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (profileError && !profile) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle className="h-7 w-7" />}
          title="Could not load profile"
          description={profileError}
          action={<Button onClick={() => void load()}>Try again</Button>}
        />
      </Card>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8 border-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Profile &amp; Settings
        </h1>
        <p className="mt-1 text-sm text-navy-500">Manage your account details and security.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account details" icon={<UserRound className="h-5 w-5" />} />
          <div className="space-y-4 p-5 sm:p-6">
            <div>
              <Label htmlFor="pf-email">Email</Label>
              <Input id="pf-email" value={profile.email} disabled />
              <p className="mt-1.5 text-xs text-navy-400">
                Your login email cannot be changed in this demo.
              </p>
            </div>
            <div>
              <Label htmlFor="pf-name">Full name</Label>
              <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="pf-phone" hint="optional">
                Phone
              </Label>
              <Input
                id="pf-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                placeholder="+1 555 000 1234"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-navy-500">
              <span>
                Role: <strong className="text-navy-800">{profile.role.toLowerCase()}</strong>
              </span>
              <span>Member since {formatDateTime(profile.createdAt)}</span>
            </div>
            <FormError error={profileError} />
            <div className="flex justify-end">
              <Button loading={savingProfile} onClick={() => void saveProfile()} disabled={!name.trim()}>
                <Save className="h-4 w-4" aria-hidden /> Save changes
              </Button>
            </div>
          </div>
        </Card>

        <ChangePasswordCard />
      </div>

      {profile.role === "PATIENT" && <ChemistShopCard />}
    </div>
  );
}

function ChangePasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/profile/change-password", {
        currentPassword: current,
        newPassword: next,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.push("Password changed.", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change the password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Change password" icon={<KeyRound className="h-5 w-5" />} />
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <Label htmlFor="pw-current">Current password</Label>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pw-new" hint="min 8 characters">
            New password
          </Label>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pw-confirm">Confirm new password</Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <FormError error={error} />
        <div className="flex justify-end">
          <Button
            loading={saving}
            disabled={!current || next.length < 8}
            onClick={() => void submit()}
          >
            <KeyRound className="h-4 w-4" aria-hidden /> Update password
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ChemistShopCard() {
  const toast = useToast();
  const [shops, setShops] = useState<ChemistShop[]>([]);
  const [link, setLink] = useState<MyLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [all, mine] = await Promise.all([
        api.get<{ shops: ChemistShop[] }>("/api/shops"),
        api.get<{ link: MyLink | null }>("/api/shops/mine"),
      ]);
      setShops(all.shops);
      setLink(mine.link);
      setShopId(all.shops[0]?.id ?? "");
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load chemist shops.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const linkShop = async () => {
    if (!shopId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<{ link: MyLink }>("/api/shops/link", { chemistShopId: shopId });
      setLink(data.link);
      toast.push("Chemist shop linked. Refills will go to this shop.", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not link the shop.");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/shops/unlink");
      setLink(null);
      toast.push("Chemist shop unlinked.", "info");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unlink the shop.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="My chemist"
        subtitle="Refill requests are sent to this shop"
        icon={<Store className="h-5 w-5" />}
      />
      <div className="space-y-4 p-5 sm:p-6">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-7 w-7 border-2" />
          </div>
        ) : (
          <>
            {error && <FormError error={error} />}
            {link ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3.5">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-navy-900">
                      <Store className="h-4 w-4 text-teal-600" aria-hidden />
                      {link.chemistShop.name}
                    </p>
                    <p className="mt-0.5 text-xs text-navy-500">
                      {link.chemistShop.address} · {link.chemistShop.phone}
                    </p>
                    <p className="mt-0.5 text-[11px] text-navy-400">
                      License {link.chemistShop.licenseNumber} · linked
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => void unlink()}>
                    <Unlink className="h-4 w-4" aria-hidden /> Unlink
                  </Button>
                </div>
                <p className="text-xs text-navy-400">
                  Unlinking stops new refill requests from reaching this shop. Existing completed
                  transactions stay in your history.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy-800">
                  <Link2 className="h-4 w-4 text-navy-400" aria-hidden />
                  No chemist linked
                </p>
                <p className="mt-0.5 text-xs text-navy-500">
                  Link a shop so your refill requests reach a chemist.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="shop-select">Chemist shop</Label>
                <select
                  id="shop-select"
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-navy-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.address}
                    </option>
                  ))}
                </select>
              </div>
              <Button loading={busy} onClick={() => void linkShop()} disabled={!shopId}>
                <Link2 className="h-4 w-4" aria-hidden />
                {link ? "Switch to this shop" : "Link shop"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
