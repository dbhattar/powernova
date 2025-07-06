import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex h-screen sm:px-12 sm:py-12">
      {/* Left Panel */}
      <div className="flex-1 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Skeleton className="h-8 w-[400px] mb-2" />
            <Skeleton className="h-4 w-[250px]" />
          </div>
        </div>

        {/* Filter Section Skeleton */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <Skeleton className="h-10 w-[180px]" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-[120px]" />
              <Skeleton className="h-10 w-[100px]" />
            </div>
          </div>
        </div>

        {/* Map Section Skeleton */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-[150px]" />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-[140px]" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-[80px]" />
              </div>
            </div>
          </div>
          <Skeleton className="h-[500px] w-full rounded-lg" />
        </div>
      </div>

      {/* Right Panel - Chat Section */}
      <div className="w-[600px]">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-6">
            <Skeleton className="h-6 w-[200px]" />
          </div>

          <div className="flex-1 p-6 overflow-auto space-y-6">
            {/* Chat Messages Skeleton */}
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-[80%]" />
                  <Skeleton className="h-4 w-[60%]" />
                </div>
              </div>
            ))}

            <div className="space-y-4 mt-8">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>

          <div className="p-6">
            <div className="relative">
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}