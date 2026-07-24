import { Kanban, LayoutDashboard, Package, Settings, Users } from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Pipeline", href: "/pipeline", icon: Kanban },
  { title: "Catálogo", href: "/catalog", icon: Package },
  { title: "Clientes", href: "/customers", icon: Users },
  { title: "Configurações", href: "/settings", icon: Settings },
];
