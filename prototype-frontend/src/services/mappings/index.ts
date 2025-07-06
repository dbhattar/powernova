import { AppConfig, Mappings } from "@/types";
import { useGetQuery } from "@/hooks/useGetQuery";
import { useQuery } from "@tanstack/react-query";
import { COPILOT_URL } from "@/lib/consts";
import { api } from "../api";
import { CACHE_TIME, STALE_TIME } from "../consts";

export function useGetMappings() {
  const { data, ...rest } = useGetQuery<Mappings>("mappings", {});
  return { mappingsData: data, ...rest };
}

const OPTIONS_CONFIG = COPILOT_URL + "/api/v1/options-config/";

export function useGetOptions() {
  const { data, ...rest } = useQuery({
    queryKey: [OPTIONS_CONFIG],
    queryFn: async (): Promise<AppConfig> => {
      try {
        const response = await api.get<AppConfig>(OPTIONS_CONFIG);
        return response.data;
      } catch (error: any) {
        const customError = {
          message: error.response?.data?.message || "An unexpected error occurred",
          status: error.response?.status || 500,
        };
        throw customError;
      }
    },
    cacheTime: CACHE_TIME,
    staleTime: STALE_TIME,
  });
  return { options: data, ...rest };
}
