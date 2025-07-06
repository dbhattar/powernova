import { useCallback, useState } from "react";

import { Link } from "react-router-dom";

import { Maximize } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InterConnectionLevelT, Poi } from "@/types";
import { sortSubstations } from "@/lib/utils";
import PoiTable from "./PoiTable";
import { Button } from "@/components/ui/button";

type Headers =
  | "name"
  | "heatmap_available_capacity"
  | "constraints_available_capacity"
  | "current_queue"
  | "total_projects"
  | "policy_portfolio"
  | "constrains_number_from_heatmap"
  | "constrains_number_from_constraints";

export const PoiInformation = ({
  filteredPois,
  compareChecked,
  comparedPois,
  substationType,
  interconnectionEntity,
}: {
  filteredPois: Poi[];
  compareChecked: boolean;
  comparedPois: Poi[];
  substationType: InterConnectionLevelT;
  interconnectionEntity: string;
}) => {
  const [sortedPois, setSortedPois] = useState<Poi[]>([]);
  const [isAsc, setIsAsc] = useState(true);

  const sortPois = useCallback(
    (sortBy: string) => {
      const sorted = sortSubstations(filteredPois, isAsc, sortBy);
      setIsAsc(!isAsc);
      setSortedPois(sorted);
    },
    [isAsc, filteredPois]
  );

  const finalData = sortedPois?.length > 0 ? sortedPois : filteredPois;

  if (!finalData) {
    return null;
  }

  return (
    <div className="">
      <Card className="w-full max-h-[500px] overflow-auto ">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between">
          <div className="space-y-1.5">
            <CardTitle>Information By POI</CardTitle>
            <CardDescription>
              Detailed information for each point of interconnection
            </CardDescription>
          </div>
          {compareChecked &&
            finalData?.length &&
            substationType === "transmission" && (
              <Link
                to={`/poi-comparison/?pois=${encodeURIComponent(
                  comparedPois?.map((poi) => poi.id).join(",")
                )}&from=${encodeURIComponent(window.location.pathname)}`}
              >
                <Button variant="outline">
                  <Maximize className="h-4 w-4 group-hover:scale-110" />
                  <p className="text-gray-600">Show Detailed Comparison</p>
                </Button>
              </Link>
            )}
        </CardHeader>
        <CardContent className="md:pt-0">
          <PoiTable
            sortPois={sortPois}
            filteredPois={finalData}
            substationType={substationType}
            interconnectionEntity={interconnectionEntity}
          />
        </CardContent>
      </Card>
    </div>
  );
};
