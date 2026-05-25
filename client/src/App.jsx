import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Collections from './pages/Collections';
import Customers from './pages/Customers';
import Discounts from './pages/Discounts';
import MediaLibrary from './pages/MediaLibrary';
import SyncLogs from './pages/SyncLogs';
import About from './pages/About';
import { useAuth } from './hooks/useAuth';

function PublicLogin() {
  const { isAuthenticated, isChecking } = useAuth();
  if (isChecking) return <LoadingScreen />;
  if (isAuthenticated()) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicLogin />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/discounts" element={<Discounts />} />
        <Route path="/media" element={<MediaLibrary />} />
        <Route path="/sync-logs" element={<SyncLogs />} />
        <Route path="/about" element={<About />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
