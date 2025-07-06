import { useMemo, useState } from "react";

import { CircleChevronDown, X } from "lucide-react";

import RecommendedItem from "./RecommendedItem";
import { RecommendedEntity } from "@/types";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

const sortOrder = [
  "resource",
  "user",
  "event",
  "circle",
  "organization",
  "job",
];

const getUniqueItems = (items: RecommendedEntity[]) => {
  const uniqueItems: RecommendedEntity[] = [];
  for (const item of items) {
    if (
      uniqueItems.some(
        (el) => (el.slug || el.source) === (item.slug || item.source)
      )
    ) {
      continue;
    }
    uniqueItems.push(item);
  }
  return uniqueItems;
};

export const RecommendedSources = ({
  recommendedItems,
}: {
  recommendedItems: RecommendedEntity[];
}) => {
  const [showDrawer, setShowDrawer] = useState(false);
  const sortedItems = useMemo(
    () =>
      recommendedItems?.sort(
        (a, b) => sortOrder.indexOf(a.type) - sortOrder.indexOf(b.type)
      ),
    [recommendedItems]
  );
  const uniqueItems = useMemo(() => getUniqueItems(sortedItems), [sortedItems]);
  const totalItems = uniqueItems?.length || 0;
  const showMore = totalItems > 2;

  return (
    <div className="flex flex-wrap items-center gap-2 my-2">
      <>
        {uniqueItems?.slice(0, 2)?.map((item) => (
          <RecommendedItem key={item.id} item={item} />
        ))}
        {showMore && (
          <div
            onClick={() => setShowDrawer(true)}
            className="my-2 flex items-center gap-2 hover:cursor-pointer hover:brightness-105 hover:text-gray-500"
          >
            <CircleChevronDown />
            <p className="font-medium">Show More</p>
          </div>
        )}
        <RecommendedDrawer
          showDrawer={showDrawer}
          setShowDrawer={setShowDrawer}
          recommendedItems={uniqueItems}
        />
      </>
    </div>
  );
};

interface RecommendedDrawerProps {
  recommendedItems: RecommendedEntity[];
  showDrawer: boolean;
  setShowDrawer: (_: boolean) => void;
}

const RecommendedDrawer = ({
  recommendedItems,
  showDrawer,
  setShowDrawer,
}: RecommendedDrawerProps) => {
  return (
    <Drawer open={showDrawer} onOpenChange={setShowDrawer} direction="right">
      <DrawerContent>
        <div className="p-2 sm:px-6">
          <div className="flex justify-between gap-2 items-center my-2">
            <p className="text-lg font-semibold">Related</p>
            <div
              onClick={() => setShowDrawer(false)}
              className="hover:cursor-pointer"
            >
              <X />
            </div>
          </div>
          <hr />
          <div className="my-8 flex flex-col gap-4">
            {recommendedItems.map((item, i) => (
              <div key={i} className="bg-slate-50 dark:bg-black rounded-lg p-1">
                <RecommendedItem item={item} />
              </div>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default RecommendedSources;
