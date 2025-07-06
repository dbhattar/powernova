import { LoaderCircle } from "lucide-react";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { LMPResponse, Poi } from "@/types";
import { customTickFormatter, findYearlyLMPIndex, getMonthAndDay } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useGetAverageLMPData } from "@/services/lmp";
import { FORECAST_BEGIN_DATE, FORECAST_END_DATE } from "@/lib/consts";
import ForecastCheckBox from "../ForecastCheckBox";

const chartConfig = {
  avg_lmp: {
    label: "Average LMP",
    color: "hsl(var(--chart-1))",
  },
  avg_energy: {
    label: "Average Energy",
    color: "hsl(var(--chart-2))",
  },
  avg_congestion: {
    label: "Average Congestion",
    color: "hsl(var(--chart-3))",
  },
  avg_loss: {
    label: "Average Loss",
    color: "hsl(var(--chart-7))",
  },
  opening_lmp: {
    label: "Opening LMP",
    color: "hsl(var(--chart-5))",
  },
  closing_lmp: {
    label: "Closing LMP",
    color: "hsl(var(--chart-6))",
  },
  forecasted_lmp: {
    label: "Forecast LMP",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

export function LMPChart({
  selectedSubstation,
  actualLmpData,
  isLoading,
}: {
  selectedSubstation?: Poi;
  actualLmpData?: LMPResponse;
  isLoading: boolean;
}) {
  const [isForecastChecked, setIsForecastChecked] = useState(false);

  const { lmpData: forecasted_lmp } = useGetAverageLMPData(
    {
      ids: selectedSubstation?.id,
      type: "forecast",
      time__gte: FORECAST_BEGIN_DATE,
      time__lte: FORECAST_END_DATE,
    },
    !!selectedSubstation?.id && isForecastChecked
  );

  const chartData = useMemo(() => {
    if (!actualLmpData) return [];
    const index = findYearlyLMPIndex(actualLmpData);
    return [
      ...(actualLmpData?.rows || []).map((row) => ({
        time: row[index.time],
        avg_lmp: row[index.avg_lmp],
        avg_energy: row[index.avg_energy],
        avg_loss: row[index.avg_loss],
        avg_congestion: row[index.avg_congestion],
        opening_lmp: row[index.opening_lmp],
        closing_lmp: row[index.closing_lmp],
      })),
      ...(forecasted_lmp?.rows || []).map((row) => ({
        time: row[index.time],
        forecasted_lmp: row[index.avg_lmp],
      })),
    ];
  }, [actualLmpData, forecasted_lmp]);

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
      <CardHeader className="flex items-center justify-between flex-row flex-wrap gap-2">
        <CardTitle>
          Locational Marginal Price - {selectedSubstation?.name}
        </CardTitle>
        <ForecastCheckBox
          checked={isForecastChecked}
          onChange={(checked: boolean) => setIsForecastChecked(checked)}
        />
      </CardHeader>
      <CardContent className="mt-2">
        {isLoading && <LoaderCircle className="animate-spin" />}
        {actualLmpData && (
          <ChartContainer config={chartConfig} className="h-96 w-full p-0">
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
                tickMargin={5}
                tickFormatter={customTickFormatter}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={0}
                tickFormatter={(value) => "$" + value}
              />
              <ChartTooltip cursor={true} content={customTooltip} />
              <Line
                dataKey="avg_lmp"
                type="linear"
                stroke="var(--color-avg_lmp)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {isForecastChecked && (
                <Line
                  dataKey="forecasted_lmp"
                  type="linear"
                  stroke="var(--color-forecasted_lmp)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default LMPChart;
