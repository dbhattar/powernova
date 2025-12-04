import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { SearchPage } from './pages/SearchPage';
import { ChatPage } from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { UsersPage } from './pages/admin/UsersPage';
import { CrawlJobsPage } from './pages/admin/CrawlJobsPage';
import { DocumentsPage } from './pages/admin/DocumentsPage';
import { EmbeddingsPage } from './pages/admin/EmbeddingsPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
