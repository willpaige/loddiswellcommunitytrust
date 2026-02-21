import Link from "next/link";
import {
  CalendarDays,
  FileText,
  Building2,
  FolderOpen,
  ImageIcon,
  Ticket,
  Plus,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const quickActions = [
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
];

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome to the Loddiswell Community Trust admin area.
      </p>

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
