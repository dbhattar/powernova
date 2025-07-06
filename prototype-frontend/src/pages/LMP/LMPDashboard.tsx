import { useCallback, useMemo } from "react";

import { useSearchParams } from "react-router-dom";

import { LMPChart } from "@/components/LMP/LMPChart";
import { LMPData } from "@/components/LMP/LMPData";
import { LMPHeader } from "@/components/LMP/LMPHeader";
import { useGetAverageLMPData } from "@/services/lmp";
import { useGetSubstations } from "@/services/substation";
import { LMPComparisonChart } from "@/components/LMP/LMPComparisonChart";
import MapCard from "@/components/Map/MapCard";
import { ACTUAL_BEGIN_DATE, ACTUAL_END_DATE } from "@/lib/consts";

function LMPPage() {
  const { substationsData, isLoading } = useGetSubstations("transmission");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPoiIds = (searchParams.get("pois") || "")
    .split(",")
    .filter((x) => !!x);
  const isCompareChecked = searchParams.get("compare") === "true";

  const { lmpData } = useGetAverageLMPData(
    {
      ids: selectedPoiIds.join(","),
      type: "actual",
      time__gte: ACTUAL_BEGIN_DATE,
      time__lte: ACTUAL_END_DATE,
    },
    !!selectedPoiIds.length
  );
  const setSearchParams_ = useCallback(
    (key: string, value: string) => {
      searchParams.set(key, value);
      setSearchParams(searchParams);
    },
    [setSearchParams, searchParams]
  );

  const handleCompareChange = useCallback(
    (checked: boolean) => {
      setSearchParams_("compare", checked.toString());
    },
    [setSearchParams_]
  );

  const selectedPois = useMemo(() => {
    return selectedPoiIds
      .map((id) => substationsData.find((poi) => poi.id === id))
      .filter((x) => !!x);
  }, [substationsData, selectedPoiIds]);

  return (
    <div className="space-y-4">
      <LMPHeader />
      <div className="grid grid-rows-1 md:grid-rows-3 gap-4">
        <div className="md:row-span-3 space-y-2">
          <MapCard
            poiData={substationsData}
            selectedPois={selectedPois || []}
            isCompareChecked={isCompareChecked}
            onCompareCheckedChange={handleCompareChange}
            isLoading={isLoading}
          />
        </div>
        {!!lmpData?.rows?.length && selectedPois && !isCompareChecked && (
          <LMPData lmpData={lmpData} isLoading={false} />
        )}
      </div>
      {selectedPois?.length === 1 && (
        <LMPChart
          selectedSubstation={selectedPois[0]}
          actualLmpData={lmpData}
          isLoading={false}
        />
      )}
      {selectedPois?.length > 1 && (
        <LMPComparisonChart
          selectedPois={selectedPois}
          showDetailText={isCompareChecked}
        />
      )}
    </div>
  );
}

export default LMPPage;
