import { ArrowUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  cn,
  getConstrainsNumberFromConstraintsWithNA,
  getConstrainsNumberFromHeatmapWithNA,
  getConstraintsAvailableCapacityWithNA,
  getCurrentQueueWithNA,
  getHeatmapAvailableCapacityWithNA,
  getPolicyPortfolioWithNA,
  getTotalProjectsWithNA,
  isSomeFilterHidden,
} from "@/lib/utils";

import { InterConnectionLevelT, Poi } from "@/types";

export default function PoiTable({
  sortPois,
  filteredPois,
  substationType,
  interconnectionEntity,
}: {
  sortPois: (key: string) => void;
  filteredPois: Poi[];
  substationType: InterConnectionLevelT;
  interconnectionEntity: string;
}) {
  const disableSomeFilters = isSomeFilterHidden(
    substationType,
    interconnectionEntity
  );

  return (
    <Table className="relative">
      <TableHeader className="sticky top-0 bg-slate-100 font-semibold w-full border border-slate-200 z-20">
        <TableRow className="bg-slate-50 border">
          <TableHead
            rowSpan={2}
            className="group border-r hover:bg-gray-100 hover:cursor-pointer border-slate-200"
            onClick={() => sortPois("name")}
          >
            <div className="flex gap-2 ">
              POI
              <ArrowUpDown className="h-5 w-5 invisible group-hover:visible" />
            </div>
          </TableHead>
          <TableHead
            colSpan={disableSomeFilters ? 1 : 2}
            className="text-center border-r border-gray-200"
          >
            Available Capacity
          </TableHead>
          <TableHead
            rowSpan={2}
            className={cn(
              "group border-r hover:bg-gray-100 hover:cursor-pointer border-gray-200",
              {
                hidden: disableSomeFilters,
              }
            )}
            onClick={() => sortPois("policy_portfolio")}
          >
            <div className="flex gap-2">
              Policy Portfolio (MW)
              <ArrowUpDown className="flex-shrink-0 h-5 w-5 invisible group-hover:visible" />
            </div>
          </TableHead>
          <TableHead
            colSpan={2}
            className="text-center border-r border-gray-200"
          >
            Current Queue
          </TableHead>
          <TableHead
            colSpan={2}
            className={cn("text-center border-r border-gray-200", {
              hidden: disableSomeFilters,
            })}
          >
            Number of Constraints
          </TableHead>
        </TableRow>
        <TableRow>
          <TableHead
            className={cn(
              "group border-r hover:bg-gray-100 hover:cursor-pointer border-gray-200",
            )}
            onClick={() => sortPois("heatmap_available_capacity")}
          >
            Heatmap (MW)
            <ArrowUpDown className="h-5 w-5 invisible group-hover:visible" />
          </TableHead>
          <TableHead
            className={cn(
              "group border-r hover:bg-gray-100 hover:cursor-pointer border-gray-200",
              { hidden: disableSomeFilters }
            )}
            onClick={() => sortPois("constraints_available_capacity")}
          >
            Constraint (MW)
            <ArrowUpDown className="h-5 w-5 invisible group-hover:visible" />
          </TableHead>
          <TableHead
            className="group border-r hover:bg-gray-100 hover:cursor-pointer border-gray-200"
            onClick={() => sortPois("total_projects")}
          >
            # of Projects
            <ArrowUpDown className="h-5 w-5 invisible group-hover:visible" />
          </TableHead>
          <TableHead
            className="group border-r hover:bg-gray-100 hover:cursor-pointer border-gray-200"
            onClick={() => sortPois("current_queue")}
          >
            Total (MW)
            <ArrowUpDown className="h-5 w-5 invisible group-hover:visible" />
          </TableHead>
          <TableHead
            className={cn(
              "group border-r hover:bg-gray-100 hover:cursor-pointer border-gray-200",
              { hidden: disableSomeFilters }
            )}
            onClick={() => sortPois("constrains_number_from_heatmap")}
          >
            Heatmap
            <ArrowUpDown className="h-5 w-5 invisible group-hover:visible" />
          </TableHead>
          <TableHead
            className={cn(
              "group border-r hover:bg-gray-100 hover:cursor-pointer border-gray-200",
              { hidden: disableSomeFilters }
            )}
            onClick={() => sortPois("constrains_number_from_constraints")}
          >
            Constraint Report
            <ArrowUpDown className="h-5 w-5 invisible group-hover:visible" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="border-l border-r border-b">
        {filteredPois?.map((selectedData, i) => (
          <TableRow key={i}>
            <TableCell className="border-r">{selectedData.name}</TableCell>
            <TableCell className="border-r">
              {getHeatmapAvailableCapacityWithNA(selectedData)}
            </TableCell>
            <TableCell
              className={cn("border-r", { hidden: disableSomeFilters })}
            >
              {getConstraintsAvailableCapacityWithNA(selectedData)}
            </TableCell>
            <TableCell
              className={cn("border-r", { hidden: disableSomeFilters })}
            >
              {getPolicyPortfolioWithNA(selectedData)}
            </TableCell>
            <TableCell className="border-r">
              {getTotalProjectsWithNA(selectedData)}
            </TableCell>
            <TableCell className="border-r">
              {getCurrentQueueWithNA(selectedData)}
            </TableCell>
            <TableCell
              className={cn("border-r", { hidden: disableSomeFilters })}
            >
              {getConstrainsNumberFromHeatmapWithNA(selectedData)}
            </TableCell>
            <TableCell
              className={cn("border-r", { hidden: disableSomeFilters })}
            >
              {getConstrainsNumberFromConstraintsWithNA(selectedData)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
