import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/layout.jsx';
import { CompaniesPage } from './pages/CompaniesPage.jsx';
import { CompanyPage } from './pages/CompanyPage.jsx';
import { CompanyFormPage } from './pages/CompanyFormPage.jsx';
import { EmployeePage } from './pages/EmployeePage.jsx';
import { EmployeeFormPage } from './pages/EmployeeFormPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

// The server serves this SPA under /admin/, so all routes are relative to that base.
export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<CompaniesPage />} />
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
  );
}
