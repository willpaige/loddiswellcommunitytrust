import {
  Building2,
  TreePine,
  Trophy,
  MapPin,
  Bike,
  type LucideIcon,
} from "lucide-react";

const iconBySlug: Record<string, LucideIcon> = {
  "village-hall": Building2,
  pavilion: TreePine,
  "tennis-courts": Trophy,
  "playing-field": MapPin,
  "pump-track": Bike,
};

export function facilityIcon(slug: string): LucideIcon {
  return iconBySlug[slug] ?? Building2;
}
