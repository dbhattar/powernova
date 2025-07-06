import { useMemo } from "react";

import { cn, pickRandomElements } from "@/lib/utils";
import { SendHorizonal } from "lucide-react";
import { useGetOptions } from "@/services/mappings";

const POWER_SYSTEM_DEFAULT_PROMPTS = [
  "What are the latest trends in smart grid technology?",
  "How can we improve the reliability of our power systems?",
  "What are the best practices for implementing predictive maintenance in power systems?",
  "How can IoT be utilized to enhance power system monitoring and management?",
  "What are the key considerations for integrating renewable energy sources into the grid?",
  "How do we address cybersecurity challenges in power system engineering?",
  "What steps can we take to improve energy efficiency in our operations?",
  "How can we implement digital twins in power system engineering?",
  "What are the benefits of adopting advanced distribution management systems (ADMS)?",
  "How can we leverage big data analytics in power system optimization?",
];

const RelevantQuestions = ({
  relevantQuestions,
  handleSubmit,
  className,
  showAll = false,
}: {
  relevantQuestions?: string[];
  handleSubmit: (q: string) => void;
  className?: string;
  showAll?: boolean;
}) => {
  const { options, isLoading } = useGetOptions();

  const defaultPrompts = useMemo(
    () =>
      options?.ama_user_default_prompts?.career_stage
        ? options?.ama_user_default_prompts?.career_stage[0]?.prompts
        : null,
    [options]
  );

  const prompts = useMemo(() => {
    if (!relevantQuestions || !relevantQuestions?.length) {
      return pickRandomElements(
        defaultPrompts ? defaultPrompts : POWER_SYSTEM_DEFAULT_PROMPTS,
        4
      );
    }
    return pickRandomElements(relevantQuestions, 4);
  }, [relevantQuestions, defaultPrompts]);

  if (isLoading) return null;

  return (
    <div className={className}>
      <div className="grid sm:grid-cols-2 gap-4">
        {prompts?.map((q, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center",
              showAll ? "block" : index < 2 ? "block" : "hidden sm:block"
            )}
          >
            <div
              className="h-full p-2 lg:p-4 flex justify-between items-center gap-2 rounded-md bg-slate-50 hover:cursor-pointer hover:bg-orange-50"
              onClick={() => handleSubmit(q)}
            >
              <p className="font-medium text-gray-700">{q}</p>
              <SendHorizonal className="h-5 w-5 text-gray-600 flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RelevantQuestions;
