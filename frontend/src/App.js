import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import POS from './pages/POS';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <div className="app-main">
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pos" element={
              <ProtectedRoute>
                <POS />
              </ProtectedRoute>
            }/>
            <Route path="/admin" element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }/>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  const target = !user ? "/login" : user.role === "admin" ? "/admin" : "/pos";
  return <Navigate to={target} replace />;
}

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Wrong role — send the user to their own home page, not back to login.
  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/pos"} replace />;
  }
  return children;
}

export default App;
