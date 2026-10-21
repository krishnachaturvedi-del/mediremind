import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth, homePathFor } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { Button, Card, FieldError, FormError, Input, Label } from "../components/ui";
import { Logo } from "../components/Layout";

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErr({});
    setBusy(true);
    try {
      const u = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? homePathFor(u.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErr({
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
          <h1 className="text-2xl font-bold text-navy-900">Welcome back</h1>
          <p className="mt-1 text-sm text-navy-500">Sign in to your MediRemind account.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <FormError error={error} />
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                invalid={!!fieldErr.email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <FieldError message={fieldErr.email} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                invalid={!!fieldErr.password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
              <FieldError message={fieldErr.password} />
            </div>
            <Button type="submit" loading={busy} size="lg" className="w-full">
              Sign In
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-navy-500">
            New to MediRemind?{" "}
            <Link to="/register" className="font-semibold text-teal-600 hover:underline">
              Create an account
            </Link>
          </p>
        </Card>
        <p className="mt-4 text-center text-xs text-navy-400">
          Chemist accounts are provisioned through a controlled process and cannot
          be self-registered.
        </p>
      </div>
    </div>
  );
}
