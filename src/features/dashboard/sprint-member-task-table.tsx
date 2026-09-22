'use client';

import Link from 'next/link';

import type { MemberSprintTaskRow } from '@core/domain';
import { useConnection } from '@/components/providers';

export function SprintMemberTaskTable({ tasks }: { tasks: MemberSprintTaskRow[] }) {
  const { settings } = useConnection();
  const organization = settings.organization;
  const project = settings.project?.trim() ?? '';

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No work items assigned to this member in the current sprint.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 text-right font-medium">Remaining</th>
            <th className="px-3 py-2 text-right font-medium">Completed</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const href =
              organization && project
                ? `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_workitems/edit/${task.id}`
                : undefined;
            return (
              <tr key={task.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-mono text-xs">
                  {href ? (
                    <Link
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {task.id}
                    </Link>
                  ) : (
                    task.id
                  )}
                </td>
                <td className="max-w-[14rem] truncate px-3 py-2" title={task.title}>
                  {task.title}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{task.type}</td>
                <td className="px-3 py-2">{task.state}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {task.remainingHours} h
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {task.completedHours} h
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
