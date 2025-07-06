import { Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MinMaxButton({
  showMaximizeButton,
  onFullScreenClick,
  onMinimizeClick,
}: {
  showMaximizeButton: boolean;
  onFullScreenClick: () => void;
  onMinimizeClick: () => void;
}) {
  return (
    <div className="hidden lg:flex gap-2 w-max space-x-0">
      {showMaximizeButton ? (
        <Button
          variant={"ghost"}
          className="rounded-full p-1 w-max h-max"
          onClick={onFullScreenClick}
        >
          {showMaximizeButton ? <Maximize /> : <Minimize />}
        </Button>
      ) : (
        <Button
          variant={"ghost"}
          className="rounded-full p-1 w-max h-max"
          onClick={onMinimizeClick}
        >
          <Minimize />
        </Button>
      )}
    </div>
  );
}
