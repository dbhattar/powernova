import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetMappings } from "@/services/mappings";
import { FilterOptions, FilterState, Poi } from "@/types";
import ExtraFilter from "./ExtraFilter";
import { Button } from "@/components/ui/button";
import {
  getConstraintsAvailableCapacityRounded,
  getCurrentQueueRounded,
  getHeatmapAvailableCapacityRounded,
  getPolicyPortfolioRounded,
  isSomeFilterHidden,
} from "@/lib/utils";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { InitialFilterState } from "@/lib/consts";

const InterconnectionLevelOptions = [
  { key: "all", label: "All" },
  { key: "transmission", label: "Transmission" },
  { key: "distribution", label: "Distribution" },
];

const InterconnectingEntityOptions = [
  { key: "all", label: "All" },
  { key: "caiso", label: "CAISO" },
  { key: "ercot", label: "ERCOT" },
  { key: "miso", label: "MISO" },
];

function getMaxValue(poiData: Poi[]) {
  const maxHeatmapAvailableCapacity = Math.round(
    Math.max(
      ...poiData
        .map(
          (poi) =>
            poi.status.find((y) => y.type === "heatmap")?.available_capacity ??
            0
        )
        .filter((x) => x !== null && x !== undefined)
    )
  );

  const minHeatmapAvailableCapacity = Math.round(
    Math.min(
      ...poiData
        .map(
          (poi) =>
            poi.status.find((y) => y.type === "heatmap")?.available_capacity ??
            0
        )
        .filter((x) => x !== null && x !== undefined)
    )
  );

  const maxConstraintsAvailableCapacity = Math.round(
    Math.max(
      ...poiData
        .map(
          (poi) =>
            poi.status.find((y) => y.type === "constraint")
              ?.available_capacity ?? 0
        )
        .filter((x) => x !== null && x !== undefined)
    )
  );

  const minConstraintsAvailableCapacity = Math.round(
    Math.min(
      ...poiData
        .map(
          (poi) =>
            poi.status.find((y) => y.type === "constraint")
              ?.available_capacity ?? 0
        )
        .filter((x) => x !== null && x !== undefined)
    )
  );

  const maxQueue = Math.round(
    Math.max(
      ...poiData
        .flatMap((poi) => poi.queue.map((q) => q.queue ?? 0))
        .filter((queue) => queue !== null && queue !== undefined)
    )
  );

  const minQueue_ = Math.round(
    Math.min(
      ...poiData
        .flatMap((poi) => poi.queue.map((q) => q.queue))
        .filter((queue) => queue !== null && queue !== undefined)
    )
  );

  const minQueue = minQueue_ > 0 ? 0 : minQueue_; // Keep the minimum queue at <=0 for now

  const maxPolicyPortfolio = Math.round(
    Math.max(
      ...poiData
        .flatMap((poi) =>
          poi.policy_portfolio.map(
            (portfolio) => portfolio.policy_portfolio ?? 0
          )
        )
        .filter((portfolio) => portfolio !== null && portfolio !== undefined)
    )
  );

  const minPolicyPortfolio_ = Math.round(
    Math.min(
      ...poiData
        .flatMap((poi) =>
          poi.policy_portfolio.map(
            (portfolio) => portfolio.policy_portfolio ?? 0
          )
        )
        .filter((portfolio) => portfolio !== null && portfolio !== undefined)
    )
  );

  const minPolicyPortfolio = minPolicyPortfolio_ > 0 ? 0 : minPolicyPortfolio_; // Keep the minimum policy_portfolio at <=0 for now

  return [
    minHeatmapAvailableCapacity,
    maxHeatmapAvailableCapacity || 100,
    minConstraintsAvailableCapacity,
    maxConstraintsAvailableCapacity,
    minQueue,
    maxQueue,
    minPolicyPortfolio,
    maxPolicyPortfolio,
  ];
}

const SelectCss = "space-y-2 flex-1 whitespace-nowrap";

export const FilterContainer = ({
  filters,
  setFilters,
  filterOptions,
  substationsData,
  setFilteredSubstationsData,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  filterOptions: FilterOptions;
  substationsData: Poi[];
  setFilteredSubstationsData: (value: Poi[]) => void;
}) => {
  const { mappingsData } = useGetMappings();
  const [
    minHeatmapAvailableCapacity,
    maxHeatmapAvailableCapacity,
    minConstraintsAvailableCapacity,
    maxConstraintsAvailableCapacity,
    minQueue,
    maxQueue,
    minPolicyPortfolio,
    maxPolicyPortfolio,
  ] = useMemo(() => getMaxValue(substationsData), [substationsData]);

  const [heatmapAvailableCapacityFilter, setHeatmapAvailableCapacityFilter] =
    useState<[number, number]>([
      minHeatmapAvailableCapacity,
      maxHeatmapAvailableCapacity || 10000,
    ]);
  const [
    constraintsAvailableCapacityFilter,
    setConstraintsAvailableCapacityFilter,
  ] = useState<[number, number]>([
    minConstraintsAvailableCapacity,
    maxConstraintsAvailableCapacity || 10000,
  ]);
  const [currentQueueFilter, setCurrentQueueFilter] = useState<
    [number, number]
  >([minQueue, maxQueue || 10000]);
  const [policyPortfolioFilter, setPolicyPortfolioFilter] = useState<
    [number, number]
  >([minPolicyPortfolio, maxPolicyPortfolio || 10000]);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  useEffect(() => {
    setHeatmapAvailableCapacityFilter([
      minHeatmapAvailableCapacity,
      maxHeatmapAvailableCapacity || 10000,
    ]);
    setConstraintsAvailableCapacityFilter([
      minConstraintsAvailableCapacity,
      maxConstraintsAvailableCapacity || 10000,
    ]);
    setCurrentQueueFilter([minQueue, maxQueue || 10000]);
    setPolicyPortfolioFilter([minPolicyPortfolio, maxPolicyPortfolio || 10000]);
  }, [
    minHeatmapAvailableCapacity,
    maxHeatmapAvailableCapacity,
    minConstraintsAvailableCapacity,
    maxConstraintsAvailableCapacity,
    minQueue,
    maxQueue,
    minPolicyPortfolio,
    maxPolicyPortfolio,
  ]);

  const handleFilter = useCallback(() => {
    if (!substationsData) return;

    const filteredData = substationsData.filter((substation) => {
      const matchInterconnectingEntity =
        filters.interconnectingEntity === "all" ||
        substation.interconnecting_entity === filters.interconnectingEntity;
      const matchUtilityArea =
        filters.utilityArea === "all" ||
        substation.utility_area === filters.utilityArea;

      const matchStudyArea =
        filters.studyArea === "all" ||
        substation.study_region === filters.studyArea;

      if (!showAdvancedFilter)
        return matchUtilityArea && matchStudyArea && matchInterconnectingEntity;

      const heatmapAvailableCapacity =
        getHeatmapAvailableCapacityRounded(substation);

      const matchHeatmapAvailableCapacity =
        heatmapAvailableCapacity >= heatmapAvailableCapacityFilter[0] &&
        heatmapAvailableCapacity <= heatmapAvailableCapacityFilter[1];

      const constraintsAvailableCapacity =
        getConstraintsAvailableCapacityRounded(substation);

      const matchConstraintsAvailableCapacity =
        constraintsAvailableCapacity >= constraintsAvailableCapacityFilter[0] &&
        constraintsAvailableCapacity <= constraintsAvailableCapacityFilter[1];

      const matchCurrentQueue =
        getCurrentQueueRounded(substation) >= currentQueueFilter[0] &&
        getCurrentQueueRounded(substation) <= currentQueueFilter[1];

      const matchPolicyPortfolio =
        getPolicyPortfolioRounded(substation) >= policyPortfolioFilter[0] &&
        getPolicyPortfolioRounded(substation) <= policyPortfolioFilter[1];

      return (
        matchInterconnectingEntity &&
        matchUtilityArea &&
        matchStudyArea &&
        matchHeatmapAvailableCapacity &&
        matchConstraintsAvailableCapacity &&
        matchCurrentQueue &&
        matchPolicyPortfolio
      );
    });

    setFilteredSubstationsData(filteredData);
  }, [
    heatmapAvailableCapacityFilter,
    constraintsAvailableCapacityFilter,
    currentQueueFilter,
    policyPortfolioFilter,
    substationsData,
    filters,
    showAdvancedFilter,
    setFilteredSubstationsData,
  ]);

  const handleResetClicked = () => {
    setHeatmapAvailableCapacityFilter([
      minHeatmapAvailableCapacity,
      maxHeatmapAvailableCapacity || 10000,
    ]);
    setConstraintsAvailableCapacityFilter([
      minConstraintsAvailableCapacity,
      maxConstraintsAvailableCapacity || 10000,
    ]);
    setCurrentQueueFilter([minQueue, maxQueue || 10000]);
    setPolicyPortfolioFilter([minPolicyPortfolio, maxPolicyPortfolio || 10000]);
    setFilters(InitialFilterState);
    setFilteredSubstationsData(substationsData);
  };

  const onValueChange = useCallback(
    (
      key: keyof FilterState,
      value: string,
      resetFilters?: (keyof FilterState)[]
    ) => {
      if (resetFilters) {
        resetFilters.forEach((filter) => {
          setFilters((prev) => ({ ...prev, [filter]: "all" }));
        });
      }
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [setFilters]
  );

  const disableSomeFilters = isSomeFilterHidden(
    filters.substationType,
    filters.interconnectingEntity
  )

  return (
    <Card className="relative overflow-y-auto max-h-full">
      <CardContent className="flex flex-col gap-4 px-6 py-4">
        <div className="flex flex-wrap gap-4 w-full">
          <div className={SelectCss}>
            <label htmlFor="country" className="text-sm font-medium">
              Country
            </label>
            <Select defaultValue="US" disabled>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(mappingsData?.country || {})?.map(
                  ([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className={SelectCss}>
            <label htmlFor="state" className="text-sm font-medium">
              State
            </label>
            <Select value="CA" defaultValue="CA">
              <SelectTrigger id="state">
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(mappingsData?.state || {})?.map(
                  ([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className={SelectCss}>
            <label
              htmlFor="interconnection-level"
              className="text-sm font-medium"
            >
              Interconnection Level
            </label>
            <Select
              defaultValue="transmission"
              value={filters.substationType}
              onValueChange={(value) =>
                onValueChange("substationType", value, [
                  "interconnectingEntity",
                  "studyArea",
                  "utilityArea",
                ])
              }
            >
              <SelectTrigger id="interconnection-level">
                <SelectValue placeholder="Select Interconnection Level" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.substationTypes?.map(({ key, label }) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={SelectCss}>
            <label
              htmlFor="interconnecting-entity"
              className="text-sm font-medium"
            >
              Interconnecting Entity
            </label>
            <Select
              defaultValue="caiso"
              value={filters.interconnectingEntity}
              onValueChange={(value) =>
                onValueChange("interconnectingEntity", value, [
                  "utilityArea",
                  "studyArea",
                ])
              }
            >
              <SelectTrigger id="interconnecting-entity">
                <SelectValue placeholder="Select interconnecting entity " />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.interconnectingEntities?.map(
                  ({ key, label }) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className={SelectCss}>
            <label htmlFor="utility-area" className="text-sm font-medium">
              Utility Area
            </label>
            <Select
              value={filters.utilityArea}
              onValueChange={(value) => onValueChange("utilityArea", value)}
              disabled={disableSomeFilters}
            >
              <SelectTrigger id="utility-area">
                <SelectValue placeholder="Select utility area" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.utilityAreas?.map(({ key, label }) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={SelectCss}>
            <label htmlFor="study-area" className="text-sm font-medium">
              Study Area
            </label>
            <Select
              value={filters.studyArea}
              onValueChange={(value) => onValueChange("studyArea", value)}
              disabled={disableSomeFilters}
            >
              <SelectTrigger id="study-area">
                <SelectValue placeholder="Select study area" />
              </SelectTrigger>
              <SelectContent>
                {filterOptions?.studyAreas?.map(({ key, label }) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {showAdvancedFilter && (
          <ExtraFilter
            minHeatmapAvailableCapacity={minHeatmapAvailableCapacity}
            maxHeatmapAvailableCapacity={maxHeatmapAvailableCapacity}
            minConstraintsAvailableCapacity={minConstraintsAvailableCapacity}
            maxConstraintsAvailableCapacity={maxConstraintsAvailableCapacity}
            minQueue={minQueue}
            maxQueue={maxQueue}
            minPolicyPortfolio={minPolicyPortfolio}
            maxPolicyPortfolio={maxPolicyPortfolio}
            heatmapAvailableCapacityFilter={heatmapAvailableCapacityFilter}
            constraintsAvailableCapacityFilter={
              constraintsAvailableCapacityFilter
            }
            currentQueueFilter={currentQueueFilter}
            policyPortfolioFilter={policyPortfolioFilter}
            setHeatmapAvailableCapacityFilter={
              setHeatmapAvailableCapacityFilter
            }
            setConstraintsAvailableCapacityFilter={
              setConstraintsAvailableCapacityFilter
            }
            setCurrentQueueFilter={setCurrentQueueFilter}
            setPolicyPortfolioFilter={setPolicyPortfolioFilter}
            setFilteredSubstationsData={setFilteredSubstationsData}
            disableSomeFilters={disableSomeFilters}
          />
        )}
        <div className="flex gap-2 flex-wrap w-full">
          <Button
            variant="secondary"
            className="w-full flex-1"
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
          >
            {showAdvancedFilter
              ? "Hide Advanced Filters"
              : "Show Advanced Filters"}
            {showAdvancedFilter ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </Button>
          <ResetButton handleResetClicked={handleResetClicked} />
          <FilterButton handleFilter={handleFilter} className="w-full flex-1" />
        </div>
      </CardContent>
    </Card>
  );
};

const FilterButton = ({
  handleFilter,
  className,
}: {
  handleFilter: () => void;
  className: string;
}) => {
  return (
    <Button variant="default" className={className} onClick={handleFilter}>
      Search
    </Button>
  );
};

const ResetButton = ({
  handleResetClicked,
}: {
  handleResetClicked: () => void;
}) => {
  return (
    <Button
      variant="secondary"
      className="w-full flex-1"
      onClick={handleResetClicked}
    >
      Reset Filter
      <RotateCcw className="ml-2 h-4 w-4" />
    </Button>
  );
};
