import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { adminService } from '@/lib/adminApi';
import type { AdminDocument } from '@/types/admin';
import {
  AlertTriangle,
  RefreshCw,
  Trash2,
  FileText,
  Copy,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

export function DataQualityPage() {
  const [duplicateStats, setDuplicateStats] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<AdminDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [duplicates, anomaliesData] = await Promise.all([
        adminService.checkDuplicates(),
        adminService.getTokenAnomalies(50),
      ]);
      setDuplicateStats(duplicates);
      setAnomalies(anomaliesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data quality info');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRemoveDuplicates = async () => {
    if (!confirm('Are you sure you want to remove duplicate documents? This action cannot be undone.')) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await adminService.removeDuplicates();
      setSuccessMessage(`Removed ${result.documents_deleted} duplicate documents and ${result.chunks_deleted} chunks`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove duplicates');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAnomaly = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await adminService.deleteDocument(docId);
      setSuccessMessage('Document deleted successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Quality</h1>
            <p className="text-gray-600 mt-1">Monitor and improve data quality</p>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatsCard
            title="Duplicate Documents"
            value={duplicateStats?.duplicate_count || 0}
            className="border-l-4 border-l-yellow-500"
            icon={<Copy className="w-5 h-5 text-yellow-600" />}
          />
          <StatsCard
            title="Affected URLs"
            value={duplicateStats?.affected_urls || 0}
            className="border-l-4 border-l-orange-500"
            icon={<FileText className="w-5 h-5 text-orange-600" />}
          />
          <StatsCard
            title="Token Anomalies"
            value={anomalies.length}
            className="border-l-4 border-l-red-500"
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          />
        </div>

        {/* Duplicate Detection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Duplicate Detection</h3>
              <p className="text-sm text-gray-600 mt-1">
                Find and remove duplicate documents based on content similarity
              </p>
            </div>
            <button
              onClick={handleRemoveDuplicates}
              disabled={isProcessing || !duplicateStats?.duplicate_count}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Remove Duplicates
            </button>
          </div>

          {duplicateStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Duplicates</p>
                <p className="text-2xl font-bold text-gray-900">{duplicateStats.duplicate_count}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">URLs with Duplicates</p>
                <p className="text-2xl font-bold text-gray-900">{duplicateStats.affected_urls}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Potential Savings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {duplicateStats.duplicate_count > 0 
                    ? `${((duplicateStats.duplicate_count / (duplicateStats.duplicate_count + duplicateStats.affected_urls)) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Token Anomalies */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Token Anomalies</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Documents with unusual token counts that may indicate quality issues
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chunks
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {anomalies.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <div className="font-medium text-gray-900 truncate" title={doc.title}>
                          {doc.title || 'Untitled'}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={doc.url}>
                          {doc.url}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                        <AlertTriangle className="w-3 h-3" />
                        {doc.chunk_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleDeleteAnomaly(doc.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {anomalies.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p>No token anomalies detected. Your data quality looks good!</p>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              </div>
            )}
          </div>
        </div>

        {/* Quality Score */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Overall Data Quality</h3>
              <p className="text-sm text-gray-600">Based on duplicate count and anomalies</p>
            </div>
          </div>

          {duplicateStats && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-green-600 to-green-400 h-4 rounded-full transition-all flex items-center justify-center text-xs text-white font-semibold"
                    style={{
                      width: `${Math.max(
                        0,
                        100 - 
                        (duplicateStats.duplicate_count * 10) - 
                        (anomalies.length * 5)
                      )}%`,
                    }}
                  >
                    {Math.max(
                      0,
                      100 - 
                      (duplicateStats.duplicate_count * 10) - 
                      (anomalies.length * 5)
                    ).toFixed(0)}%
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {Math.max(
                    0,
                    100 - 
                    (duplicateStats.duplicate_count * 10) - 
                    (anomalies.length * 5)
                  ).toFixed(0)}
                </p>
                <p className="text-xs text-gray-600">Quality Score</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
