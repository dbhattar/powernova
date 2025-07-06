import {
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";

import { CACHE_TIME, STALE_TIME } from "@/services/consts";
import { api, EndpointsType, getApiEndpoint } from "@/services/api";
import { ApiError, ApiResponse } from "@/types";
import { getAceessToken } from "@/lib/utils";
import { useAuth } from "../context";

interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

export function useGetQuery<TData>(
  url: EndpointsType,
  params: QueryParams,
  queryConfig?: UseQueryOptions<TData, ApiError>
): UseQueryResult<TData, ApiError> {
  const { logout } = useAuth();
  const { data, ...rest } = useQuery<TData, ApiError>({
    queryKey: [url, params],
    queryFn: async (): Promise<TData> => {
      const accessToken = getAceessToken();
      const headers = accessToken
        ? {
            Authorization: `Bearer ${getAceessToken()}`,
          }
        : {};
      try {
        const response = await api.get<ApiResponse<TData>>(
          getApiEndpoint(url),
          {
            params,
            headers,
          }
        );
        return response.data.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          logout();
          window.location.href = "/login";
        }
        const customError = {
          message:
            error.response?.data?.message || "An unexpected error occurred",
          status: error.response?.status || 500,
        };
        throw customError;
      }
    },
    retry: 2,
    retryDelay: 1000,
    cacheTime: CACHE_TIME,
    staleTime: STALE_TIME,
    ...queryConfig,
  });

  return { data, ...rest };
}
