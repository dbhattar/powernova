import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { LMPComparisonChart } from "@/components/LMP/LMPComparisonChart";
import { Poi } from "@/types";
import PoiTable from "@/components/PoiList/PoiTable";
import { useGetSubstations } from "@/services/substation";
import { sortSubstations } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapCard from "@/components/Map/MapCard";

export default function PoiComparison() {
  const { substationsData, isLoading } = useGetSubstations("transmission");
  const [sortedPois, setSortedPois] = useState<Poi[]>([]);
  const [isAsc, setIsAsc] = useState(true);
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const selectedPoiIds = (searchParams.get("pois") || "")
    .split(",")
    .filter((x) => !!x);
  const from = searchParams.get("from") || "/";

  const selectedPois = useMemo(
    () =>
      selectedPoiIds
        ?.map((id) => substationsData.find((poi) => poi.id === id))
        ?.filter((x) => !!x),
    [substationsData, selectedPoiIds]
  );

  const sortPois = useCallback(
    (sortBy: string) => {
      const sorted = sortSubstations(selectedPois, isAsc, sortBy);
      setIsAsc(!isAsc);
      setSortedPois(sorted);
    },
    [isAsc, selectedPois]
  );

  const onBackClick = useCallback(() => {
    navigate(
      `${from}?pois=${encodeURIComponent(
        selectedPoiIds?.join(",")
      )}&compare=true`
    );
  }, [navigate, selectedPoiIds, from]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="w-full flex justify-between items-center">
        <h1 className="text-3xl font-bold">POI Comparison</h1>
        <Button variant="ghost" size="sm" onClick={onBackClick} className="p-2">
          <ArrowLeft className="h-5 w-5" />
          Back
        </Button>
      </div>
      <MapCard
        poiData={substationsData}
        selectedPois={selectedPois || []}
        isCompareChecked={true}
      />
      {selectedPois?.length >= 1 && (
        <LMPComparisonChart
          showDetailText={false}
          selectedPois={selectedPois}
        />
      )}
      <Card className="w-full max-h-[500px] overflow-auto ">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-1.5">
            <CardTitle>POI Information Comparison</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <PoiTable
            sortPois={sortPois}
            filteredPois={sortedPois?.length > 0 ? sortedPois : selectedPois}
            substationType="transmission"
            interconnectionEntity={"caiso"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
