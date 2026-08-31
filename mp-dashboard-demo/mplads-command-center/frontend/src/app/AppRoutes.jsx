import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../hooks/useAuth';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Login } from '../features/auth/Login';
import { Dashboard } from '../features/dashboard/Dashboard';
import { Projects } from '../features/projects/Projects';
import { ProjectDetails } from '../features/projects/ProjectDetails';
import { ProjectCreate } from '../features/projects/ProjectCreate';
import { FinancialOverview } from '../features/finance/FinancialOverview';
import { ConstituencyMap } from '../features/geography/ConstituencyMap';
import { Contractors } from '../features/contractors/Contractors';
import { ContractorDetails } from '../features/contractors/ContractorDetails';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    window.location.href = isLocal ? 'http://localhost:3000/' : 'https://inspiring-lebkuchen-67d55f.netlify.app/';
    return null;
  }

  return children;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/mp" replace />} />
      <Route path={ROUTES.LOGIN} element={<Login />} />

      <Route
        path="/mp"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Projects */}
        <Route path="projects" element={<Projects />} />
        <Route path="projects/new" element={<ProjectCreate />} />
        <Route path="projects/:id" element={<ProjectDetails />} />

        {/* Finance */}
        <Route path="finance" element={<FinancialOverview />} />
        <Route path="finance/fund-utilization" element={<FinancialOverview />} />
        <Route path="finance/expenditure" element={<FinancialOverview />} />

        {/* Geography */}
        <Route path="geography" element={<ConstituencyMap />} />
        <Route path="geography/development-gaps" element={<ConstituencyMap />} />

        {/* Contractors */}
        <Route path="contractors" element={<Contractors />} />
        <Route path="contractors/:id" element={<ContractorDetails />} />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  );
};
