import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import BrandLogo from "./components/BrandLogo";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import OrgPortal from "./pages/OrgPortal";
import SuperAdminLogin from "./pages/SuperAdminLogin";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Tables from "./pages/Tables";
import Orders from "./pages/Orders";
import MenuPage from "./pages/Menu";
import MenuCategories from "./pages/MenuCategories";
import KDS from "./pages/KDS";
import Customers from "./pages/Customers";
import Reports from "./pages/Reports";
import UsersPage from "./pages/Users";
import Restaurants from "./pages/Restaurants";
import Settings from "./pages/Settings";
import AuditLogs from "./modules/hq/AuditLogs";
import PayInvoice from "./pages/PayInvoice";
import { canAccessPath, homePath, isMainAdmin, isOrgAdmin } from "./modules/roles";
import { guestLoginPath } from "./lib/platform";
import Organizations from "./pages/Organizations";
import OrganizationHub from "./pages/OrganizationHub";

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (!isMainAdmin(user) && !isOrgAdmin(user)) return <Navigate to={homePath(user)} replace />;
  return children;
}

function SuperOnly({ children }) {
  const { user } = useAuth();
  if (!isMainAdmin(user)) return <Navigate to={homePath(user)} replace />;
  return children;
}

function RoleGate({ children, path }) {
  const { user } = useAuth();
  if (!canAccessPath(user, path)) return <Navigate to={homePath(user)} replace />;
  return children;
}

function HomeIndex() {
  const { user } = useAuth();
  if (isMainAdmin(user)) return <Organizations />;
  if (user?.role !== "org_admin" && user?.role !== "manager") {
    return <Navigate to={homePath(user)} replace />;
  }
  return <Dashboard />;
}

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-tdcp-800" style={{ background: "var(--app-bg)", color: "var(--app-text)" }}>
        <div className="flex flex-col items-center gap-3">
          <BrandLogo size={88} />
          <p className="text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to={guestLoginPath()} replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/login/servex" element={<SuperAdminLogin />} />
          <Route path="/login" element={<OrgPortal />} />
          <Route path="/login/:orgCode" element={<Login />} />
          <Route path="/:orgCode/login" element={<Login />} />
          <Route
            path="/pay/:orderId"
            element={
              <Guard>
                <RoleGate path="/pay">
                  <PayInvoice />
                </RoleGate>
              </Guard>
            }
          />
          <Route
            path="/"
            element={
              <Guard>
                <NotificationProvider>
                  <AppLayout />
                </NotificationProvider>
              </Guard>
            }
          >
            <Route index element={<HomeIndex />} />
            <Route path="pos" element={<RoleGate path="/pos"><POS /></RoleGate>} />
            <Route path="tables" element={<RoleGate path="/tables"><Tables /></RoleGate>} />
            <Route path="orders" element={<RoleGate path="/orders"><Orders /></RoleGate>} />
            <Route path="menu" element={<RoleGate path="/menu"><MenuPage /></RoleGate>} />
            <Route path="menu/categories" element={<RoleGate path="/menu"><MenuCategories /></RoleGate>} />
            <Route path="kds" element={<RoleGate path="/kds"><KDS /></RoleGate>} />
            <Route path="customers" element={<RoleGate path="/customers"><Customers /></RoleGate>} />
            <Route path="reports" element={<RoleGate path="/reports"><Reports /></RoleGate>} />
            <Route path="audit-logs" element={<RoleGate path="/audit-logs"><AuditLogs /></RoleGate>} />
            <Route path="users" element={<RoleGate path="/users"><UsersPage /></RoleGate>} />
            <Route path="organizations" element={<SuperOnly><Organizations /></SuperOnly>} />
            <Route path="organizations/:orgId" element={<SuperOnly><OrganizationHub /></SuperOnly>} />
            <Route path="restaurants" element={<AdminOnly><Restaurants /></AdminOnly>} />
            <Route path="settings" element={<AdminOnly><Settings /></AdminOnly>} />
          </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
