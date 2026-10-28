import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/layout.jsx';
import { Spinner } from './components/form.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import { CompaniesPage } from './pages/CompaniesPage.jsx';
import { CompanyPage } from './pages/CompanyPage.jsx';
import { CompanyFormPage } from './pages/CompanyFormPage.jsx';
import { EmployeePage } from './pages/EmployeePage.jsx';
import { EmployeeFormPage } from './pages/EmployeeFormPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

// Anonymous visitors are sent to the login page; everything below this guard needs a session.
function RequireAuth() {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

// The server serves this SPA under /admin/, so all routes are relative to that base.
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route index element={<CompaniesPage />} />
            <Route path="account" element={<ProfilePage />} />
            <Route path="companies/new" element={<CompanyFormPage />} />
            <Route path="companies/:id" element={<CompanyPage />} />
            <Route path="companies/:id/edit" element={<CompanyFormPage />} />
            <Route path="companies/:companyId/employees/new" element={<EmployeeFormPage />} />
            <Route path="employees/:id" element={<EmployeePage />} />
            <Route path="employees/:id/edit" element={<EmployeeFormPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
