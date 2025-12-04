import React from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Search across thousands of energy documents...',
}: SearchBarProps) {
  return (
    <div className="sticky top-16 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form onSubmit={onSubmit} className="relative">
          <div className="flex items-center gap-4 bg-gray-50 border-2 border-gray-200 rounded-xl px-5 py-3.5 transition-all focus-within:border-primary-500 focus-within:shadow-md">
            <Search className="w-6 h-6 text-gray-400 flex-shrink-0" />
            
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-base"
              autoComplete="off"
              disabled={isLoading}
            />
            
            <Button
              type="submit"
              size="icon"
              className="rounded-full w-11 h-11 flex-shrink-0"
              disabled={!value.trim() || isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
