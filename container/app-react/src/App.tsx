import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { MaintenanceProvider, useMaintenance } from './contexts/MaintenanceContext';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { SearchPage } from './pages/SearchPage';
import { ChatPage } from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UsersPage } from './pages/admin/UsersPage';
import { CrawlJobsPage } from './pages/admin/CrawlJobsPage';
import { DocumentsPage } from './pages/admin/DocumentsPage';
import { EmbeddingsPage } from './pages/admin/EmbeddingsPage';
import { ProcessingJobsPage } from './pages/admin/ProcessingJobsPage';
import { DataQualityPage } from './pages/admin/DataQualityPage';
import { FeedbackPage } from './pages/admin/FeedbackPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { isMaintenanceMode, maintenanceMessage, estimatedDuration, isChecking } = useMaintenance();

  // Show loading state while checking maintenance status
  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show maintenance screen if in maintenance mode
  if (isMaintenanceMode) {
    return <MaintenanceScreen message={maintenanceMessage} estimatedDuration={estimatedDuration} />;
  }

  // Normal app routes
  return (
    <BrowserRouter basename="/react">
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/content/crawl-jobs" element={<CrawlJobsPage />} />
        <Route path="/admin/content/documents" element={<DocumentsPage />} />
        <Route path="/admin/content/embeddings" element={<EmbeddingsPage />} />
        <Route path="/admin/data-quality" element={<DataQualityPage />} />
        <Route path="/admin/processing" element={<ProcessingJobsPage />} />
        <Route path="/admin/feedback" element={<FeedbackPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MaintenanceProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </MaintenanceProvider>
    </QueryClientProvider>
  );
}

export default App;
