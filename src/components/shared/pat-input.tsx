'use client';

import { Check, Copy, Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PatInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  className?: string;
}

export function PatInput({
  id = 'pat',
  value,
  onChange,
  disabled,
  'aria-invalid': ariaInvalid,
  className,
}: PatInputProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Access token copied');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy the access token');
    }
  }

  // Actions sit inside the field so the token gets the full width on phones;
  // copy and clear only appear once there is something to copy or clear.
  const actionButton = 'size-9 shrink-0 text-muted-foreground hover:text-foreground';
  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        aria-describedby={`${id}-hint`}
        placeholder="Personal Access Token"
        className={cn(
          'touch-target h-11 font-mono text-sm',
          value ? 'pe-[7.5rem]' : 'pe-12',
        )}
      />
      <div className="absolute inset-y-0 right-1 flex items-center">
        {value ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={actionButton}
              onClick={() => onChange('')}
              disabled={disabled}
              aria-label="Clear PAT"
            >
              <X className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={actionButton}
              onClick={() => void handleCopy()}
              disabled={disabled}
              aria-label="Copy PAT"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={actionButton}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? 'Hide PAT' : 'Show PAT'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
