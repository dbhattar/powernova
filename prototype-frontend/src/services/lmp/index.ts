import { useEffect, useMemo, useState } from "react";

import { useGetQuery } from "@/hooks/useGetQuery";
import { getRemoteUrl } from "../api";
import { AverageLMPType, LMPResponse, MarketType } from "@/types";
import { getAceessToken } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export function useGetLMPData(params: {
  ids: string;
  market: MarketType;
  time_after?: string;
  time_before?: string;
  enabled?: boolean;
}) {
  const { data, ...rest } = useGetQuery<LMPResponse>("lmp_substation", params, {
    enabled: params.enabled ?? !!params.ids,
  });
  return { lmpData: data ?? ({} as LMPResponse), ...rest };
}

export function useGetYearlyLMPData(params: {
  ids: string;
  market: MarketType;
  year: number;
  month?: number;
}) {
  const { data, ...rest } = useGetQuery<LMPResponse>("yearly_lmp", params, {
    enabled: !!params.ids,
  });
  return { lmpYearData: data ?? ({} as LMPResponse), ...rest };
}

export function useGetAverageLMPData(
  params: {
    ids?: string;
    type: AverageLMPType;
    time__gte: string;
    time__lte: string;
  },
  enabled: boolean = true
) {
  const [currentData, setCurrentData] = useState<LMPResponse>({
    columns: [],
    rows: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { logout } = useAuth();

  const stableParams = useMemo(() => {
    if (!params.ids) return null;
    return {
      ids: params.ids,
      type: params.type,
      time__gte: params.time__gte,
      time__lte: params.time__lte,
    };
  }, [params.ids, params.type, params.time__gte, params.time__lte]);

  const url = useMemo(() => {
    if (!enabled || !stableParams?.ids) return null;
    return (
      getRemoteUrl() +
      "/average-lmp/" +
      "?" +
      new URLSearchParams(stableParams).toString()
    );
  }, [stableParams, enabled]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchData() {
      if (!url) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAceessToken()}`,
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            logout();
          }
          throw new Error("Failed to fetch data");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder("utf-8");

        if (!reader) {
          throw new Error("Failed to get response reader");
        }

        let done = false;
        let tempData = { columns: [] as string[], rows: [] as string[][] };

        while (!done && isMounted) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            let parsedChunk: LMPResponse = { columns: [], rows: [] };

            try {
              parsedChunk = JSON.parse(chunk);
            } catch (error) {
              // Handle split JSON chunks
              const splitJson = chunk.split("}{").map((part, index, array) => {
                if (index === 0) return part + "}";
                if (index === array.length - 1) return "{" + part;
                return "{" + part + "}";
              });
              parsedChunk = splitJson.map((json) => JSON.parse(json))[0];
            }

            if (parsedChunk.columns) {
              tempData = { ...tempData, columns: parsedChunk.columns };
            }
            if (parsedChunk.rows) {
              tempData = {
                ...tempData,
                rows: [...tempData.rows, ...parsedChunk.rows],
              };
            }

            if (isMounted) {
              setCurrentData(tempData);
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          return;
        }
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [enabled, logout, url]);

  return {
    lmpData: currentData,
    isLoading,
    error,
  };
}
