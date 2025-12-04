import { Zap, Search as SearchIcon } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { useSearch } from '@/hooks/useSearch';

export function SearchPage() {
  const {
    searchQuery,
    setSearchQuery,
    data,
    isLoading,
    handleSearch,
    handlePageChange,
  } = useSearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleSearch(searchQuery);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Zap className="w-7 h-7 text-primary-500" />
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">PowerNOVA</h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded">
                  Search
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">
                  Beta
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="/"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
              >
                💬 Chat
              </a>
              <a
                href="/search.html"
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Classic Version
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />

      {/* Main Content */}
      <main>
        {!data && !isLoading ? (
          // Initial empty state
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col items-center justify-center text-center py-20">
              <SearchIcon className="w-24 h-24 text-gray-300 mb-8" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Search PowerNOVA Documents
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl">
                Access thousands of energy regulatory and operational documents from ISO/RTO markets
              </p>

              {/* Suggestion Chips */}
              <div className="mb-8">
                <p className="font-semibold text-gray-900 mb-4">Try searching for:</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                  {[
                    'CAISO interconnection',
                    'ERCOT market rules',
                    'PJM capacity market',
                    'FERC Order 2023',
                    'tariff requirements',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setSearchQuery(suggestion);
                        handleSearch(suggestion);
                      }}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-primary-500 hover:bg-gradient-to-r hover:from-primary-50 hover:to-secondary-50 transition-all hover:shadow-md"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Sources */}
              <div className="mt-8">
                <h3 className="font-semibold text-gray-900 mb-4">Data Sources</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['CAISO', 'ERCOT', 'PJM', 'MISO', 'SPP', 'NYISO', 'ISO-NE', 'FERC'].map(
                    (source) => (
                      <span
                        key={source}
                        className="px-3 py-1.5 bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-200 rounded-md text-sm font-semibold text-primary-700"
                      >
                        {source}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : data ? (
          <SearchResults
            data={data}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        ) : null}
      </main>
    </div>
  );
}
