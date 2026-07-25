import { Clock, FileText, MessageSquare, Send, ArrowRightLeft } from "lucide-react";
import type { ComponentType } from "react";

import type { PipelineActivity, PipelineActivityType } from "@/lib/pipeline/mock-data";

const activityIcon: Record<PipelineActivityType, ComponentType<{ className?: string }>> = {
  criacao: FileText,
  envio: Send,
  mudanca_status: ArrowRightLeft,
  nota: MessageSquare,
  follow_up: Clock,
};

const timelineFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function QuoteTimeline({ activities }: { activities: PipelineActivity[] }) {
  return (
    <ol className="flex flex-col gap-5">
      {activities.map((activity, index) => {
        const Icon = activityIcon[activity.type];
        const isLast = index === activities.length - 1;

        return (
          <li key={activity.id} className="relative flex gap-3 pl-0.5">
            {!isLast && (
              <span className="bg-border absolute top-6 left-[13px] h-[calc(100%+8px)] w-px" />
            )}
            <div className="bg-muted ring-border relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-1">
              <Icon className="text-muted-foreground size-3.5" aria-hidden="true" />
            </div>
            <div className="flex flex-1 flex-col gap-0.5 pb-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{activity.label}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {timelineFormatter.format(new Date(activity.timestamp))}
                </span>
              </div>
              {activity.detail && (
                <p className="text-muted-foreground text-sm">{activity.detail}</p>
              )}
              <span className="text-muted-foreground text-xs">{activity.author}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
