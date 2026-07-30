'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';

import { adoQueryKeys } from '@core/constants';
import { buildIdentityMentionHtml, identityDisplayName } from '@core/domain';
import type { IdentityRef } from '@core/types';
import { useConnection } from '@/components/providers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

export function WorkItemCommentsPanel({
  workItemId,
  project,
  people,
  top = 50,
  showHeading = true,
}: {
  workItemId: number;
  project: string;
  people: IdentityRef[];
  top?: number;
  showHeading?: boolean;
}) {
  const { api, settings } = useConnection();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commentsQuery = useQuery({
    queryKey: adoQueryKeys.workItems.comments(settings.organization, workItemId),
    enabled: Boolean(api && workItemId),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listWorkItemComments({ id: workItemId, project, top, signal });
    },
  });

  const suggestions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    return people
      .filter((person) => {
        if (!person.id) return false;
        if (!q) return true;
        return (
          person.displayName?.toLowerCase().includes(q) ||
          person.uniqueName?.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [people, mentionQuery]);

  function onDraftChange(value: string) {
    setDraft(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const match = before.match(/@([^\s@]*)$/);
    if (match) {
      setMentionOpen(true);
      setMentionQuery(match[1] ?? '');
    } else {
      setMentionOpen(false);
      setMentionQuery('');
    }
  }

  function insertMention(person: IdentityRef) {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? draft.length;
    const before = draft.slice(0, caret);
    const after = draft.slice(caret);
    const label = person.displayName?.trim() || person.uniqueName?.trim() || 'user';
    const next = before.replace(/@([^\s@]*)$/, `@[${label}|${person.id}] `) + after;
    setDraft(next);
    setMentionOpen(false);
    setMentionQuery('');
    requestAnimationFrame(() => textarea?.focus());
  }

  function expandMentions(text: string): string {
    const withMentions = text.replace(
      /@\[([^\]|]+)\|([^\]]+)\]/g,
      (_full, name: string, id: string) =>
        buildIdentityMentionHtml({ id, displayName: name }),
    );
    return withMentions.replace(/\n/g, '<br/>');
  }

  async function onSubmit() {
    if (!api) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error('Write a comment first.');
      return;
    }
    setSubmitting(true);
    try {
      await api.addWorkItemComment({
        id: workItemId,
        project,
        text: expandMentions(trimmed),
      });
      setDraft('');
      toast.success('Comment added');
      await queryClient.invalidateQueries({
        queryKey: adoQueryKeys.workItems.comments(settings.organization, workItemId),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add comment');
    } finally {
      setSubmitting(false);
    }
  }

  const comments = commentsQuery.data?.data ?? [];

  return (
    <section className="space-y-3" aria-label="Work item comments">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showHeading ? <h3 className="text-sm font-medium">Comments</h3> : <span />}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="touch-target gap-2"
          disabled={commentsQuery.isFetching}
          onClick={() => void commentsQuery.refetch()}
        >
          <RefreshCw
            className={cn('size-4', commentsQuery.isFetching && 'animate-spin')}
          />
          Refresh
        </Button>
      </div>

      <div className="relative space-y-2">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Add a comment… Type @ to mention someone"
          rows={3}
          aria-label="New comment"
        />
        {mentionOpen && suggestions.length > 0 ? (
          <ul className="absolute z-20 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
            {suggestions.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => insertMention(person)}
                >
                  <span className="font-medium">{person.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {person.uniqueName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            className="touch-target h-11 gap-2"
            disabled={submitting}
            onClick={() => void onSubmit()}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Comment
          </Button>
        </div>
      </div>

      {commentsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load comments</AlertTitle>
          <AlertDescription>
            {commentsQuery.error instanceof Error
              ? commentsQuery.error.message
              : 'Something went wrong loading comments.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {commentsQuery.isLoading ? <Skeleton className="h-20 w-full" /> : null}

      {comments.length === 0 && !commentsQuery.isLoading && !commentsQuery.isError ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              <p className="text-xs text-muted-foreground">
                {identityDisplayName(comment.createdBy)}
                {comment.createdDate ? ` · ${formatDate(comment.createdDate)}` : ''}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{stripHtml(comment.text ?? '')}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
