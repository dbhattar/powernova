const REMOTE_URL =
  import.meta.env.VITE_API_ENDPOINT || window.location.origin + "/api/v1";

const apiEndpoints = {
  substations: "/substations/",
  mappings: "/mappings/",
  lmp_substation: "/lmp/substation/",
  transmission_lines: "/transmission-lines/",
  yearly_lmp: "/lmp/yearly/",
  substation_mappings: "/substations/mappings/",
};

export type EndpointsType = keyof typeof apiEndpoints;

export function getRemoteUrl(): string {
  return REMOTE_URL;
}

export function getApiEndpoint(key: EndpointsType): string {
  return apiEndpoints[key];
}
