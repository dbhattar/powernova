import { Home, BarChart2, Settings } from "lucide-react";

import { Link, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ProfileMenu } from "./ProfileMenu";

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "LMP",
    url: "/lmp",
    icon: BarChart2,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { open } = useSidebar();

  return (
    <Sidebar className="border-r" collapsible="icon">
      <div className="relative hidden md:flex gap-2 items-center w-full">
        <SidebarTrigger className="absolute right-2 top-2" />
      </div>
      <SidebarHeader className="p-4">
        {open && (
          <Link to="/" className="flex items-center space-x-2">
            <img
              src="/CosmicGlobal.svg"
              alt="Cosmic Global Logo"
              className="h-8 w-full"
            />
          </Link>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    className="w-full justify-start"
                  >
                    <Link to={item.url} className="flex items-center space-x-2">
                      <item.icon className="h-5 w-5" />
                      {<span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {open && (
        <SidebarFooter className="p-4">
          <Separator className="my-4" />
          <ProfileMenu />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
