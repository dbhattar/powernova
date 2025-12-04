import { ExternalLink } from 'lucide-react';
import type { SearchResult } from '@/types';

interface SearchResultCardProps {
  result: SearchResult;
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const scorePercent = result.similarity_score * 100;
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getDocumentIcon = (type: string) => {
    const icons: Record<string, string> = {
      'PDF': '📄',
      'HTML': '🌐',
      'TEXT': '📝',
      'MARKDOWN': '📋',
      'DOCX': '📃',
    };
    return icons[type] || '📄';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg hover:border-primary-300 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0 mt-0.5">
            {getDocumentIcon(result.document_type)}
          </span>
          
          <div className="flex-1 min-w-0">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors flex items-center gap-2 group/link"
            >
              <span className="truncate">{result.title}</span>
              <ExternalLink className="w-4 h-4 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
            </a>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-medium text-gray-500 uppercase">
                {result.document_type}
              </span>
              
              {result.source && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 font-medium">
                    {result.source}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Similarity Score */}
        <div className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${getScoreColor(scorePercent)} flex-shrink-0`}>
          {scorePercent.toFixed(0)}% match
        </div>
      </div>

      {/* Snippet */}
      <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
        {result.snippet}
      </p>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span className="truncate max-w-md" title={result.url}>
          {result.url}
        </span>
        <span className="text-gray-400 ml-2 flex-shrink-0">ID: {result.id}</span>
      </div>
    </div>
  );
}
