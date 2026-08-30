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
    window.location.href = 'http://localhost:3000/';
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
        <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />

        {/* Projects */}
        <Route path={ROUTES.PROJECTS} element={<Projects />} />
        <Route path={ROUTES.PROJECT_CREATE} element={<ProjectCreate />} />
        <Route path={ROUTES.PROJECT_DETAILS} element={<ProjectDetails />} />

        {/* Finance */}
        <Route path={ROUTES.FINANCE} element={<FinancialOverview />} />
        <Route path={ROUTES.FUND_UTILIZATION} element={<FinancialOverview />} />
        <Route path={ROUTES.EXPENDITURE} element={<FinancialOverview />} />

        {/* Geography */}
        <Route path={ROUTES.GEOGRAPHY} element={<ConstituencyMap />} />
        <Route path={ROUTES.DEVELOPMENT_GAPS} element={<ConstituencyMap />} />

        {/* Contractors */}
        <Route path={ROUTES.CONTRACTORS} element={<Contractors />} />
        <Route path={ROUTES.CONTRACTOR_DETAILS} element={<ContractorDetails />} />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  );
};
