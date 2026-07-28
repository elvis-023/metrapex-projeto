import {
  BarChart3,
  FilePlus2,
  Kanban,
  LayoutDashboard,
  Package,
  Settings,
  Users,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Criar Orçamento", href: "/quotes/new", icon: FilePlus2 },
  { title: "Pipeline", href: "/pipeline", icon: Kanban },
  { title: "Catálogo", href: "/catalog", icon: Package },
  { title: "Clientes", href: "/customers", icon: Users },
  { title: "Relatórios", href: "/reports", icon: BarChart3 },
  { title: "Configurações", href: "/settings", icon: Settings },
];
