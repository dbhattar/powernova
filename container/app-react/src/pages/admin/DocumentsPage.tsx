import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { adminService } from '@/lib/adminApi';
import type { AdminDocument } from '@/types/admin';
import {
  FileText,
  RefreshCw,
  Search,
  Trash2,
  Download,
  CheckCircle,
  XCircle,
  Layers,
} from 'lucide-react';

export function DocumentsPage() {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<AdminDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEmbedding, setFilterEmbedding] = useState<'all' | 'with' | 'without'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [successMessage, setSuccessMessage] = useState('');

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getDocuments();
      setDocuments(data);
      setFilteredDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    let filtered = documents;

    // Filter by embedding status
    if (filterEmbedding === 'with') {
      filtered = filtered.filter(d => d.embedding_generated);
    } else if (filterEmbedding === 'without') {
      filtered = filtered.filter(d => !d.embedding_generated);
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(d => d.document_type === filterType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.url.toLowerCase().includes(query) ||
        (d.title && d.title.toLowerCase().includes(query))
      );
    }

    setFilteredDocuments(filtered);
  }, [documents, searchQuery, filterEmbedding, filterType]);

  const handleDeleteDocument = async (doc: AdminDocument) => {
    if (!confirm(`Are you sure you want to delete "${doc.title || doc.url}"?`)) {
      return;
    }

    try {
      await adminService.deleteDocument(doc.id);
      setSuccessMessage('Document deleted successfully');
      setTimeout(() => setSuccessMessage(''), 5000);
      loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const totalDocuments = documents.length;
  const withEmbeddings = documents.filter(d => d.embedding_generated).length;
  const withoutEmbeddings = documents.filter(d => !d.embedding_generated).length;
  const totalChunks = documents.reduce((sum, d) => sum + d.chunk_count, 0);

  // Get unique document types
  const documentTypes = Array.from(new Set(documents.map(d => d.document_type)));

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <p className="text-gray-600 mt-1">View and manage crawled documents</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadDocuments}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Total Documents"
            value={totalDocuments}
            icon={<FileText className="w-5 h-5" />}
          />
          <StatsCard
            title="With Embeddings"
            value={withEmbeddings}
            className="border-l-4 border-l-green-500"
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          />
          <StatsCard
            title="Without Embeddings"
            value={withoutEmbeddings}
            className="border-l-4 border-l-yellow-500"
            icon={<XCircle className="w-5 h-5 text-yellow-600" />}
          />
          <StatsCard
            title="Total Chunks"
            value={totalChunks}
            className="border-l-4 border-l-purple-500"
            icon={<Layers className="w-5 h-5 text-purple-600" />}
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by URL or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Embedding Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterEmbedding('all')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterEmbedding === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterEmbedding('with')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterEmbedding === 'with'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                With Embeddings
              </button>
              <button
                onClick={() => setFilterEmbedding('without')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterEmbedding === 'without'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Without
              </button>
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {documentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Embeddings
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
                {filteredDocuments.map((doc) => (
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
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        {doc.document_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {doc.embedding_generated ? (
                        <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400 inline-block" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {doc.chunk_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {doc.blob_url && (
                          <a
                            href={doc.blob_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Download document"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteDocument(doc)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredDocuments.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-500">
                {searchQuery || filterEmbedding !== 'all' || filterType !== 'all'
                  ? 'No documents found matching your filters'
                  : 'No documents yet.'}
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
