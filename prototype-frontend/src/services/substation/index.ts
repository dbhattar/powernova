import {
  InterConnectionLevelT,
  Poi,
  SubstationMappingResponse,
  TransmissionLine,
} from "@/types";
import { useGetQuery } from "@/hooks/useGetQuery";

export function useGetSubstations(interconnectionLevel: InterConnectionLevelT) {
  const { data, ...rest } = useGetQuery<Poi[]>("substations", {
    type: interconnectionLevel,
  });
  return { substationsData: data ?? [], ...rest };
}

export function useGetTransmissionLines() {
  const { data, ...rest } = useGetQuery<TransmissionLine[]>(
    "transmission_lines",
    {}
  );
  return { transmissionLinesData: data ?? [], ...rest };
}

export function useGetSubstationMappings() {
  const { data, ...rest } = useGetQuery<SubstationMappingResponse>(
    "substation_mappings",
    {}
  );
  return { substationMappings: data, ...rest };
}
