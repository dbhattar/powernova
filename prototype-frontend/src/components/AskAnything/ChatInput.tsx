import { useCallback, useState } from "react";

import { Input } from "@/components/ui/input";

import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ChatInput = ({
  handleSubmit,
  placeholder,
  className,
}: {
  handleSubmit: (q: string) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [query, setQuery] = useState("");

  const onSend = useCallback(() => {
    if (!query) return;
    handleSubmit(query);
    setQuery("");
  }, [handleSubmit, query]);

  return (
    <div className={cn(className, "flex items-center gap-2")}>
      <Input
        type="text"
        placeholder={placeholder || "Ask anything, expect answer..."}
        className="w-full h-12 sm:h-16"
        value={query}
        onChange={(ev) => setQuery(ev.target.value)}
        onKeyUp={(e) => {
          if (e.key === "Enter" && !e.shiftKey) onSend();
        }}
      />
      <Button variant="ghost" className="px-1" onClick={onSend}>
        <SendHorizontal
          className="flex-shrink-0 min-h-6 min-w-6 cursor-pointer text-gray-600 hover:text-gray-500"
        />
      </Button>
    </div>
  );
};

export default ChatInput;
