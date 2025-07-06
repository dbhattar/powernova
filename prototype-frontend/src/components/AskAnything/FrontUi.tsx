import { useCallback } from "react";

import ChatInput from "./ChatInput";
import RelevantQuestions from "./RelevantQuestion";
import { cn } from "@/lib/utils";

const AMAMinimalUi = ({
  askToChatBot,
  relevantQueries,
  className,
}: {
  askToChatBot: (query: string) => void;
  relevantQueries?: string[];
  className?: string;
}) => {
  const handleSubmit = useCallback(
    (query: string) => {
      askToChatBot(query);
    },
    [askToChatBot]
  );

  return (
    <div className={cn("h-full flex flex-col justify-end", className)}>
      <div>
        <RelevantQuestions
          relevantQuestions={relevantQueries}
          handleSubmit={handleSubmit}
          className="mb-4"
        />
      </div>
      <ChatInput handleSubmit={handleSubmit} />
    </div>
  );
};

export default AMAMinimalUi;
