import {
  UserRound,
  UsersRound,
  Building,
  File,
  Calendar,
  BriefcaseBusiness,
  ExternalLink,
} from "lucide-react";

import { Entity } from "@/types";

export const IconMap = ({
  itemType,
  className = "h-6 w-6",
}: {
  itemType: Entity | "external" | "internal";
  className?: string;
}) => {
  switch (itemType) {
    case "user":
      return <UserRound className={className} />;
    case "circle":
      return <UsersRound className={className} />;
    case "organization":
      return <Building className={className} />;
    case "institution":
      return <Building className={className} />;
    case "resource":
      return <File className={className} />;
    case "internal":
      return <File className={className} />;
    case "external":
      return <ExternalLink className={className} />;
    case "event":
      return <Calendar className={className} />;
    case "job":
      return <BriefcaseBusiness className={className} />;
    default:
      return null;
  }
};
