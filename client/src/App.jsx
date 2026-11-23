import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './components/AppShell.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';
import { Spinner } from './components/ui.jsx';

// The editor pulls in TipTap/ProseMirror, so it is loaded only when a document is opened.
const Editor = lazy(() => import('./pages/Editor.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="documents" replace />} />
              <Route path="documents" element={<Dashboard view="mine" />} />
              <Route path="shared" element={<Dashboard view="shared" />} />
            </Route>
            <Route
              path="/app/doc/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner label="Opening document" /></div>}><Editor /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
