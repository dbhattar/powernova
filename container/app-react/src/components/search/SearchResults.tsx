import { ChevronLeft, ChevronRight, Search as SearchIcon, Inbox } from 'lucide-react';
import { SearchResultCard } from './SearchResultCard';
import { Button } from '@/components/ui/button';
import type { SearchResponse } from '@/types';

interface SearchResultsProps {
  data: SearchResponse;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function SearchResults({ data, onPageChange, isLoading }: SearchResultsProps) {
  const { results, total, page, pages, query, search_time_ms } = data;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mb-6" />
          <p className="text-gray-600 text-lg">Searching across documents...</p>
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center justify-center text-center py-20">
          <Inbox className="w-20 h-20 text-gray-300 mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No documents found</h2>
          <p className="text-gray-600 mb-8 max-w-md">
            Try adjusting your search query or using different keywords
          </p>
          <div className="bg-gray-50 rounded-lg p-6 max-w-md">
            <p className="font-semibold text-gray-900 mb-3">Search tips:</p>
            <ul className="text-left text-sm text-gray-600 space-y-2">
              <li>• Use specific terms related to energy markets</li>
              <li>• Try ISO/RTO names: CAISO, ERCOT, PJM, MISO</li>
              <li>• Search for document types: tariff, manual, protocol</li>
              <li>• Be descriptive: "interconnection deposit requirements"</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Info */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2 text-gray-600">
          <SearchIcon className="w-5 h-5" />
          <span>
            Results for: <strong className="text-gray-900">&quot;{query}&quot;</strong>
          </span>
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{total.toLocaleString()}</span> documents
          <span className="text-gray-400 ml-2">• {search_time_ms}ms</span>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4 mb-8">
        {results.map((result) => (
          <SearchResultCard key={result.id} result={result} />
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 py-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            Page <span className="font-semibold text-gray-900">{page}</span> of{' '}
            <span className="font-semibold text-gray-900">{pages}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page === pages}
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
