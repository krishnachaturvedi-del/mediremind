import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth, homePathFor } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { Button, Card, FieldError, FormError, Input, Label } from "../components/ui";
import { Logo } from "../components/Layout";

export default function Register() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErr({});
    if (form.password !== form.confirm) {
      setFieldErr({ confirm: "Passwords do not match." });
      return;
    }
    setBusy(true);
    try {
      const u = await register({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      navigate(homePathFor(u.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErr({
          name: err.fieldError("name"),
          email: err.fieldError("email"),
          password: err.fieldError("password"),
        });
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50/70 to-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-navy-900">Create your account</h1>
          <p className="mt-1 text-sm text-navy-500">
            Patient registration — free, and takes less than a minute.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <FormError error={error} />
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                value={form.name}
                invalid={!!fieldErr.name}
                onChange={set("name")}
                placeholder="e.g. Alice Fernandes"
              />
              <FieldError message={fieldErr.name} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                invalid={!!fieldErr.email}
                onChange={set("email")}
                placeholder="you@example.com"
              />
              <FieldError message={fieldErr.email} />
            </div>
            <div>
              <Label htmlFor="password" hint="Minimum 8 characters">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                invalid={!!fieldErr.password}
                onChange={set("password")}
                placeholder="Choose a strong password"
              />
              <FieldError message={fieldErr.password} />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={form.confirm}
                invalid={!!fieldErr.confirm}
                onChange={set("confirm")}
                placeholder="Repeat your password"
              />
              <FieldError message={fieldErr.confirm} />
            </div>
            <Button type="submit" loading={busy} size="lg" className="w-full">
              Create Account
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-navy-500">
            Already registered?{" "}
            <Link to="/login" className="font-semibold text-teal-600 hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
        <p className="mt-4 text-center text-xs text-navy-400">
          Only patient accounts can self-register. Caregivers are added by patients
          through an explicit consent flow.
        </p>
      </div>
    </div>
  );
}
