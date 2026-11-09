import { useActionQuery } from "@agent-native/core/client/hooks";
import {
  IconAlertOctagon,
  IconBook2,
  IconChartBar,
  IconChecklist,
  IconInbox,
  IconSchool,
  IconSettings,
  type Icon,
} from "@tabler/icons-react";
import { Link, useLocation } from "react-router";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: Icon; badge?: number | undefined; hint: string };

export function useWorkspaceStatus() {
  return useActionQuery("get-workspace-status", {}, { refetchInterval: 15_000 });
}

/** Left rail: the Apprentice workspace. Chat threads stay below it. */
export function ApprenticeNav({ collapsed }: { collapsed: boolean }) {
  const { pathname } = useLocation();
  const { data } = useWorkspaceStatus();
  const items: Item[] = [
    { to: "/issues", label: "Queue", icon: IconInbox, hint: "g q" },
    { to: "/review", label: "Review", icon: IconChecklist, badge: data?.pendingReview, hint: "g r" },
    { to: "/exceptions", label: "Exceptions", icon: IconAlertOctagon, badge: data?.exceptions, hint: "g e" },
    { to: "/playbooks", label: "Playbooks", icon: IconBook2, hint: "g p" },
    { to: "/insights", label: "Insights", icon: IconChartBar, hint: "g i" },
    { to: "/lessons", label: "Lessons", icon: IconSchool, hint: "g l" },
    { to: "/preferences", label: "Settings", icon: IconSettings, hint: "g s" },
  ];
  return (
    <div className={cn("pb-2", collapsed ? "flex flex-col items-center gap-1" : "space-y-0.5 px-2")} aria-label="Apprentice">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        const link = (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active && "bg-sidebar-accent font-medium",
              collapsed ? "relative size-8 justify-center rounded-md" : "h-8 w-full gap-3 rounded-lg px-3 text-sm",
            )}
          >
            <item.icon className={cn("size-4 shrink-0", active && "text-primary")} strokeWidth={1.8} />
            <span className={collapsed ? "sr-only" : "flex-1 truncate"}>{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  "tabular rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground",
                  collapsed && "absolute -end-1 -top-1",
                )}
                aria-label={`${item.badge} waiting`}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </Link>
        );
        if (!collapsed) return link;
        return (
          <Tooltip key={item.to}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">
              {item.label} <span className="ms-1 font-mono opacity-70">{item.hint}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
