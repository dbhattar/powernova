import React from 'react';

interface FollowUpQuestion {
  text: string;
  icon: string;
}

interface FollowUpQuestionsProps {
  questions: FollowUpQuestion[];
  onQuestionClick: (question: string) => void;
  isLoading?: boolean;
}

export const FollowUpQuestions: React.FC<FollowUpQuestionsProps> = ({
  questions,
  onQuestionClick,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
          <span>Generating follow-up questions...</span>
        </div>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        Suggested follow-up questions:
      </h4>
      <div className="grid gap-2">
        {questions.map((question, idx) => (
          <button
            key={idx}
            onClick={() => onQuestionClick(question.text)}
            className="flex items-center gap-3 px-4 py-3 text-left text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-purple-400 transition-colors group"
          >
            <span className="text-purple-600 group-hover:text-purple-700 flex-shrink-0">
              <i className={question.icon}></i>
            </span>
            <span className="text-gray-700 group-hover:text-gray-900">
              {question.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
