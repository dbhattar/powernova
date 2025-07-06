import { InterConnectionLevelT } from "@/types";

export const APP_URL =
  import.meta.env.VITE_APP_URL || "https://app.cosmicglobaltech.com";
export const COPILOT_URL =
  import.meta.env.VITE_COPILOT || "https://app.cosmicglobaltech.com";

export const DEFAULT_FILTERS = {
  substationTypes: [{ key: "transmission", label: "Transmission" }],
  interconnectingEntities: [{ key: "CAISO", label: "CAISO" }],
  utilityAreas: [{ key: "all", label: "All" }],
  studyAreas: [{ key: "all", label: "All" }],
};

export const InitialFilterState = {
  substationType: "transmission" as InterConnectionLevelT,
  interconnectingEntity: "all",
  utilityArea: "all",
  studyArea: "all",
};

export const MONTH_DURATION = 3;
export const ACTUAL_TIME_DURATION = MONTH_DURATION * 30 * 24 * 60 * 60 * 1000;
export const FORECAST_TIME_DURATION = MONTH_DURATION * 30 * 24 * 60 * 60 * 1000;

export const ACTUAL_BEGIN_DATE = new Date(Date.now() - ACTUAL_TIME_DURATION)
  .toISOString()
  .split("T")[0];
export const ACTUAL_END_DATE = new Date(Date.now()).toISOString().split("T")[0];
export const FORECAST_BEGIN_DATE = new Date(Date.now())
  .toISOString()
  .split("T")[0];
export const FORECAST_END_DATE = new Date(Date.now() + FORECAST_TIME_DURATION)
  .toISOString()
  .split("T")[0];
