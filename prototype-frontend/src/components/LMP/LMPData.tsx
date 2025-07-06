import { useMemo } from "react";
import { DollarSign, Zap, GitBranch, Droplet } from "lucide-react";

import { LMPResponse } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { findColumnIndex, getLastElement } from "@/lib/utils";

const DataItems = [
  {
    label: "LMP",
    value: 0,
    icon: DollarSign,
  },
  {
    label: "Energy",
    value: 0,
    icon: Zap,
  },
  {
    label: "Congestion",
    value: 0,
    icon: GitBranch,
  },
  {
    label: "Loss",
    value: 0,
    icon: Droplet,
  },
];

export const LMPData = ({
  lmpData,
  isLoading,
}: {
  lmpData?: LMPResponse;
  isLoading?: boolean;
}) => {
  const lmpValue = getLastElement(lmpData?.rows);

  const dataItems = useMemo(() => {
    if (!lmpValue || !lmpData) return DataItems;
    return DataItems.map((item) => ({
      ...item,
      value: Number(lmpValue[findColumnIndex(lmpData.columns, `${item.label}`)]),
    }));
  }, [lmpValue, lmpData]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {dataItems.map((item) => (
        <Card key={item.label} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-muted-foreground">
                {item.label}
              </h4>
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="text-3xl font-bold">
                $
                {typeof item.value === "number"
                  ? item.value.toFixed(3)
                  : "0.000"}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
