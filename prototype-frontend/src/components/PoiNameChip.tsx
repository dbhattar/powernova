import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Poi } from "@/types";

export function PoiNameChip({
  pois,
  handleRemove,
}: {
  pois: Poi[];
  handleRemove: (poi: Poi) => void;
}) {
  return (
    <div className="flex gap-2 md:px-2 flex-wrap">
      {pois.map((x) => (
        <Badge key={x.id} variant={"secondary"} className="p-2 font-normal">
          {x.name}{" "}
          <X
            onClick={() => handleRemove(x)}
            className="ml-2 h-5 w-5 hover:cursor-pointer hover:text-gray-500"
          />
        </Badge>
      ))}
    </div>
  );
}
