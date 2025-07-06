import { DualRangeSlider } from "@/components/ui/dual-range-slider";
import { cn } from "@/lib/utils";
import { Poi } from "@/types";

interface ExtraFilterProps {
  minHeatmapAvailableCapacity: number;
  maxHeatmapAvailableCapacity: number;
  minConstraintsAvailableCapacity: number;
  maxConstraintsAvailableCapacity: number;
  minQueue: number;
  maxQueue: number;
  minPolicyPortfolio: number;
  maxPolicyPortfolio: number;
  heatmapAvailableCapacityFilter: [number, number];
  constraintsAvailableCapacityFilter: [number, number];
  currentQueueFilter: [number, number];
  policyPortfolioFilter: [number, number];
  setHeatmapAvailableCapacityFilter: (value: [number, number]) => void;
  setConstraintsAvailableCapacityFilter: (value: [number, number]) => void;
  setCurrentQueueFilter: (value: [number, number]) => void;
  setPolicyPortfolioFilter: (value: [number, number]) => void;
  setFilteredSubstationsData: (value: Poi[]) => void;
  disableSomeFilters: boolean;
}

const SelectCss = "space-y-2 flex-1 whitespace-nowrap";

const ExtraFilter = (props: ExtraFilterProps) => {

  return (
    <div className="flex flex-wrap gap-4 md:gap-4 w-full">
      <div className={SelectCss}>
        <p className="text-sm font-medium mb-8">Heatmap Available Capacity</p>
        <DualRangeSlider
          label={(value) => <span>{value}</span>}
          value={props.heatmapAvailableCapacityFilter}
          onValueChange={props.setHeatmapAvailableCapacityFilter}
          min={props.minHeatmapAvailableCapacity}
          max={props.maxHeatmapAvailableCapacity}
          step={1}
        />
      </div>
      <div className={cn(SelectCss, { "hidden": props.disableSomeFilters })}>
        <p className="text-sm font-medium mb-8">Constraints Available Capacity</p>
        <DualRangeSlider
          label={(value) => <span>{value}</span>}
          value={props.constraintsAvailableCapacityFilter}
          onValueChange={props.setConstraintsAvailableCapacityFilter}
          min={props.minConstraintsAvailableCapacity}
          max={props.maxConstraintsAvailableCapacity}
          step={1}
        />
      </div>
      <div className={cn(SelectCss, { "hidden": props.disableSomeFilters })}>
        <p className="text-sm font-medium mb-8">Current Queue</p>
        <DualRangeSlider
          label={(value) => <span>{value}</span>}
          value={props.currentQueueFilter}
          onValueChange={props.setCurrentQueueFilter}
          min={props.minQueue}
          max={props.maxQueue}
          step={1}
        />
      </div>
      <div className={cn(SelectCss, { "hidden": props.disableSomeFilters })}>
        <p className="text-sm font-medium mb-8">Policy Portfolio</p>
        <DualRangeSlider
          label={(value) => <span>{value}</span>}
          value={props.policyPortfolioFilter}
          onValueChange={props.setPolicyPortfolioFilter}
          min={props.minPolicyPortfolio}
          max={props.maxPolicyPortfolio}
          step={1}
        />
      </div>
    </div>
  );
};
export default ExtraFilter;
