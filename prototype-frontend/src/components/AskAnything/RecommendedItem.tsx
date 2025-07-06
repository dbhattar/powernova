import React from "react";

import { RecommendedEntity } from "@/types";
import { IconMap } from "@/components/IconMap";
import { APP_URL } from "@/lib/consts";

interface DisplayItemProps {
  item: RecommendedEntity;
}

const RecommendedItem: React.FC<DisplayItemProps> = ({ item }) => {
  const isExternalLink = item.sub_type == "external";
  const getLink = (item: RecommendedEntity) => {
    if (isExternalLink && item.source) {
      return item.source;
    }
    let path = "";
    switch (item.type) {
      case "user":
        path = "/profile/" + item.slug;
        break;
      case "resource":
        path = "/resource/" + item.slug;
        break;
      case "event":
        path = "/event/" + item.slug;
        break;
      case "job":
        path = "/job/" + item.id;
        break;
      default:
        path = "/org/" + item.slug;
        break;
    }
    return APP_URL + path;
  };

  return (
    <div className="py-2 gap-2 rounded-md">
      <a
        href={getLink(item)}
        target="_blank"
        rel="noreferrer noopenner"
        className="flex items-center gap-2 break-words md:max-w-lg brightness-90 hover:brightness-110 hover:cursor-pointer"
      >
        <IconMap
          itemType={item.sub_type || item.type}
          className="flex-shrink-0 h-6 w-6"
        />
        <p className="font-medium">{item.name || item.title}</p>
      </a>
    </div>
  );
};

export default RecommendedItem;
