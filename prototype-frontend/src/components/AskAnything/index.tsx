import { useState } from "react";

import AMAMinimalUi from "./FrontUi";
import { ChatResponse } from "@/types";
import ChatContainer from "./ChatContainer";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAskAnything } from "@/services/ask-anything";
import { Separator } from "@/components/ui/separator";
import { MinMaxButton } from "@/components/ui/min-max-button";
import { cn } from "@/lib/utils";

const DEFAULT_INITIAL_ANS: ChatResponse = {
  id: 6926,
  sender: null,
  recipient: {
    id: 111628,
    name: "Cosmic Test",
    slug: "cosmic-test",
    image_path: null,
    type: "user",
  },
  messages: [
    {
      type: "text",
      value:
        "To connect in California, especially in the context of power systems and Distributed Energy Resources (DERs), you should be aware of several key regulations and compliance requirements:\n\n- **Order No. 2222 Implementation**: California ISO (CAISO) is actively working towards implementing Order No. 2222, which facilitates the participation of DERs in electricity markets. CAISO has already achieved partial implementation, with full implementation expected by November 1, 2024.\n- **FCC Network Outage Reporting System (NORS)**: Providers of telecommunications services and Voice over Internet Protocol (VoIP) providers must report communications service outages, including those caused by cyber incidents, to the Federal Communications Commission (FCC) under 47 CFR part 4.\n\nFor further inquiry or assistance, feel free to ask more questions.",
    },
    {
      type: "recommendations",
      value: {
        type: "internal_resource",
        items: [
          {
            id: 167551,
            title: "Federal Energy Regulatory Commission",
            type: "resource",
            sub_type: "external",
            source:
              "https://www.ferc.gov/ferc-order-no-2222-explainer-facilitating-participation-electricity-markets-distributed-energy",
          },
        ],
      },
    },
    {
      type: "relevant_questions",
      value: [],
    }
  ],
  timestamp: "2025-01-08T15:37:46.905731Z",
  room: null,
};

const createUserQuery = (query: string): ChatResponse => ({
  id: Math.floor(Math.random() * 100),
  sender: {
    id: 0,
    name: "Anonymous User",
    image_path: null,
    type: "user",
    slug: "user",
  },
  recipient: null,
  messages: [
    {
      type: "text",
      value: query,
    },
  ],
  timestamp: new Date().toISOString(),
});

const DEFAULT_INITIAL_QUES = createUserQuery("What regulations should I be aware of to connect in California?");

const AskAnything = ({
  isMinimumScreen,
  onFullScreenClick,
  onMinimizeClick,
  className,
}: {
  isMinimumScreen: boolean;
  onFullScreenClick: () => void;
  onMinimizeClick: () => void;
  className?: string;
}) => {
  const [isAnswerBusy, setIsAnswerBusy] = useState(false);
  const [chatList, setChatList] = useState<ChatResponse[]>([
    DEFAULT_INITIAL_ANS,
    DEFAULT_INITIAL_QUES,
  ]);

  const showChat = !!chatList.length;
  const { mutate } = useAskAnything(
    (responseData: { results: ChatResponse }) => {
      if (responseData) {
        setChatList((prevChat) => [
          { ...responseData?.results, isNewMessage: true },
          ...prevChat,
        ]);
      }
      setIsAnswerBusy(false);
    },
    () => {
      setIsAnswerBusy(false);
      setChatList((prevChat) => {
        const updatedChatList = [...prevChat];
        if (updatedChatList[0]) {
          updatedChatList[0].isError = true;
        }
        return updatedChatList;
      });
    }
  );

  const askToChatBot = (query: string) => {
    if (!query) return;
    const parent_chat = chatList[0] ? chatList[0]?.id : null;
    setChatList((prevChat) => {
      const prevResponse = prevChat?.map((prev) => ({
        ...prev,
        isNewMessage: false,
      }));
      return [createUserQuery(query), ...prevResponse];
    });
    setIsAnswerBusy(true);
    mutate({
      question: query,
      parent_chat: parent_chat,
    });
  };

  const paddingClass = isMinimumScreen ? "px-2" : "lg:px-16 2xl:px-64";

  return (
    <div
      className={cn(
        "max-h-[96vh] min-w-[300px] w-full sticky top-4",
        className
      )}
    >
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2 justify-between">
            <CardTitle>Chat with PowerNOVA</CardTitle>
            <MinMaxButton
              showMaximizeButton={isMinimumScreen}
              onFullScreenClick={onFullScreenClick}
              onMinimizeClick={onMinimizeClick}
            />
          </div>
        </CardHeader>
        <Separator />
        <CardDescription className="h-full p-4">
          <div className="h-full w-full">
            <div
              className={cn(
                "mx-auto h-[92%] w-full",
                !isMinimumScreen && "text-base"
              )}
            >
              {!showChat ? (
                <AMAMinimalUi
                  askToChatBot={askToChatBot}
                  className={paddingClass}
                />
              ) : (
                <ChatContainer
                  chatList={chatList}
                  handleSend={askToChatBot}
                  isAnswerBusy={isAnswerBusy}
                  className={paddingClass}
                />
              )}
            </div>
          </div>
        </CardDescription>
      </Card>
    </div>
  );
};

export default AskAnything;
