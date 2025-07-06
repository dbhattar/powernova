import React from "react";

import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { LatLngExpression } from "leaflet";
import { Poi, PoiOrTransmissionLine, TransmissionLine } from "@/types";

import PoiInfoSection from "./PoiInfo";
import { mapVoltageToKey, VoltageColors } from "@/lib/utils";
import ColorMap from "./ColorMap";
import { LoaderCircle } from "lucide-react";

/*
Leaflet-providers preview
This page shows mini maps for all the layers available in Leaflet-providers.

Provider names for leaflet-providers.js
USGS.USTopo
Plain JavaScript:
var USGS_USTopo = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
	maxZoom: 20,
	attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
});
https://leaflet-extras.github.io/leaflet-providers/preview/
https://gis.stackexchange.com/questions/184125/alternative-basemaps-for-leaflet
*/
export function LeafletMap({
  poiData,
  handleMapClick,
  showPoiStatus,
  transmissionLines,
  recentlySelectedItem,
  isCompareView,
  isLoading,
}: {
  poiData?: Poi[];
  handleMapClick: (item: PoiOrTransmissionLine) => void;
  showPoiStatus?: boolean;
  transmissionLines?: TransmissionLine[];
  recentlySelectedItem?: PoiOrTransmissionLine | null;
  isCompareView?: boolean;
  isLoading?: boolean;
}) {
  return (
    <MapContainer
      center={[36, -120] as LatLngExpression}
      zoom={5}
      style={{ width: "100%" }}
      scrollWheelZoom={true}
      preferCanvas={true}
      className="h-[450px] relative z-40"
    >
      {isLoading && (
        <div className="absolute bg-black/20 h-full w-full z-[500] flex justify-center items-center">
          <LoaderCircle
            className="top-1/2 left-1/2 animate-spin"
            size={40}
            strokeWidth={2}
            color="black"
          />
        </div>
      )}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
      />
      {poiData &&
        poiData.map((poi, i) => (
          <LocationMarker
            key={i}
            poi={poi}
            handleClick={handleMapClick}
            isSelected={
              recentlySelectedItem?.type === "poi" &&
              recentlySelectedItem?.item?.id === poi.id
            }
          />
        ))}
      {transmissionLines?.map((line, i) => (
        <React.Fragment key={i}>
          <Polyline
            positions={
              line.geo_coordinates?.map((x) => [
                x[1] ?? 0,
                x[0] ?? 0,
              ]) as LatLngExpression[]
            }
            color={
              VoltageColors?.find(
                (x) => x.value === mapVoltageToKey(line.voltage)
              )?.color
            }
            smoothFactor={4}
            eventHandlers={{
              click: () =>
                handleMapClick({ item: line, type: "transmissionLine" }),
            }}
          >
            <Tooltip>{line.name}</Tooltip>
          </Polyline>
          <ColorMap />
        </React.Fragment>
      ))}
      <PoiInfoSection
        selectedItem={recentlySelectedItem}
        showPoiStatus={showPoiStatus}
        isCompareView={isCompareView}
      />
    </MapContainer>
  );
}

function LocationMarker({
  handleClick,
  poi,
  isSelected,
}: {
  handleClick: (item: PoiOrTransmissionLine) => void;
  poi: Poi;
  isSelected?: boolean;
}) {
  const location = poi.geo_coordinates
    ? [poi.geo_coordinates.latitude ?? 0, poi.geo_coordinates.longitude ?? 0]
    : null;
  if (!location) return null;
  return (
    <>
      {location && (
        <CircleMarker
          center={location as LatLngExpression}
          radius={isSelected ? 12 : 6}
          color="orange"
          fill={poi.has_lmp_data ? true : false}
          fillColor="orange"
          fillOpacity={0.9}
          eventHandlers={{
            click: () => handleClick({ item: poi, type: "poi" }),
          }}
        >
          <Tooltip>{poi.name}</Tooltip>
        </CircleMarker>
      )}
    </>
  );
}

export default LeafletMap;
