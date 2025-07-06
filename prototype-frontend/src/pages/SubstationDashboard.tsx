import { useCallback, useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router-dom";

import { PoiInformation, FilterContainer } from "@/components/PoiList";

import {
  useGetSubstationMappings,
  useGetSubstations,
  useGetTransmissionLines,
} from "@/services/substation";
import {
  FilterState,
  Poi,
  PoiOrTransmissionLine,
} from "@/types";
import MapCard from "@/components/Map/MapCard";
import AskAnything from "@/components/AskAnything";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MinMaxButton } from "@/components/ui/min-max-button";
import { cn, findSubstationMappingIndex, titleCase, withAllOption } from "@/lib/utils";
import { DEFAULT_FILTERS, InitialFilterState } from "@/lib/consts";

export default function SubstationDashboard() {
  const [filters, setFilters] = useState<FilterState>(InitialFilterState);
  const { substationsData, isLoading } = useGetSubstations(
    filters.substationType
  );
  const [filteredPois, setFilteredPois] = useState<Poi[]>(
    substationsData || []
  );
  const { substationMappings } = useGetSubstationMappings();
  const [recentlySelectedItem, setRecentlySelectedItem] =
    useState<PoiOrTransmissionLine | null>(null);
  const [showTransmissionLines, setShowTransmissionLines] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState<
    "copilot" | "map" | null
  >("map");
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedPoiIds = (searchParams.get("pois") || "")
    .split(",")
    .filter((x) => !!x);
  const isCompareChecked = searchParams.get("compare") === "true";

  const { transmissionLinesData } = useGetTransmissionLines();

  useEffect(() => {
    if (!substationsData) return;
    setFilteredPois(substationsData || []);
  }, [substationsData]);

  useEffect(() => {
    setFullScreenMode(null);
  }, []);

  const substationMappingIndex = useMemo(() => {
    if (!substationMappings) return;
    return findSubstationMappingIndex(substationMappings);
  }, [substationMappings]);

  const filterOptions = useMemo(() => {
    if (!substationMappings?.columns || !substationMappingIndex) {
      return DEFAULT_FILTERS
    }

    const substationTypes = [
      ...new Set(
        substationMappings.rows.map(
          (row) => row[substationMappingIndex?.substationType] as string
        )
      ),
    ].map((x) => ({ key: x, label: titleCase(x) }));

    const interconnectingEntities = withAllOption([
      ...new Set(
        substationMappings.rows
          .filter(
            (row) =>
              !filters.substationType ||
              row[substationMappingIndex?.substationType] ===
                filters.substationType
          )
          .map((row) => row[substationMappingIndex?.interconnectingEntity] as string)
      ),
    ].map((x) => ({ key: x, label: x })));

    const utilityAreas = withAllOption([
      ...new Set(
        substationMappings.rows
          .filter((row) => {
            return (
              !filters.substationType ||
              row[substationMappingIndex?.substationType] ===
                filters.substationType
            ) &&
              (
                !filters.interconnectingEntity ||
                row[substationMappingIndex?.interconnectingEntity] ===
                  filters.interconnectingEntity
              );
          })
          .flatMap((row) => row[substationMappingIndex?.utilityAreas])
      ),
    ].map((x) => ({ key: x, label: x })));

    const studyAreas = withAllOption([
      ...new Set(
        substationMappings.rows
          .filter(
            (row) =>
              (!filters.substationType ||
                row[substationMappingIndex?.substationType] ===
                  filters.substationType) &&
              (!filters.interconnectingEntity ||
                row[substationMappingIndex?.interconnectingEntity] ===
                  filters.interconnectingEntity)
          )
          .flatMap((row) => row[substationMappingIndex?.studyRegions])
      ),
    ].map((x) => ({ key: x, label: x })));

    return { substationTypes, interconnectingEntities, utilityAreas, studyAreas };
  }, [substationMappings, filters, substationMappingIndex]);

  const selectedPois = useMemo(() => {
    return selectedPoiIds
      ?.map((item) => substationsData?.find((poi) => poi.id === item))
      .filter((x) => !!x);
  }, [substationsData, selectedPoiIds]);

  const tablePois = useMemo(() => {
    return selectedPois?.length ? selectedPois : filteredPois;
  }, [selectedPois, filteredPois]);

  const onCheckedChange = useCallback(
    (checked: boolean) => {
      setSearchParams((prev) => ({
        ...prev,
        pois: checked
          ? recentlySelectedItem?.type === "poi"
            ? recentlySelectedItem?.item?.id
            : ""
          : "",
        compare: checked?.toString(),
      }));
    },
    [setSearchParams, recentlySelectedItem]
  );

  return (
    <div
      className={cn("h-full w-full grid grid-cols-1 gap-4", {
        "lg:grid-cols-2 2xl:grid-cols-3": !fullScreenMode,
      })}
    >
      <Card
        className={cn(
          "w-full transition-transform transform ease-in-out duration-500",
          fullScreenMode !== "copilot"
            ? "block translate-x-0 opacity-100 col-span-1 lg:col-span-1 2xl:col-span-2 "
            : "hidden translate-x-full opacity-0 col-span-1 2xl:col-span-2 "
        )}
      >
        <CardHeader className="pb-0 md:pb-0 w-full">
          <div className="flex justify-between">
            <CardTitle>
              Generator Point of Interconnection Information
            </CardTitle>
            <MinMaxButton
              showMaximizeButton={fullScreenMode !== "map"}
              onFullScreenClick={() => setFullScreenMode("map")}
              onMinimizeClick={() => setFullScreenMode(null)}
            />
          </div>
          <CardDescription>
            View and manage interconnection points
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 py-2">
          <div className="flex-2">
            <FilterContainer
              filters={filters}
              setFilters={setFilters}
              filterOptions={filterOptions}
              substationsData={substationsData ?? []}
              setFilteredSubstationsData={setFilteredPois}
            />
          </div>
          <div className="space-y-6 flex-3">
            <MapCard
              poiData={filteredPois}
              selectedPois={selectedPois ?? []}
              transmissionLines={transmissionLinesData}
              recentlySelectedItem={recentlySelectedItem}
              setRecentlySelectedItem={setRecentlySelectedItem}
              isCompareChecked={isCompareChecked}
              onCompareCheckedChange={onCheckedChange}
              showTransmissionLines={showTransmissionLines}
              setShowTransmissionLines={setShowTransmissionLines}
              from="poi-dashboard"
              isLoading={isLoading}
            />
            <PoiInformation
              compareChecked={isCompareChecked}
              filteredPois={tablePois ?? []}
              comparedPois={selectedPois ?? []}
              substationType={filters.substationType}
              interconnectionEntity={filters.interconnectingEntity}
            />
          </div>
        </CardContent>
      </Card>
      <AskAnything
        isMinimumScreen={fullScreenMode !== "copilot"}
        onFullScreenClick={() => setFullScreenMode("copilot")}
        onMinimizeClick={() => setFullScreenMode(null)}
        className={cn(
          "col-span-1 w-full transition-transform transform ease-in-out duration-500",
          fullScreenMode !== "map"
            ? "block translate-x-0 opacity-100 text-base"
            : "hidden text-sm translate-x-full opacity-0"
        )}
      />
    </div>
  );
}
