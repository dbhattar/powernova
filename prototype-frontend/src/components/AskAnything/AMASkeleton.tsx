import { Skeleton } from "../ui/skeleton";

const AMASkeleton = ({ className }: { className?: string }) => {
  return (
    <div className={className}>
      <div className="flex gap-3">
        <Skeleton className="w-16 h-16" />
        <Skeleton className="w-16 h-16" />
        <Skeleton className="w-16 h-16" />
      </div>
      <div className="flex gap-4 my-4">
        <Skeleton className="w-32 h-2" />
        <Skeleton className="w-32 h-2" />
      </div>
      <div className="flex gap-4 my-4">
        <Skeleton className="w-32 h-2" />
        <Skeleton className="w-32 h-2" />
      </div>
    </div>
  );
};

export default AMASkeleton;
