'use client';

import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ADO_MAX_SIMPLE_ATTACHMENT_BYTES, adoQueryKeys } from '@core/constants';
import {
  listWorkItemAttachments,
  type WorkItemAttachment,
} from '@core/domain';
import type { WorkItemRelation } from '@core/types';
import { useConnection } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

export function WorkItemAttachmentsPanel({
  workItemId,
  project,
  organization,
  relations,
  onChanged,
}: {
  workItemId: number;
  project: string;
  organization: string;
  relations?: WorkItemRelation[];
  /** Called after upload/remove so the parent can refetch detail. */
  onChanged?: () => void | Promise<void>;
}) {
  const { api } = useConnection();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const attachments = useMemo(
    () => listWorkItemAttachments(relations),
    [relations],
  );

  async function invalidate() {
    await queryClient.invalidateQueries({
      queryKey: adoQueryKeys.attachments.workItem(organization, project, workItemId),
    });
    await queryClient.invalidateQueries({
      queryKey: adoQueryKeys.workItems.detail(organization, workItemId),
    });
    await onChanged?.();
  }

  async function onUpload(fileList: FileList | null) {
    if (!api || !fileList?.length) return;
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
        workItemId,
        fileName: file.name,
        content: file,
        comment: comment.trim() || undefined,
        project,
      });
      setComment('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success(`Attached ${file.name}`);
      await invalidate();
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
    if (!api) return;
    const confirmed = window.confirm(`Remove “${attachment.name}” from this work item?`);
    if (!confirmed) return;

    setRemovingIndex(attachment.relationIndex);
    try {
      await api.detachWorkItemAttachment({
        workItemId,
        relationIndex: attachment.relationIndex,
        project,
      });
      toast.success('Attachment removed');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove attachment');
    } finally {
      setRemovingIndex(null);
    }
  }

  return (
    <section aria-label="Attachments" className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="size-4" aria-hidden />
          Attachments
        </h3>
        <p className="text-xs text-muted-foreground">
          {attachments.length} file{attachments.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="space-y-2">
          <Label htmlFor={`wi-attachment-comment-${workItemId}`}>Optional comment</Label>
          <Textarea
            id={`wi-attachment-comment-${workItemId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            placeholder="Why this file is attached…"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            {uploading ? 'Uploading…' : 'Attach file'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Max {Math.floor(ADO_MAX_SIMPLE_ATTACHMENT_BYTES / (1024 * 1024))} MB per file.
        </p>
      </div>

      {attachments.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No attachments on this work item yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((attachment) => {
            const downloading = downloadingId === attachment.attachmentId;
            const removing = removingIndex === attachment.relationIndex;
            return (
              <li
                key={`${attachment.relationIndex}-${attachment.url}`}
                className="rounded-md border border-border px-3 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{attachment.name}</p>
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
                      <p className="text-sm text-muted-foreground">{attachment.comment}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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
                      size="sm"
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
  );
}
