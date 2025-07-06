import React, { useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { Maximize } from "lucide-react";

import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Poi } from "@/types";
import { useGetAverageLMPData } from "@/services/lmp";
import {
  customTickFormatter,
  findYearlyLMPIndex,
  getMonthAndDay,
} from "@/lib/utils";
import { Button } from "../ui/button";
import {
  ACTUAL_BEGIN_DATE,
  ACTUAL_END_DATE,
  FORECAST_BEGIN_DATE,
  FORECAST_END_DATE,
} from "@/lib/consts";
import ForecastCheckBox from "../ForecastCheckBox";

const getForecastKey = (poi: Poi) => `${poi.name}-forecast`;

const CustomLegend = ({ payload }: { payload: ChartConfig }) => {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {Object.values(payload)?.map((entry, index) => {
        if (entry?.value?.includes("forecast")) return null;
        return (
          <div key={`item-${index}`} className="flex items-center">
            <div
              className="w-3 h-3 mr-2"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm">{entry?.value}</span>
          </div>
        );
      })}
    </div>
  );
};

export function LMPComparisonChart({
  selectedPois,
  showDetailText,
}: {
  selectedPois: Poi[];
  showDetailText: boolean;
}) {
  const [isForecastChecked, setIsForecastChecked] = useState(false);
  const { lmpData: actualLmpData } = useGetAverageLMPData(
    {
      ids: selectedPois.map((x) => x.id).join(","),
      type: "actual",
      time__gte: ACTUAL_BEGIN_DATE,
      time__lte: ACTUAL_END_DATE,
    },
    !!selectedPois.length
  );

  const { lmpData: forecastedLmpData } = useGetAverageLMPData(
    {
      ids: selectedPois.map((x) => x.id).join(","),
      type: "forecast",
      time__gte: FORECAST_BEGIN_DATE,
      time__lte: FORECAST_END_DATE,
    },
    !!selectedPois.length && isForecastChecked
  );

  const lmpIndex = useMemo(
    () => findYearlyLMPIndex(actualLmpData),
    [actualLmpData]
  );

  const uniqueTimes: string[] = useMemo(() => {
    if (!actualLmpData) return [];
    return [
      ...new Set((actualLmpData?.rows || []).map((x) => x[lmpIndex.time])),
    ];
  }, [actualLmpData, lmpIndex]);

  const uniqueForecastTimes: string[] = useMemo(() => {
    if (!forecastedLmpData || !isForecastChecked) return [];
    return [
      ...new Set((forecastedLmpData?.rows || []).map((x) => x[lmpIndex.time])),
    ];
  }, [forecastedLmpData, lmpIndex, isForecastChecked]);

  const chartData = useMemo(
    () => [
      ...uniqueTimes.map((time) => {
        const poiData = selectedPois.reduce((acc, poi) => {
          const poiLMP = (actualLmpData?.rows || [])?.find(
            (lmp) =>
              lmp[lmpIndex.time] === time &&
              lmp[lmpIndex.substationId] === poi.id
          )?.[lmpIndex.avg_lmp];
          return { ...acc, [poi.name]: poiLMP };
        }, {});

        return { time, ...poiData };
      }),
      ...uniqueForecastTimes.map((time) => {
        const poiData = selectedPois.reduce((acc, poi) => {
          const poiLMP = forecastedLmpData?.rows?.find(
            (lmp) =>
              lmp[lmpIndex.time] === time &&
              lmp[lmpIndex.substationId] === poi.id
          )?.[lmpIndex.avg_lmp];
          const key = getForecastKey(poi);
          return { ...acc, [key]: poiLMP };
        }, {});
        return { time: time, ...poiData };
      }),
    ],
    [
      actualLmpData,
      forecastedLmpData,
      uniqueForecastTimes,
      lmpIndex,
      selectedPois,
      uniqueTimes,
    ]
  );

  const chartConfig = useMemo(() => {
    return selectedPois.reduce((acc, poi, index) => {
      acc[poi.name] = {
        label: poi.name,
        color: `hsl(var(--chart-${index + 1}))`,
      };
      acc[getForecastKey(poi)] = {
        label: `${poi.name} (forecast)`,
        color: `hsl(var(--chart-${index + 1})/80%)`,
      };
      return acc;
    }, {} as ChartConfig);
  }, [selectedPois]);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded p-2 shadow-lg space-y-2">
          <p className="font-bold">{getMonthAndDay(data.time)}</p>
          {Object.entries(chartConfig).map(([key, value]) => {
            if (!data[key]) return null;
            return (
              <p key={key} style={{ color: value.color }}>
                {`${value.label}: ${data[key]}`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between gap-2 items-center flex-wrap">
        <CardTitle>Locational Marginal Price - Comparison</CardTitle>
        <div className="flex flex-row gap-4 items-center">
          <ForecastCheckBox
            checked={isForecastChecked}
            onChange={(checked: boolean) => setIsForecastChecked(checked)}
          />
          {showDetailText && (
            <Link
              to={`/poi-comparison/?pois=${encodeURIComponent(
                selectedPois?.map((poi) => poi.id).join(",")
              )}&from=${encodeURIComponent(window.location.pathname)}`}
            >
              <Button variant="outline">
                <Maximize className="h-4 w-4 group-hover:scale-110" />
                <p className="text-gray-600">Show Detailed Comparison</p>
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {actualLmpData && (
          <ChartContainer config={chartConfig} className="h-80 w-full">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={1}
                tickFormatter={customTickFormatter}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={0}
                tickFormatter={(value) => "$" + value}
              />
              <ChartTooltip cursor={true} content={customTooltip} />
              {selectedPois.map((poi) => (
                <React.Fragment key={poi.name}>
                  <Line
                    dataKey={poi.name}
                    type="linear"
                    stroke={chartConfig[poi.name].color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {isForecastChecked && (
                    <Line
                      dataKey={getForecastKey(poi)}
                      type="linear"
                      stroke={chartConfig[getForecastKey(poi)].color}
                      strokeWidth={2}
                      dot={true}
                      isAnimationActive={false}
                    />
                  )}
                </React.Fragment>
              ))}
              <Legend content={<CustomLegend payload={chartConfig} />} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
