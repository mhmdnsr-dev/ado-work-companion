'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Download,
  FolderKanban,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { ADO_MAX_SIMPLE_ATTACHMENT_BYTES, adoQueryKeys } from '@core/constants';
import {
  fieldString,
  identityDisplayName,
  listWorkItemAttachments,
  type WorkItemAttachment,
} from '@core/domain';
import { useConnection } from '@/components/providers';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function formatBytes(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerBrowserDownload(
  buffer: ArrayBuffer,
  fileName: string,
  contentType?: string,
) {
  const blob = new Blob([buffer], {
    type: contentType || 'application/octet-stream',
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName || 'attachment';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function AttachmentsView() {
  const { settings, hydrated } = useConnection();
  const organization = settings.organization;
  const project = settings.project?.trim() ?? '';

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <AttachmentsViewContent
      key={`${organization}::${project}`}
      organization={organization}
      project={project}
    />
  );
}

function AttachmentsViewContent({
  organization,
  project,
}: {
  organization: string;
  project: string;
}) {
  const { api } = useConnection();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFromUrl = searchParams.get('id')?.trim() ?? '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [idInput, setIdInput] = useState(initialFromUrl);
  const [loadedId, setLoadedId] = useState<number | null>(() => {
    if (/^\d+$/.test(initialFromUrl)) return Number(initialFromUrl);
    return null;
  });
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const workItemQuery = useQuery({
    queryKey: adoQueryKeys.attachments.workItem(organization, project, loadedId ?? 0),
    enabled: Boolean(api && project && loadedId),
    queryFn: async ({ signal }) => {
      if (!api || !loadedId) throw new Error('Connection is not ready.');
      return api.getWorkItem({
        id: loadedId,
        project,
        expand: 'Relations',
        signal,
      });
    },
  });

  const workItem = workItemQuery.data?.data;
  const attachments = useMemo(
    () => listWorkItemAttachments(workItem?.relations),
    [workItem?.relations],
  );

  const title = workItem ? fieldString(workItem, 'System.Title') : '';
  const state = workItem ? fieldString(workItem, 'System.State') : '';
  const type = workItem ? fieldString(workItem, 'System.WorkItemType') : '';
  const assignee = workItem
    ? identityDisplayName(workItem.fields?.['System.AssignedTo']) || 'Unassigned'
    : '';

  function loadWorkItem() {
    const trimmed = idInput.trim();
    if (!/^\d+$/.test(trimmed)) {
      toast.error('Enter a numeric work item ID.');
      return;
    }
    const id = Number(trimmed);
    setLoadedId(id);
    router.replace(`/attachments?id=${id}`);
  }

  async function onUpload(fileList: FileList | null) {
    if (!api || !loadedId || !fileList?.length) return;
    const file = fileList[0];
    if (!file) return;

    if (file.size > ADO_MAX_SIMPLE_ATTACHMENT_BYTES) {
      toast.error(
        `File is larger than ${Math.floor(ADO_MAX_SIMPLE_ATTACHMENT_BYTES / (1024 * 1024))} MB.`,
      );
      return;
    }

    setUploading(true);
    try {
      await api.attachFileToWorkItem({
        workItemId: loadedId,
        fileName: file.name,
        content: file,
        comment: comment.trim() || undefined,
        project,
      });
      setComment('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success(`Attached ${file.name}`);
      await queryClient.invalidateQueries({
        queryKey: adoQueryKeys.attachments.workItem(organization, project, loadedId),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload attachment');
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(attachment: WorkItemAttachment) {
    if (!api || !attachment.attachmentId) {
      toast.error('This attachment cannot be downloaded (missing id).');
      return;
    }
    setDownloadingId(attachment.attachmentId);
    try {
      const result = await api.downloadAttachment({
        id: attachment.attachmentId,
        fileName: attachment.name,
        project,
      });
      triggerBrowserDownload(
        result.data.buffer,
        attachment.name,
        result.data.contentType,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not download attachment',
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function onRemove(attachment: WorkItemAttachment) {
    if (!api || !loadedId) return;
    const confirmed = window.confirm(`Remove “${attachment.name}” from this work item?`);
    if (!confirmed) return;

    setRemovingIndex(attachment.relationIndex);
    try {
      await api.detachWorkItemAttachment({
        workItemId: loadedId,
        relationIndex: attachment.relationIndex,
        project,
      });
      toast.success('Attachment removed');
      await queryClient.invalidateQueries({
        queryKey: adoQueryKeys.attachments.workItem(organization, project, loadedId),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove attachment');
    } finally {
      setRemovingIndex(null);
    }
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Attachments
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Upload, list, and download files on a work item.
          </p>
        </header>
        <Alert>
          <FolderKanban className="size-4" />
          <AlertTitle>Choose a project first</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Attachments belong to work items inside a project. Pick one to continue.
            </span>
            <Button asChild className="touch-target h-11 shrink-0">
              <Link href="/projects">Browse projects</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Attachments
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Manage files on a work item in{' '}
            <span className="font-medium text-foreground">{project}</span>.
          </p>
        </div>
        {loadedId ? (
          <Button
            type="button"
            variant="outline"
            className="touch-target h-11 gap-2"
            disabled={workItemQuery.isFetching}
            onClick={() => void workItemQuery.refetch()}
          >
            <RefreshCw
              className={cn('size-4', workItemQuery.isFetching && 'animate-spin')}
            />
            Refresh
          </Button>
        ) : null}
      </header>

      <section
        aria-label="Work item lookup"
        className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="attachments-work-item-id">Work item ID</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="attachments-work-item-id"
              inputMode="numeric"
              value={idInput}
              onChange={(event) => setIdInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  loadWorkItem();
                }
              }}
              placeholder="e.g. 1234"
              className="touch-target h-11 pl-9"
            />
          </div>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            className="touch-target h-11 w-full gap-2 sm:w-auto"
            onClick={loadWorkItem}
          >
            <Paperclip className="size-4" />
            Load attachments
          </Button>
        </div>
      </section>

      {!loadedId ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
          <Paperclip className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Enter a work item ID</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Load a work item to list attached files, upload a new one, or download
            existing attachments.
          </p>
        </div>
      ) : workItemQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : workItemQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load work item #{loadedId}</AlertTitle>
          <AlertDescription>
            {workItemQuery.error instanceof Error
              ? workItemQuery.error.message
              : 'Check the ID and project, then try again.'}
          </AlertDescription>
        </Alert>
      ) : workItem ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">#{loadedId}</Badge>
                {type ? <Badge variant="secondary">{type}</Badge> : null}
                {state ? <Badge>{state}</Badge> : null}
              </div>
              <h2 className="text-lg font-semibold tracking-tight">
                {title || 'Untitled'}
              </h2>
              <p className="text-sm text-muted-foreground">{assignee}</p>
            </div>
          </div>

          <section
            aria-label="Upload attachment"
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <h3 className="text-sm font-medium">Upload</h3>
            <div className="space-y-2">
              <Label htmlFor="attachment-comment">Optional comment</Label>
              <Textarea
                id="attachment-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={2}
                placeholder="Why this file is attached…"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                ref={fileInputRef}
                type="file"
                className="touch-target h-11"
                disabled={uploading}
                onChange={(event) => void onUpload(event.target.files)}
                aria-label="Choose file to upload"
              />
              <Button
                type="button"
                variant="secondary"
                className="touch-target h-11 gap-2"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploading ? 'Uploading…' : 'Choose file'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Max {Math.floor(ADO_MAX_SIMPLE_ATTACHMENT_BYTES / (1024 * 1024))} MB per
              file for this upload flow.
            </p>
          </section>

          <section aria-label="Attachment list" className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <h3 className="text-base font-semibold tracking-tight">Files</h3>
              <p className="text-sm text-muted-foreground">
                {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
              </p>
            </div>

            {attachments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No attachments on this work item yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {attachments.map((attachment) => {
                  const downloading = downloadingId === attachment.attachmentId;
                  const removing = removingIndex === attachment.relationIndex;
                  return (
                    <li
                      key={`${attachment.relationIndex}-${attachment.url}`}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[
                              formatBytes(attachment.size),
                              attachment.createdDate
                                ? formatDate(attachment.createdDate)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {attachment.comment ? (
                            <p className="text-sm text-muted-foreground">
                              {attachment.comment}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="touch-target h-11 gap-2"
                            disabled={!attachment.attachmentId || downloading || removing}
                            onClick={() => void onDownload(attachment)}
                          >
                            {downloading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                            Download
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="touch-target h-11 gap-2 text-destructive hover:text-destructive"
                            disabled={removing || downloading}
                            onClick={() => void onRemove(attachment)}
                          >
                            {removing ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                            Remove
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
