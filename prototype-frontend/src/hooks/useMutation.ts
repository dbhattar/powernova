import { useMutation } from "@tanstack/react-query";

import { api, EndpointsType, getApiEndpoint } from "@/services/api";
import { ApiResponse } from "@/types";

export function usePost<TData, TError, TVariables>(
  url: EndpointsType,
  onSuccess?: (data: TData) => void,
  onError?: (error: TError) => void
) {
  return useMutation<TData, TError, TVariables>({
    mutationFn: async (data: TVariables) => {
      const response = await api.post<ApiResponse<TData>>(
        getApiEndpoint(url),
        data
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error) => {
      if (onError) {
        onError(error);
      }
    },
    mutationKey: [url],
  });
}
