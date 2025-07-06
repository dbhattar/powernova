import React, { useState, useEffect } from "react";
import Markdown from "react-markdown";

interface TypingAnimationProps {
  text: string;
  isInfinite?: boolean;
  delay?: number;
  isMarkdown?: boolean;
  setIsComplete?: (_: boolean) => void;
}

const TypingAnimation: React.FC<TypingAnimationProps> = ({
  text,
  isInfinite = false,
  delay = 100,
  isMarkdown = false,
  setIsComplete = () => undefined,
}) => {
  const [currentText, setCurrentText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (currentIndex >= text.length) {
      if (setIsComplete) setIsComplete(true);
    }
    if (currentIndex < text.length) {
      timeout = setTimeout(() => {
        setCurrentText((prevText) => prevText + text[currentIndex]);
        setCurrentIndex((prevIndex) => prevIndex + 1);
      }, delay);
    } else if (isInfinite) {
      setCurrentIndex(0);
      setCurrentText("");
    }
    return () => clearTimeout(timeout);
  }, [currentIndex, delay, text, isInfinite, setIsComplete]);

  return (
    <div>{isMarkdown ? <Markdown>{currentText}</Markdown> : currentText}</div>
  );
};

export default TypingAnimation;
