import {
  Shield,
  UserCog,
  CircleDashed,
  CarFront,
  Construction,
  Camera,
  TriangleAlert,
  HardHat,
  Ban,
  Waves,
  PawPrint,
  Siren,
  type LucideProps,
} from "lucide-react";

// Maps the string icon names stored in HAZARD_TYPES to the actual lucide
// components. Kept as an explicit lookup (rather than dynamic import) so
// tree-shaking/bundling stays simple and predictable.
const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  Shield,
  UserCog,
  CircleDashed,
  CarFront,
  Construction,
  Camera,
  TriangleAlert,
  HardHat,
  Ban,
  Waves,
  PawPrint,
  Siren,
};

export function HazardIcon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = ICONS[name] ?? TriangleAlert;
  return <Cmp {...props} />;
}
