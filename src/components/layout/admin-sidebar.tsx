"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Building2,
  FolderOpen,
  ImageIcon,
  Ticket,
  Users,
  Settings,
  BookOpenCheck,
  LogOut,
  ArrowLeft,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Events", href: "/admin/events", icon: CalendarDays },
  {
    name: "Bookings",
    href: "/admin/bookings",
    icon: BookOpenCheck,
    children: [
      { name: "Bookings", href: "/admin/bookings" },
      { name: "Availability", href: "/admin/bookings/availability" },
      { name: "Settings", href: "/admin/bookings/settings" },
    ],
  },
  { name: "Pages", href: "/admin/pages", icon: FileText },
  { name: "Facilities", href: "/admin/facilities", icon: Building2 },
  { name: "Trustees", href: "/admin/trustees", icon: Users },
  { name: "Documents", href: "/admin/documents", icon: FolderOpen },
  { name: "Images", href: "/admin/images", icon: ImageIcon },
  { name: "Lottery", href: "/admin/lottery", icon: Ticket },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

interface AdminSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <p className="font-semibold text-sm text-foreground">
          Loddiswell Trust
        </p>
        <p className="text-xs text-muted-foreground">Admin</p>
      </div>

      <Separator />

      <nav className="flex-1 p-3 space-y-1" aria-label="Admin navigation">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <div key={item.name}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors",
                  active
                    ? "bg-secondary text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {item.name}
              </Link>
              {"children" in item && item.children && active && (
                <div className="ml-7 mt-1 space-y-1 border-l border-border pl-2">
                  {item.children.map((child) => {
                    const childActive =
                      pathname === child.href ||
                      (child.href !== "/admin/bookings" && pathname.startsWith(child.href));
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "block rounded-md px-3 py-1.5 text-sm no-underline transition-colors",
                          childActive
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <Separator />

      <div className="p-3 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground no-underline hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          View Site
        </Link>
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transform transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 border-r bg-card flex-shrink-0">
        {sidebar}
      </aside>
    </>
  );
}
