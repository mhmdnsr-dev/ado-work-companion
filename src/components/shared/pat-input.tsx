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
      toast.success('PAT copied to clipboard');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Unable to copy PAT');
    }
  }

  return (
    <div className={cn('flex gap-2', className)}>
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
        className="touch-target h-11 font-mono text-sm"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="touch-target size-11 shrink-0"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-label={visible ? 'Hide PAT' : 'Show PAT'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="touch-target size-11 shrink-0"
        onClick={() => void handleCopy()}
        disabled={disabled || !value}
        aria-label="Copy PAT"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="touch-target size-11 shrink-0"
        onClick={() => onChange('')}
        disabled={disabled || !value}
        aria-label="Clear PAT"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
