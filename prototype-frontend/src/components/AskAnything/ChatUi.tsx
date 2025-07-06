import { useState } from "react";

import { UserRound } from "lucide-react";
import Markdown from "react-markdown";

import AMASkeleton from "./AMASkeleton";

import TypingAnimation from "@/components/Animation/TypingAnimation";

import RelevantQuestions from "./RelevantQuestion";

import { ChatResponse } from "@/types";
import RecommendedSources from "./RelevantSources";

interface ChatbotUiProps {
  message?: ChatResponse;
  handleResend?: (q: string, i: number) => void;
  isAnswerBusy?: boolean;
  handleSend?: (q: string) => void;
}

const replaceGreetingMessage = (message: string) => {
  return message.includes("I am your Career Assistant.")
    ? "Hello! I am Cosmic Global Copilot. How can I help you?"
    : message;
};

const ChatbotUi = ({ message, isAnswerBusy, handleSend }: ChatbotUiProps) => {
  const isSelf = message?.sender?.id === 0;

  return (
    <div className="flex flex-col gap-4">
      {isSelf ? (
        <div>
          <div className="flex gap-2 items-center mt-2">
            <UserRound className="h-6 w-6 flex-shrink-0" />
            {message?.messages?.map((msg, i) => {
              return msg.type === "text" ? (
                <div key={i}>
                  <p className=" font-semibold">{msg.value}</p>
                </div>
              ) : (
                <></>
              );
            })}
          </div>
        </div>
      ) : (
        <AMAResponse
          isAnswerBusy={!!isAnswerBusy}
          message={message}
          handleSend={handleSend}
        />
      )}
    </div>
  );
};

interface AMAResponseProps {
  isAnswerBusy: boolean;
  message?: ChatResponse;
  handleSend?: (q: string) => void;
}

const sortOrder = ["recommendations", "text", "relevant_questions"];

const AMAResponse = ({
  isAnswerBusy,
  message,
  handleSend,
}: AMAResponseProps) => {
  const [isTypingAnimationCompleted, setIsTypingAnimationComplete] =
    useState(false);
  if (isAnswerBusy) return <AMASkeleton className="px-4 lg:px-16" />;
  if (!message) return null;
  return (
    <>
      <div className="py-2">
        <div className="flex gap-2 items-center mb-2">
          <img
            src="/Chatbot.svg"
            alt="Chatbot icon"
            width={28}
            height={28}
            className="flex-shrink-0"
          />
          <p className="font-semibold">Answer</p>
        </div>
        {message.messages
          ?.sort(
            (a, b) => sortOrder.indexOf(a.type) - sortOrder.indexOf(b.type)
          )
          ?.map((msg, index) => {
            return (
              <div key={index}>
                {msg.type === "text" && (
                  <div className="ask-anything-text">
                    <div className="hover:cursor-text">
                      {message.isNewMessage ? (
                        <TypingAnimation
                          text={replaceGreetingMessage(msg.value)}
                          delay={5}
                          isMarkdown
                          setIsComplete={setIsTypingAnimationComplete}
                        />
                      ) : (
                        <Markdown>{replaceGreetingMessage(msg.value)}</Markdown>
                      )}
                    </div>
                  </div>
                )}
                {msg.type === "recommendations" && (
                  <RecommendedSources recommendedItems={msg.value.items} />
                )}
                {msg.type === "relevant_questions" &&
                  handleSend &&
                  ((message.isNewMessage && isTypingAnimationCompleted) ||
                    !message?.isNewMessage) && (
                    <RelevantQuestions
                      relevantQuestions={msg.value}
                      handleSubmit={handleSend}
                      className="mt-4"
                    />
                  )}
              </div>
            );
          })}
      </div>
      <hr />
    </>
  );
};

export default ChatbotUi;
