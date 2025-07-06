import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PoiInformation } from "./PoiList";
import { useState } from "react";

const options = [
  {
    key: "available_capacity",
    label: "Available Capacity",
  },
  {
    key: "current_queue",
    label: "Current Queue",
  },
  {
    key: "policy_portfolio",
    label: "Policy Portfolio",
  },
];

export function ViewOptions({ tabOptions, selectedTab, setSelectedTab }: any) {

  return (
    <Tabs className="w-[400px]">
      <TabsList className="grid w-full grid-cols-3">
        {tabOptions.map((option) => (
          <TabsTrigger
            key={option.key}
            value={option.key}
            onClick={() => setSelectedTab(option.key)}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
