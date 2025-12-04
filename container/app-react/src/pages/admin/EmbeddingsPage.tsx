import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { adminService } from '@/lib/adminApi';
import {
  Database,
  RefreshCw,
  PlayCircle,
  AlertTriangle,
  CheckCircle,
  Layers,
  TrendingUp,
} from 'lucide-react';

interface LocalEmbeddingStats {
  total_documents: number;
  documents_with_embeddings: number;
  documents_without_embeddings: number;
  total_chunks: number;
  documents_with_old_embeddings: number;
  migration_progress: number;
}

export function EmbeddingsPage() {
  const [stats, setStats] = useState<LocalEmbeddingStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get stats from the system stats endpoint
      const systemStats = await adminService.getSystemStats();
      const embStats: LocalEmbeddingStats = {
        total_documents: systemStats.documents.total,
        documents_with_embeddings: systemStats.documents.with_embeddings,
        documents_without_embeddings: systemStats.documents.total - systemStats.documents.with_embeddings,
        total_chunks: systemStats.embeddings.total_chunks,
        documents_with_old_embeddings: systemStats.embeddings.documents_with_old_embeddings,
        migration_progress: systemStats.embeddings.migration_progress,
      };
      setStats(embStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load embedding stats');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleReprocessDocuments = async () => {
    if (!confirm('Are you sure you want to reprocess embeddings? This will update all selected documents.')) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Use the existing reprocessDocuments method (ignoring documentIds for now as API doesn't support it)
      const result = await adminService.reprocessDocuments();
      setSuccessMessage(`Started reprocessing ${result.job_count} documents.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      // Reload stats after a delay to see progress
      setTimeout(() => loadStats(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start reprocessing');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReprocessOldEmbeddings = async () => {
    if (!stats?.documents_with_old_embeddings) {
      alert('No documents with old embeddings found.');
      return;
    }

    if (!confirm(`Reprocess ${stats.documents_with_old_embeddings} documents with old embeddings?`)) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Use the existing reprocessDocuments method with limit
      const result = await adminService.reprocessDocuments(stats.documents_with_old_embeddings);
      setSuccessMessage(`Started reprocessing ${result.job_count} documents.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      setTimeout(() => loadStats(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start reprocessing');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFindDuplicates = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const duplicates = await adminService.checkDuplicates();
      if (duplicates.duplicate_count === 0) {
        setSuccessMessage('No duplicate documents found.');
      } else {
        setSuccessMessage(`Found ${duplicates.duplicate_count} duplicate documents affecting ${duplicates.affected_urls} URLs.`);
      }
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find duplicates');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Embeddings Management</h1>
            <p className="text-gray-600 mt-1">Monitor and manage document embeddings</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadStats}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              title="Total Documents"
              value={stats.total_documents}
              icon={<Database className="w-5 h-5" />}
            />
            <StatsCard
              title="With Embeddings"
              value={stats.documents_with_embeddings}
              className="border-l-4 border-l-green-500"
              icon={<CheckCircle className="w-5 h-5 text-green-600" />}
            />
            <StatsCard
              title="Without Embeddings"
              value={stats.documents_without_embeddings}
              className="border-l-4 border-l-yellow-500"
              icon={<AlertTriangle className="w-5 h-5 text-yellow-600" />}
            />
            <StatsCard
              title="Total Chunks"
              value={stats.total_chunks}
              className="border-l-4 border-l-purple-500"
              icon={<Layers className="w-5 h-5 text-purple-600" />}
            />
          </div>
        )}

        {/* Migration Progress */}
        {stats && stats.documents_with_old_embeddings > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Migration Progress</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {stats.documents_with_old_embeddings} documents need migration to new embedding model
                </p>
              </div>
              <button
                onClick={handleReprocessOldEmbeddings}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50"
              >
                <PlayCircle className="w-4 h-4" />
                Migrate Old Embeddings
              </button>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-4 rounded-full transition-all flex items-center justify-center text-xs text-white font-semibold"
                style={{ width: `${stats.migration_progress}%` }}
              >
                {stats.migration_progress.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Reprocess All */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <RefreshCw className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Reprocess All</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Regenerate embeddings for all documents. Use this after updating the embedding model or configuration.
            </p>
            <button
              onClick={handleReprocessDocuments}
              disabled={isProcessing}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Reprocess All Embeddings'}
            </button>
          </div>

          {/* Find Duplicates */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Find Duplicates</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Scan for duplicate documents based on content similarity. Helps maintain data quality.
            </p>
            <button
              onClick={handleFindDuplicates}
              disabled={isProcessing}
              className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Scanning...' : 'Find Duplicates'}
            </button>
          </div>

          {/* Embedding Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Statistics</h3>
            </div>
            {stats && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Coverage:</span>
                  <span className="font-semibold text-gray-900">
                    {((stats.documents_with_embeddings / stats.total_documents) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Avg Chunks/Doc:</span>
                  <span className="font-semibold text-gray-900">
                    {stats.documents_with_embeddings > 0
                      ? (stats.total_chunks / stats.documents_with_embeddings).toFixed(1)
                      : 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Old Embeddings:</span>
                  <span className="font-semibold text-gray-900">
                    {stats.documents_with_old_embeddings}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-sm font-semibold text-blue-900 mb-3">About Embeddings</h4>
          <ul className="text-sm text-blue-700 space-y-2">
            <li>• Embeddings are vector representations of document content used for semantic search</li>
            <li>• Documents are split into chunks for better granularity in search results</li>
            <li>• Reprocessing may be needed after model updates or configuration changes</li>
            <li>• Old embeddings from previous models should be migrated for consistent search quality</li>
            <li>• Duplicate detection helps maintain a clean knowledge base</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
