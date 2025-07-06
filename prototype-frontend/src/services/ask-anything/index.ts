import { COPILOT_URL } from "@/lib/consts";
import { ChatResponse } from "@/types";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

async function askAnything(data: any) {
  try {
    const resp = await axios.post(COPILOT_URL + "/api/v1/ask-me-anything/", data, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_ACCESS_TOKEN}`,
      },
    });
    return resp.data as {results: ChatResponse};
  } catch (error: any) {
    const customError = {
      message: error.response?.data?.message || "An unexpected error occurred",
      status: error.response?.status || 500,
    };
    throw customError;
  }
}

export function useAskAnything<TData, TError, TVariables>(
  onSuccess?: (data: TData) => void,
  onError?: (error: TError) => void
) {
  return useMutation<TData, TError, TVariables>(askAnything, {
    onSuccess,
    onError,
  });
}
