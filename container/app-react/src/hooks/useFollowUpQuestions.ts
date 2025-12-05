import { useState } from 'react';
import { API_URL } from '@/lib/config';
import { Message } from '../types';

interface FollowUpQuestion {
  text: string;
  icon: string;
}

interface FollowUpResponse {
  questions: FollowUpQuestion[];
}

export const useFollowUpQuestions = () => {
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuestions = async (messages: Message[], count: number = 3) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/chat/follow-up-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          count,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: FollowUpResponse = await response.json();
      setQuestions(data.questions);
    } catch (err) {
      console.error('Error generating follow-up questions:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate questions');
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearQuestions = () => {
    setQuestions([]);
    setError(null);
  };

  return {
    questions,
    isLoading,
    error,
    generateQuestions,
    clearQuestions,
  };
};
