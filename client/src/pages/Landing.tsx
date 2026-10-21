import { Link } from "react-router-dom";
import {
  BellRing,
  CalendarCheck2,
  Boxes,
  RefreshCcw,
  Users,
  ShieldCheck,
  Lock,
  HeartPulse,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Logo } from "../components/Layout";

const features = [
  {
    icon: BellRing,
    title: "Medication reminders",
    text: "Daily schedules with in-app reminders and optional browser notifications, including snooze support.",
  },
  {
    icon: CalendarCheck2,
    title: "Dose tracking",
    text: "Mark doses as taken, skipped or snoozed. Every action is timestamped in an auditable dose log.",
  },
  {
    icon: Boxes,
    title: "Inventory management",
    text: "Remaining quantities update automatically with every recorded dose, so you always know what is left.",
  },
  {
    icon: RefreshCcw,
    title: "Refill alerts",
    text: "When stock falls to your threshold, MediRemind raises a refill alert and notifies your linked chemist.",
  },
  {
    icon: Users,
    title: "Caregiver support",
    text: "Optional, consent-based sharing lets family caregivers monitor adherence — and you can revoke access anytime.",
  },
];

const steps = [
  {
    title: "Add your medications",
    text: "Enter the name, prescribed dose, schedule times, starting quantity and your refill threshold.",
  },
  {
    title: "Follow your daily schedule",
    text: "Each day shows exactly what is due. Mark doses taken in one tap — inventory updates automatically.",
  },
  {
    title: "Get refills before you run out",
    text: "When quantity reaches your threshold, a refill request reaches your registered chemist for fulfilment.",
  },
];

function LogoPreviewPill() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Next dose</p>
          <p className="mt-0.5 text-sm font-bold text-navy-900">Metformin 500 · 1 tablet</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
          8:00 AM
        </span>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary">
            <Link
              to="/login"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-navy-700 hover:bg-slate-100"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/70 via-white to-white">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 ring-1 ring-inset ring-teal-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Medication &amp; refill tracking for patients, chemists and caregivers
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-5xl lg:text-[3.4rem]">
                Never Miss a Medication.{" "}
                <span className="text-teal-600">Never Run Out.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-500">
                MediRemind keeps your daily medication schedule, tracks remaining
                medicine quantities, and alerts you — and your chemist — when it is
                time for a refill.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-7 py-3.5 text-base font-bold text-white shadow-sm hover:bg-teal-700"
                >
                  Get Started <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-navy-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                >
                  Sign In
                </Link>
              </div>
              <ul className="mt-8 grid gap-2.5 text-sm text-navy-600 sm:grid-cols-2">
                {[
                  "Free for patients",
                  "Consent-based caregiver access",
                  "Chemist refill workflow",
                  "Works on phone, tablet and desktop",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-500" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Dashboard preview */}
            <div className="relative" aria-hidden>
              <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5 shadow-xl sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-navy-900">Good morning, Alice</p>
                    <p className="text-xs text-navy-400">Today · 3 medications</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    2 of 3 doses taken
                  </span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { time: "8:00 AM", name: "Metformin 500", state: "taken" },
                    { time: "9:00 AM", name: "Amlodipine 5", state: "taken" },
                    { time: "2:00 PM", name: "Vitamin D3", state: "upcoming" },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-navy-300" aria-hidden />
                        <div>
                          <p className="text-sm font-semibold text-navy-900">{row.name}</p>
                          <p className="text-xs text-navy-400">{row.time}</p>
                        </div>
                      </div>
                      {row.state === "taken" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Taken
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                          <Clock className="h-3.5 w-3.5" aria-hidden /> Upcoming
                        </span>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />
                      <div>
                        <p className="text-sm font-semibold text-red-800">Amlodipine 5 · low stock</p>
                        <p className="text-xs text-red-500">6 tablets left · threshold 7</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-red-600 ring-1 ring-inset ring-red-200">
                      Refill sent
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <LogoPreviewPill />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-navy-900">
              Everything a medication routine needs
            </h2>
            <p className="mt-3 text-lg text-navy-500">
              Built for patients and families managing long-term prescriptions.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="inline-flex rounded-xl bg-teal-50 p-2.5 text-teal-600">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-navy-900">How it works</h2>
          </div>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold text-navy-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Security */}
      <section className="bg-navy-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">
                Security &amp; privacy by design
              </h2>
              <p className="mt-4 max-w-xl text-navy-200">
                Your medication data is sensitive. MediRemind is designed so that
                access is always explicit: caregivers need your consent, chemists
                only see the refills you route to them, and every account action is
                audit-logged.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Passwords are salted and hashed — never stored in readable form",
                  "Server-side authorization checks on every sensitive endpoint",
                  "Session-based login with secure, http-only cookies",
                  "Rate limiting on authentication routes",
                  "Consent-based caregiver access you can revoke at any time",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-navy-100">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs leading-relaxed text-navy-400">
                Encryption in transit (TLS) and at rest depends on the deployment
                environment and is documented in the project README — MediRemind
                does not claim certifications it has not verified.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Lock, title: "Protected records", text: "Every query is scoped to the signed-in user or an explicitly authorized link." },
                { icon: Users, title: "Explicit consent", text: "Caregiver links show exactly which categories of data are shared." },
                { icon: Boxes, title: "Traceable inventory", text: "Dose and refill transactions keep an auditable quantity ledger." },
                { icon: HeartPulse, title: "Patient first", text: "MediRemind never suggests changing prescribed doses." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl bg-white/5 p-5 ring-1 ring-inset ring-white/10">
                  <Icon className="h-5 w-5 text-teal-400" aria-hidden />
                  <h3 className="mt-3 text-sm font-bold">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-navy-300">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-navy-900">
            Start tracking your medications today
          </h2>
          <p className="mt-3 text-lg text-navy-500">
            Create a free patient account in under a minute.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-8 py-4 text-base font-bold text-white shadow-sm hover:bg-teal-700"
          >
            Get Started <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <Logo />
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-navy-500">
                Medication reminders, dose tracking and refill management for
                patients, registered chemists and caregivers.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-900">Product</h3>
              <ul className="mt-3 space-y-2 text-sm text-navy-500">
                <li><Link to="/register" className="hover:text-teal-600">Create patient account</Link></li>
                <li><Link to="/login" className="hover:text-teal-600">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-900">Please note</h3>
              <p className="mt-3 text-xs leading-relaxed text-navy-400">
                MediRemind is a medication tracking tool. It does not provide
                medical advice, does not replace professional care, and never
                recommends changes to prescribed doses. Chemist accounts are
                provisioned through a controlled registration process.
              </p>
            </div>
          </div>
          <p className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-navy-400">
            © {new Date().getFullYear()} MediRemind. All patient data shown in demos is fictional.
          </p>
        </div>
      </footer>
    </div>
  );
}
