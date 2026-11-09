import Link from "next/link";
import {
  CalendarDays,
  FileText,
  Building2,
  FolderOpen,
  ImageIcon,
  Ticket,
  Plus,
  Settings,
  BarChart3,
  Newspaper,
  Gift,
  AlertTriangle,
} from "lucide-react";
import { getDueRaffleReturns } from "@/actions/raffle-return";
import { formatUk } from "@/lib/raffles/time";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const quickActions = [
  {
    name: "Reports",
    href: "/admin/reports",
    icon: BarChart3,
    description: "Income, bookings and lottery performance",
  },
  {
    name: "Add Event",
    href: "/admin/events/new",
    icon: Plus,
    description: "Create a new community event",
  },
  {
    name: "Manage Events",
    href: "/admin/events",
    icon: CalendarDays,
    description: "Edit or remove events",
  },
  {
    name: "Edit Pages",
    href: "/admin/pages",
    icon: FileText,
    description: "Update page content",
  },
  {
    name: "Facilities",
    href: "/admin/facilities",
    icon: Building2,
    description: "Manage facility information",
  },
  {
    name: "Documents",
    href: "/admin/documents",
    icon: FolderOpen,
    description: "Upload meeting minutes & docs",
  },
  {
    name: "Images",
    href: "/admin/images",
    icon: ImageIcon,
    description: "Manage the photo gallery",
  },
  {
    name: "Lottery",
    href: "/admin/lottery",
    icon: Ticket,
    description: "View lottery ticket holders",
  },
  {
    name: "Raffles",
    href: "/admin/raffles",
    icon: Gift,
    description: "Set up raffles, record cash sales and run draws",
  },
  {
    name: "Newsletter",
    href: "/admin/newsletter",
    icon: Newspaper,
    description: "See who has signed up and export the list",
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Configure site settings and contact info",
  },
];

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const dueReturns = await getDueRaffleReturns();
  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome to the Loddiswell Community Trust admin area.
      </p>

      {dueReturns.length > 0 && (
        <Card className="mt-8 border-copper-300 bg-copper-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-copper-700" aria-hidden="true" />
              Raffle returns due to South Hams
            </CardTitle>
            <CardDescription>
              {dueReturns.map((r) => (
                <span key={r.id} className="block">
                  <Link href={`/admin/raffles/${r.id}/return`} className="font-medium text-foreground underline">
                    {r.title}
                  </Link>{" "}
                  · {r.overdue ? "overdue since" : "due by"} {formatUk(r.dueBy, "d MMMM yyyy")}
                </span>
              ))}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action) => (
          <Link key={action.name} href={action.href} className="no-underline">
            <Card className="group hover:border-primary/50 hover:shadow-sm transition-all h-full">
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary flex-shrink-0">
                  <action.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-base group-hover:text-primary transition-colors">
                    {action.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {action.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
