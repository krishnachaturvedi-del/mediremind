import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, Link, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  Pill,
  CalendarClock,
  History,
  Boxes,
  RefreshCcw,
  Users,
  UserRound,
  Bell,
  LogOut,
  Menu,
  X,
  HeartPulse,
  FlaskConical,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { Notification } from "../lib/types";
import { formatTime, relativeTime } from "../lib/utils";
import { Spinner } from "./ui";

const patientNav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/medications", label: "My Medications", icon: Pill },
  { to: "/app/schedule", label: "Today's Schedule", icon: CalendarClock },
  { to: "/app/history", label: "Dose History", icon: History },
  { to: "/app/inventory", label: "Medicine Inventory", icon: Boxes },
  { to: "/app/refills", label: "Refill Management", icon: RefreshCcw },
  { to: "/app/caregiver", label: "Caregiver Access", icon: Users },
  { to: "/app/profile", label: "Profile & Settings", icon: UserRound },
];

const caregiverNav = [
  { to: "/app/caregiver", label: "My Patients", icon: Users },
  { to: "/app/profile", label: "Profile & Settings", icon: UserRound },
];

function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="MediRemind home">
      <span className="rounded-xl bg-teal-600 p-2 text-white shadow-sm">
        <HeartPulse className={size === "lg" ? "h-7 w-7" : "h-5 w-5"} />
      </span>
      <span className={`font-bold tracking-tight text-navy-900 ${size === "lg" ? "text-2xl" : "text-lg"}`}>
        Medi<span className="text-teal-600">Remind</span>
      </span>
    </Link>
  );
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await api.get<{ notifications: Notification[]; unreadCount: number }>(
        "/api/notifications"
      );
      const fresh = data.notifications.filter((n) => !n.read);
      // Surface new dose reminders through the browser notification API when permitted.
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        fresh.length > 0
      ) {
        const latest = fresh[0];
        if (latest.type === "DOSE_REMINDER") {
          new Notification(latest.title, { body: latest.body, tag: latest.id });
        }
      }
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      /* polling failures are non-fatal */
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const requestPermission = () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  };

  const markAll = async () => {
    await api.post("/api/notifications/read-all");
    void load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          requestPermission();
        }}
        className="relative rounded-full p-2 text-navy-500 hover:bg-slate-100 hover:text-navy-800"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-navy-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-semibold text-teal-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-navy-400">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    if (n.link) navigate(n.link);
                    else void api.post(`/api/notifications/${n.id}/read`);
                  }}
                  className={`block w-full border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50 ${n.read ? "opacity-60" : ""}`}
                >
                  <p className="text-sm font-semibold text-navy-900">{n.title}</p>
                  <p className="mt-0.5 text-xs text-navy-500">{n.body}</p>
                  <p className="mt-1 text-[11px] text-navy-300">
                    {formatTime(n.createdAt)} · {relativeTime(n.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 border-2" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "CHEMIST") return <Navigate to="/chemist" replace />;

  const nav = user.role === "CAREGIVER" ? caregiverNav : patientNav;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-teal-50 text-teal-700"
                  : "text-navy-600 hover:bg-slate-100 hover:text-navy-900"
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="truncate text-sm font-bold text-navy-900">{user.name}</p>
          <p className="truncate text-xs text-navy-400">
            {user.role === "CAREGIVER" ? "Caregiver account" : "Patient account"}
          </p>
        </div>
        <button
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
          className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-navy-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="hidden items-center gap-2 text-sm text-navy-500 sm:flex">
              <FlaskConical className="h-4 w-4 text-teal-600" aria-hidden />
              <span>
                Signed in as <span className="font-semibold text-navy-800">{user.name}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationsMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export { Logo };
