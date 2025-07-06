import {
  InterConnectionLevelT,
  LMPResponse,
  MarketType,
  Option,
  Poi,
  SubstationMappingResponse,
} from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const MAX_POI_SELECTION = 5;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAceessToken() {
  return localStorage.getItem("accessToken");
}

export function getUserFromLoacalStorage() {
  const user = localStorage.getItem("user");
  if (user) {
    return JSON.parse(user);
  }
  return null;
}

export function convertObjectToArray(obj: { [key: string]: string }): Option[] {
  return Object.keys(obj).map((key) => ({
    key,
    label: obj[key],
  }));
}

export function withAllOption(options: Option[]) {
  return [
    {
      key: "all",
      label: "All",
    },
    ...options,
  ];
}

export function titleCase(str: string) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function processValueOrZero(value: any): number {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return 0;
  }
  return Math.round(Number(value));
}

function processValueOrNA(value: any): number | string {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return "N/A";
  }
  return Math.round(Number(value));
}

export function getHeatmapAvailableCapacityRounded(poi: Poi): number {
  const heatmapStatus = poi.status.find((status) => status.type === "heatmap");
  return processValueOrZero(heatmapStatus?.available_capacity);
}

export function getHeatmapAvailableCapacityWithNA(poi: Poi): number | string {
  const heatmapStatus = poi.status.find((status) => status.type === "heatmap");
  return processValueOrNA(heatmapStatus?.available_capacity);
}

export function getConstraintsAvailableCapacityRounded(poi: Poi): number {
  const constraintStatus = poi.status.find(
    (status) => status.type === "constraint"
  );
  return processValueOrZero(constraintStatus?.available_capacity);
}

export function getConstraintsAvailableCapacityWithNA(
  poi: Poi
): number | string {
  const constraintStatus = poi.status.find(
    (status) => status.type === "constraint"
  );
  return processValueOrNA(constraintStatus?.available_capacity);
}

export function getConstrainsNumberFromHeatmapRounded(poi: Poi): number {
  const heatmapStatus = poi.status.find((status) => status.type === "heatmap");
  return processValueOrZero(heatmapStatus?.no_of_constraints);
}

export function getConstrainsNumberFromHeatmapWithNA(
  poi: Poi
): number | string {
  const heatmapStatus = poi.status.find((status) => status.type === "heatmap");
  return processValueOrNA(heatmapStatus?.no_of_constraints);
}

export function getConstrainsNumberFromConstraintsRounded(poi: Poi): number {
  const constraintStatus = poi.status.find(
    (status) => status.type === "constraint"
  );
  return processValueOrZero(constraintStatus?.no_of_constraints);
}

export function getConstrainsNumberFromConstraintsWithNA(
  poi: Poi
): number | string {
  const constraintStatus = poi.status.find(
    (status) => status.type === "constraint"
  );
  return processValueOrNA(constraintStatus?.no_of_constraints);
}

export function getCurrentQueueRounded(poi: Poi): number {
  return processValueOrZero(poi.queue[0]?.queue);
}

export function getCurrentQueueWithNA(poi: Poi): number | string {
  return processValueOrNA(poi.queue[0]?.queue);
}

export function getTotalProjectsRounded(poi: Poi): number {
  return processValueOrZero(poi.queue[0]?.no_of_projects);
}

export function getTotalProjectsWithNA(poi: Poi): number | string {
  return processValueOrNA(poi.queue[0]?.no_of_projects);
}

export function getPolicyPortfolioRounded(poi: Poi): number {
  return processValueOrZero(poi.policy_portfolio[0]?.policy_portfolio);
}

export function getPolicyPortfolioWithNA(poi: Poi): number | string {
  return processValueOrNA(poi.policy_portfolio[0]?.policy_portfolio);
}

export function getLastElement<T>(arr?: T[]) {
  if (!arr) return null;
  if (arr.length === 0) return null;

  return arr[arr.length - 1];
}

export function findColumnIndex(headers: string[], headerName: string) {
  return headers?.indexOf(headerName);
}

export function filterLMPByDate(
  lmpData: LMPResponse,
  date: Date,
  market?: MarketType
) {
  if (!lmpData) return [];
  const timeIndex = findColumnIndex(lmpData.columns, "Time");
  const marketIndex = findColumnIndex(lmpData.columns, "Market");

  return lmpData.rows?.filter((item) => {
    const time = item[timeIndex];
    const itemDate = new Date(time);
    return (
      itemDate.getUTCFullYear() === date?.getUTCFullYear() &&
      itemDate.getUTCMonth() === date?.getUTCMonth() &&
      itemDate.getUTCDate() === date?.getUTCDate() &&
      (market ? item[marketIndex] === market : true)
    );
  });
}

export function sortSubstations(poi: Poi[], isAsc: boolean, sortBy: string) {
  const sorted = [...poi].sort((a, b) => {
    let valA: number | string;
    let valB: number | string;
    if (sortBy === "name") {
      valA = a.name;
      valB = b.name;
    } else if (sortBy === "heatmap_available_capacity") {
      valA = getHeatmapAvailableCapacityRounded(a) || 0;
      valB = getHeatmapAvailableCapacityRounded(b) || 0;
    } else if (sortBy === "constraints_available_capacity") {
      valA = getConstraintsAvailableCapacityRounded(a) || 0;
      valB = getConstraintsAvailableCapacityRounded(b) || 0;
    } else if (sortBy === "current_queue") {
      valA = getCurrentQueueRounded(a) || 0;
      valB = getCurrentQueueRounded(b) || 0;
    } else if (sortBy === "total_projects") {
      valA = getTotalProjectsRounded(a) || 0;
      valB = getTotalProjectsRounded(b) || 0;
    } else if (sortBy === "policy_portfolio") {
      valA = getPolicyPortfolioRounded(a) || 0;
      valB = getPolicyPortfolioRounded(b) || 0;
    } else if (sortBy === "constrains_number_from_heatmap") {
      valA = getConstrainsNumberFromHeatmapRounded(a) || 0;
      valB = getConstrainsNumberFromHeatmapRounded(b) || 0;
    } else if (sortBy === "constrains_number_from_constraints") {
      valA = getConstrainsNumberFromConstraintsRounded(a) || 0;
      valB = getConstrainsNumberFromConstraintsRounded(b) || 0;
    }
    if (typeof valA === "number" && typeof valB === "number") {
      if (isAsc) {
        return valB - valA;
      }
      return valA - valB;
    } else {
      if (isAsc) {
        return valA.toString().localeCompare(valB.toString());
      }
      return valB.toString().localeCompare(valA.toString());
    }
  });
  return sorted;
}

export const VoltageColors = [
  { value: "<30", color: "#0b65fa" },
  { value: "30-80", color: "#21fa0b" },
  { value: "80-120", color: "#e10bfa" },
  { value: ">120", color: "#fa3e0b" },
];

export function mapVoltageToKey(voltage: number) {
  if (voltage <= 30) {
    return "<30";
  } else if (voltage > 30 && voltage <= 80) {
    return "30-80";
  } else if (voltage > 80 && voltage <= 120) {
    return "80-120";
  } else if (voltage > 120) {
    return ">120";
  }
  return 30;
}

export function findLMPIndex(lmpData: LMPResponse) {
  const time = findColumnIndex(lmpData?.columns, "Time");
  const lmp = findColumnIndex(lmpData?.columns, "LMP");
  const energy = findColumnIndex(lmpData?.columns, "Energy");
  const loss = findColumnIndex(lmpData?.columns, "Loss");
  const congestion = findColumnIndex(lmpData?.columns, "Congestion");
  const substationId = findColumnIndex(lmpData?.columns, "Substation ID");
  const substationName = findColumnIndex(lmpData?.columns, "Substation");
  return {
    time,
    lmp,
    energy,
    loss,
    congestion,
    substationId,
    substationName,
  };
}

export function findYearlyLMPIndex(yearlyLMPData: LMPResponse) {
  const time = findColumnIndex(yearlyLMPData?.columns, "Time");
  const avg_energy = findColumnIndex(yearlyLMPData?.columns, "Energy");
  const avg_loss = findColumnIndex(yearlyLMPData?.columns, "Loss");
  const avg_congestion = findColumnIndex(yearlyLMPData?.columns, "Congestion");
  const avg_lmp = findColumnIndex(yearlyLMPData?.columns, "LMP");
  const opening_lmp = findColumnIndex(yearlyLMPData?.columns, "Opening Price");
  const closing_lmp = findColumnIndex(yearlyLMPData?.columns, "Closing Price");
  const substationId = findColumnIndex(yearlyLMPData?.columns, "Substation ID");
  const substationName = findColumnIndex(yearlyLMPData?.columns, "Substation");
  return {
    time,
    avg_energy,
    avg_loss,
    avg_congestion,
    avg_lmp,
    opening_lmp,
    closing_lmp,
    substationId,
    substationName,
  };
}

export function convertDateToYYMMDD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getYesterdayDate(date?: Date) {
  const today = date || new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return yesterday;
}

export function getMonthAndDay(dateString: string) {
  const date = new Date(dateString);
  const month = date.toLocaleString("default", { month: "short" });
  const day = date.getDate();
  return `${month} ${day}`;
}

export function pickRandomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export function findSubstationMappingIndex(
  substationMappings: SubstationMappingResponse
) {
  return {
    substationType: findColumnIndex(
      substationMappings?.columns,
      "Substation Type"
    ),
    interconnectingEntity: findColumnIndex(
      substationMappings.columns,
      "Interconnecting Entity"
    ),
    studyRegions: findColumnIndex(substationMappings.columns, "Study Regions"),
    utilityAreas: findColumnIndex(substationMappings.columns, "Utility Areas"),
  };
}

function formatXAxis(tickItem: string) {
  const date = new Date(tickItem);
  return date.toLocaleString("default", { month: "short", day: "numeric" });
}

export function customTickFormatter(value: string, index: number) {
  const date = new Date(value);
  const day = date.getDate();
  return formatXAxis(value);
}

export function isSomeFilterHidden(
  substationType: InterConnectionLevelT,
  interconnectionEntity: string
) {
  return (
    substationType === "distribution" ||
    ["LADWP", "SMUD", "IID"].includes(interconnectionEntity)
  );
}
