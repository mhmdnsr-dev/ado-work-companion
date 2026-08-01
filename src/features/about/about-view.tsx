'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Loader2, Mail, Send, Settings } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { APP_INFO, AUTHOR } from '@core/constants';
import {
  contactMessageSchema,
  type ContactMessageFormValues,
} from '@core/schemas';
import { BrandLockup } from '@/components/brand';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ContactApiError, sendContactMessage } from '@/lib/contact-api';

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function MessageMeForm() {
  const form = useForm<ContactMessageFormValues>({
    resolver: zodResolver(contactMessageSchema),
    defaultValues: {
      replyEmail: '',
      subject: '',
      message: '',
      company: '',
    },
    mode: 'onBlur',
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: ContactMessageFormValues) {
    try {
      await sendContactMessage({
        ...values,
        idempotencyKey:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? `contact/${crypto.randomUUID()}`
            : undefined,
      });
      toast.success('Message sent', {
        description: 'Thanks — I’ll get back to you by email.',
      });
      reset({ replyEmail: '', subject: '', message: '', company: '' });
    } catch (error) {
      const description =
        error instanceof ContactApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not send your message.';
      toast.error('Message not sent', { description });
    }
  }

  return (
    <form
      className="space-y-4"
      aria-label="Message me by email"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <FieldGroup>
        <Field data-invalid={Boolean(errors.replyEmail) || undefined}>
          <FieldLabel htmlFor="about-message-email">Your email</FieldLabel>
          <Input
            id="about-message-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="touch-target h-11"
            aria-invalid={Boolean(errors.replyEmail) || undefined}
            disabled={isSubmitting}
            {...register('replyEmail')}
          />
          <FieldError errors={[errors.replyEmail]} />
        </Field>

        <Field data-invalid={Boolean(errors.subject) || undefined}>
          <FieldLabel htmlFor="about-message-subject">Subject</FieldLabel>
          <Input
            id="about-message-subject"
            placeholder="What’s this about?"
            className="touch-target h-11"
            autoComplete="off"
            aria-invalid={Boolean(errors.subject) || undefined}
            disabled={isSubmitting}
            {...register('subject')}
          />
          <FieldError errors={[errors.subject]} />
        </Field>

        <Field data-invalid={Boolean(errors.message) || undefined}>
          <FieldLabel htmlFor="about-message-body">Message</FieldLabel>
          <Textarea
            id="about-message-body"
            rows={4}
            placeholder="Write your message…"
            aria-invalid={Boolean(errors.message) || undefined}
            disabled={isSubmitting}
            {...register('message')}
          />
          <FieldError errors={[errors.message]} />
        </Field>
      </FieldGroup>

      {/* Honeypot — hidden from assistive tech and pointer users */}
      <div
        className="absolute -left-[10000px] h-px w-px overflow-hidden"
        aria-hidden
      >
        <label htmlFor="about-message-company">Company</label>
        <Input
          id="about-message-company"
          tabIndex={-1}
          autoComplete="off"
          {...register('company')}
        />
      </div>

      <Button
        type="submit"
        className="touch-target h-11 gap-2"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Send className="size-4" aria-hidden />
        )}
        {isSubmitting ? 'Sending…' : 'Message me'}
      </Button>
    </form>
  );
}

export function AboutView() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-3">
        <div className="max-w-sm rounded-lg bg-white px-3 py-2 ring-1 ring-border/60 dark:bg-white">
          <BrandLockup width={320} priority />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {APP_INFO.name}
          </h1>
          <Badge variant="secondary">v{APP_INFO.version}</Badge>
        </div>
        <p className="text-sm text-muted-foreground md:text-base">
          {APP_INFO.description}
        </p>
      </header>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-xl">Who it’s for</CardTitle>
          <CardDescription>
            For {APP_INFO.audience.toLowerCase()}—including developers, QA, product
            owners, and anyone else on the team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Update a task’s status and remaining hours without digging through classic
              boards.
            </li>
            <li>Add or read comments, and upload or open attachments on your work items.</li>
            <li>
              Filter and open work by project, team, sprint, or assignee—then save changes
              in a side panel.
            </li>
            <li>
              Connect once with your organization and access token. See{' '}
              <Link href="/how-to-use" className="underline-offset-4 hover:underline">
                How to use
              </Link>{' '}
              for setup steps.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-xl">Built with</CardTitle>
          <CardDescription>Core stack for this web client.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-2">
            {APP_INFO.stack.map((item) => (
              <li key={item}>
                <Badge variant="outline">{item}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-xl">Author</CardTitle>
          <CardDescription>Built by {AUTHOR.name}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <nav
            aria-label="Author links"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
          >
            <a
              href={`mailto:${AUTHOR.email}`}
              className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:underline"
            >
              <Mail className="size-4 shrink-0" aria-hidden />
              {AUTHOR.email}
            </a>
            <a
              href={AUTHOR.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:underline"
            >
              <LinkedInIcon className="size-4 shrink-0" />
              LinkedIn
              <ExternalLink className="size-3.5 opacity-70" aria-hidden />
            </a>
            <a
              href={AUTHOR.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:underline"
            >
              <GitHubIcon className="size-4 shrink-0" />
              GitHub
              <ExternalLink className="size-3.5 opacity-70" aria-hidden />
            </a>
          </nav>
          <Button asChild variant="outline" className="touch-target h-11 w-fit gap-2">
            <Link href="/settings">
              <Settings className="size-4" />
              Open Settings
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-xl">Message me</CardTitle>
          <CardDescription>
            Send a note by email from this page. Replies go to the address you provide.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <MessageMeForm />
        </CardContent>
      </Card>
    </div>
  );
}
