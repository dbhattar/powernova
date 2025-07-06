import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/Sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="min-h-screen w-full">
        <div className="flex gap-2 items-center px-2 w-full md:hidden">
          <SidebarTrigger />
        </div>
        <main className="h-full container mx-auto p-2 md:p-4">{children}</main>
      </div>
    </SidebarProvider>
  );
}
