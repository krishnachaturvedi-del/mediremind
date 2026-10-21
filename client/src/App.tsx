import { type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth, homePathFor } from "./context/AuthContext";
import { ToastProvider, Spinner } from "./components/ui";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Medications from "./pages/Medications";
import Schedule from "./pages/Schedule";
import HistoryPage from "./pages/History";
import InventoryPage from "./pages/Inventory";
import RefillsPage from "./pages/Refills";
import CaregiverPage from "./pages/Caregiver";
import ProfilePage from "./pages/Profile";
import ChemistConsole from "./pages/ChemistConsole";
import type { Role } from "./lib/types";

/** Blocks access until the session is known; redirects anonymous users to login. */
function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 border-2" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/chemist"
              element={
                <RequireAuth roles={["CHEMIST"]}>
                  <ChemistConsole />
                </RequireAuth>
              }
            />

            <Route
              path="/app"
              element={
                <RequireAuth roles={["PATIENT", "CAREGIVER"]}>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<RoleRoute roles={["PATIENT"]}><Dashboard /></RoleRoute>} />
              <Route path="medications" element={<RoleRoute roles={["PATIENT"]}><Medications /></RoleRoute>} />
              <Route path="schedule" element={<RoleRoute roles={["PATIENT"]}><Schedule /></RoleRoute>} />
              <Route path="history" element={<RoleRoute roles={["PATIENT"]}><HistoryPage /></RoleRoute>} />
              <Route path="inventory" element={<RoleRoute roles={["PATIENT"]}><InventoryPage /></RoleRoute>} />
              <Route path="refills" element={<RoleRoute roles={["PATIENT"]}><RefillsPage /></RoleRoute>} />
              <Route
                path="caregiver"
                element={<RoleRoute roles={["PATIENT", "CAREGIVER"]}><CaregiverPage /></RoleRoute>}
              />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

/** Nested guard used inside the app layout (session already verified). */
function RoleRoute({ children, roles }: { children: ReactNode; roles: Role[] }) {
  return <RequireAuth roles={roles}>{children}</RequireAuth>;
}
