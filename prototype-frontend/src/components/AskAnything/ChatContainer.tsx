import { ChatResponse } from "@/types";

import ChatInput from "./ChatInput";
import AMASkeleton from "./AMASkeleton";
import ChatbotUi from "./ChatUi";
import { cn } from "@/lib/utils";

const ChatContainer = ({
  isAnswerBusy,
  chatList,
  handleSend,
  className,
}: {
  isAnswerBusy: boolean;
  chatList: ChatResponse[];
  handleSend: (q: string) => void;
  className?: string;
}) => {
  return (
    <div className="h-full flex flex-col">
      <div className={cn("flex flex-col-reverse flex-grow gap-4 overflow-y-auto", className)}>
        {isAnswerBusy && <AMASkeleton />}
        {chatList.map((message, index) => (
          <ChatbotUi key={index} message={message} handleSend={handleSend} />
        ))}
      </div>
      <ChatInput
        handleSubmit={isAnswerBusy ? () => {} : handleSend}
        placeholder="Ask anything, expect answer..."
        className={className}
      />
    </div>
  );
};

export default ChatContainer;
