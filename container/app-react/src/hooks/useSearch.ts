import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSearchParams } from 'react-router-dom';

export function useSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const [searchQuery, setSearchQuery] = useState(query);

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', query, page],
    queryFn: () => api.search.query(query, page),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleSearch = (newQuery: string) => {
    setSearchParams({ q: newQuery, page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ q: query, page: newPage.toString() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    query,
    searchQuery,
    setSearchQuery,
    page,
    data,
    isLoading,
    error,
    handleSearch,
    handlePageChange,
  };
}
