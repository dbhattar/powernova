import { useCallback, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Poi, PoiOrTransmissionLine, TransmissionLine } from "@/types";
import { MAX_POI_SELECTION } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { CompareCheckbox } from "../Compare";
import { Checkbox } from "../ui/checkbox";
import { LeafletMap } from ".";
import { PoiNameChip } from "../PoiNameChip";

export default function MapCard({
  poiData,
  selectedPois,
  transmissionLines,
  recentlySelectedItem,
  setRecentlySelectedItem,
  isCompareChecked,
  onCompareCheckedChange,
  showTransmissionLines,
  setShowTransmissionLines,
  from,
  isLoading,
}: {
  poiData: Poi[];
  selectedPois: Poi[];
  transmissionLines?: TransmissionLine[];
  recentlySelectedItem?: PoiOrTransmissionLine | null;
  setRecentlySelectedItem?: (item: PoiOrTransmissionLine | null) => void;
  isCompareChecked?: boolean;
  onCompareCheckedChange?: (checked: boolean) => void;
  showTransmissionLines?: boolean;
  setShowTransmissionLines?: (checked: boolean) => void;
  from?: string;
  isLoading?: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [errorText, setErrorText] = useState("");

  const selectedPoiIds = (searchParams.get("pois") || "")
    .split(",")
    .filter((x) => !!x);

  const setSearchParams_ = useCallback(
    (key: string, value: string) => {
      searchParams.set(key, value);
      setSearchParams(searchParams);
    },
    [setSearchParams, searchParams]
  );

  const handlePOISelection = useCallback(
    (selectedItem: PoiOrTransmissionLine) => {
      const type = selectedItem.type;
      if (type == "poi" && selectedPoiIds?.length >= MAX_POI_SELECTION) {
        setErrorText(`You can only compare up to ${MAX_POI_SELECTION} POIs`);
        return;
      }
      if (type === "poi") {
        if (isCompareChecked) {
          setSearchParams_(
            "pois",
            [
              ...selectedPoiIds.filter((id) => id !== selectedItem.item.id),
              selectedItem.item.id,
            ].join(",")
          );
        } else {
          setSearchParams_("pois", selectedItem.item.id);
        }
      }
      if (setRecentlySelectedItem) {
        setRecentlySelectedItem(selectedItem);
      }
    },
    [
      isCompareChecked,
      selectedPoiIds,
      setSearchParams_,
      setRecentlySelectedItem,
    ]
  );

  const handleRemove = useCallback(
    (poi: Poi) => {
      searchParams.set(
        "pois",
        selectedPoiIds?.filter((id) => id !== poi.id).join(",")
      );
      setErrorText("");
      setSearchParams(searchParams);
      setRecentlySelectedItem?.(null);
    },
    [searchParams, setSearchParams, selectedPoiIds, setRecentlySelectedItem]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>POI Locations</CardTitle>
        <CardDescription className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row justify-between gap-2 ">
            <p>Interactive map showing all interconnection points</p>
            {onCompareCheckedChange && (
              <CompareCheckbox
                checked={Boolean(isCompareChecked)}
                onCheckedChange={onCompareCheckedChange}
              />
            )}
          </div>
          <div className="flex justify-between items-center gap-2">
            {setShowTransmissionLines ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="transmission-lines"
                  checked={showTransmissionLines}
                  onCheckedChange={(checked: boolean) =>
                    setShowTransmissionLines(checked)
                  }
                />
                <label
                  htmlFor="transmission-lines"
                  className="font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Show Transmission Lines
                </label>
              </div>
            ) : (
              <span></span>
            )}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 md:p-0">
        <LeafletMap
          poiData={poiData}
          handleMapClick={handlePOISelection}
          showPoiStatus={from === "poi-dashboard"}
          transmissionLines={showTransmissionLines ? transmissionLines : []}
          recentlySelectedItem={
            recentlySelectedItem ||
            (selectedPois?.length
              ? {
                  type: "poi",
                  item: selectedPois[selectedPois.length - 1],
                }
              : null)
          }
          isCompareView={isCompareChecked}
          isLoading={isLoading}
        />
      </CardContent>
      <CardFooter className="flex-col justify-start items-start">
      {errorText && <p className="text-red-500 md:px-4 py-2">{errorText}</p>}
        <PoiNameChip pois={selectedPois} handleRemove={handleRemove} />
      </CardFooter>
    </Card>
  );
}
