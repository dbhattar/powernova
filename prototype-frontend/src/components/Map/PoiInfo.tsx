import { useState } from "react";
import { Link } from "react-router-dom";

import {
  Gauge,
  Layers,
  Locate,
  MapPin,
  MoveRight,
  Plug,
  Spline,
  Thermometer,
  X,
} from "lucide-react";

import {
  cn,
  getConstraintsAvailableCapacityWithNA,
  getCurrentQueueWithNA,
  getHeatmapAvailableCapacityWithNA,
  getPolicyPortfolioWithNA,
} from "@/lib/utils";
import { Poi, PoiOrTransmissionLine, TransmissionLine } from "@/types";

const PoiInfoSection = ({
  selectedItem,
  showPoiStatus,
  isCompareView,
}: {
  selectedItem?: PoiOrTransmissionLine | null;
  showPoiStatus?: boolean;
  isCompareView?: boolean;
}) => {
  const [showData, setShowData] = useState(true);

  if (!selectedItem) return null;
  return (
    <div className="py-2 px-4 min-w-[200px] md:min-w-[250px] lg:min-w-[300px] max-w-sm text-sm font-medium space-y-4 absolute right-0 z-[1000] bg-white rounded-bl-lg">
      <div className="flex gap-2 justify-between items-center">
        <h3 className="flex items-center text-lg md:text-xl font-semibold text-orange-600">
          {selectedItem.type === "poi" ? (
            <MapPin className="mr-2 h-5 w-5" />
          ) : (
            <Spline className="mr-2 h-5 w-5" />
          )}
          {selectedItem?.item?.name}
        </h3>
        {showPoiStatus && (
          <X
            className={cn("cursor-pointer h-4 w-4 hover:text-gray-500", {
              "rotate-45": !showData,
            })}
            onClick={() => setShowData(!showData)}
          />
        )}
      </div>
      {showData && showPoiStatus && selectedItem.type === "poi" && (
        <PoiData poi={selectedItem.item} isCompareView={isCompareView} />
      )}
      {showData && selectedItem.type === "transmissionLine" && (
        <TransmissionLineData transmissionLine={selectedItem.item} />
      )}
    </div>
  );
};

const PoiData = ({
  poi,
  isCompareView,
}: {
  poi: Poi;
  isCompareView?: boolean;
}) => {
  const data = [
    ...(poi.type === "transmission"
      ? [
          {
            label: "Heatmap Capacity",
            value: getHeatmapAvailableCapacityWithNA(poi),
            icon: <Thermometer className="text-blue-500 mr-2 h-5 w-5" />,
          },
          {
            label: "Constraints Capacity",
            value: getConstraintsAvailableCapacityWithNA(poi),
            icon: <Gauge className="text-green-500 mr-2 h-5 w-5" />,
          },
        ] : []),
    {
      label: "Current Queue",
      value: getCurrentQueueWithNA(poi),
      icon: <MoveRight className="text-yellow-500 mr-2 h-5 w-5" />,
    },
    {
      label: "Policy Portfolio",
      value: getPolicyPortfolioWithNA(poi),
      icon: <Layers className="text-orange-500 mr-2 h-5 w-5" />,
    },
  ];

  return (
    <ul className="space-y-2">
      {data.map((item) => (
        <li key={item.label} className="flex items-center justify-between">
          <span className="flex items-center">
            {item.icon}
            <span className="font-semibold">{item.label}</span>
          </span>
          <span>{item.value}</span>
        </li>
      ))}
      {!isCompareView && poi.type === "transmission" && (
        <Link to={`/lmp/?pois=${poi.id}`}>
          <li className="flex items-center justify-between mt-2">
            <span className="flex items-center">
              <span className="font-semibold">View LMP Data</span>
              <MoveRight />
            </span>
          </li>
        </Link>
      )}
    </ul>
  );
};

const TransmissionLineData = ({
  transmissionLine,
}: {
  transmissionLine: TransmissionLine;
}) => {
  const data = [
    {
      label: "Voltage",
      value: transmissionLine.voltage,
      icon: <Plug className="text-blue-500 mr-2 h-5 w-5" />,
    },
    {
      label: "Utility Area",
      value: transmissionLine.utility_area,
      icon: <Locate className="text-green-500 mr-2 h-5 w-5" />,
    },
  ];
  return (
    <ul className="space-y-2">
      {data.map((item) => (
        <li key={item.label} className="flex items-center justify-between">
          <span className="flex items-center">
            {item.icon}
            <span className="font-semibold">{item.label}</span>
          </span>
          <span>{item.value}</span>
        </li>
      ))}
    </ul>
  );
};

export default PoiInfoSection;
