/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import UserDashboard from './pages/user/Dashboard';
import UserTickets from './pages/user/Tickets';
import UserTracking from './pages/user/Tracking';
import UserScanner from './pages/user/Scanner';
import UserRegister from './pages/user/Register';
import AdminDashboard from './pages/admin/Dashboard';
import AdminScanner from './pages/admin/Scanner';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      
      <Route element={<Layout />}>
        {/* Public Routes inside Layout */}
        <Route path="/register" element={<UserRegister />} />

        <Route element={<ProtectedRoute />}>
          {/* Branch Routing based on role */}
          <Route path="/" element={
            user?.role === 'ADMIN' ? <AdminDashboard /> : <UserDashboard />
          } />
          
          {/* User Specific */}
          <Route path="/tickets" element={
            <ProtectedRoute allowedRole="USER">
              <UserTickets />
            </ProtectedRoute>
          } />
          <Route path="/tracking" element={
            <ProtectedRoute allowedRole="USER">
              <UserTracking />
            </ProtectedRoute>
          } />
          <Route path="/scan" element={
            <ProtectedRoute allowedRole="USER">
              <UserScanner />
            </ProtectedRoute>
          } />

          {/* Admin Specific */}
          <Route path="/scanner" element={
            <ProtectedRoute allowedRole="ADMIN">
              <AdminScanner />
            </ProtectedRoute>
          } />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
