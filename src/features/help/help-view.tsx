'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, House, KeyRound, Loader2, Mail, Send } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { APP_INFO, AUTHOR } from '@core/constants';
import { contactMessageSchema, type ContactMessageFormValues } from '@core/schemas';
import { BrandLockup } from '@/components/brand';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ContactApiError, sendContactMessage } from '@/lib/contact-api';

const PAT_PERMISSIONS = [
  'Work Items — Read & write',
  'Project and Team — Read',
  'Analytics — Read (optional, for sprint charts)',
] as const;

function ContactForm() {
  const form = useForm<ContactMessageFormValues>({
    resolver: zodResolver(contactMessageSchema),
    defaultValues: { replyEmail: '', subject: '', message: '', company: '' },
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
      aria-label="Contact the author"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <FieldGroup>
        <Field data-invalid={Boolean(errors.replyEmail) || undefined}>
          <FieldLabel htmlFor="help-message-email">Your email</FieldLabel>
          <Input
            id="help-message-email"
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
          <FieldLabel htmlFor="help-message-subject">Subject</FieldLabel>
          <Input
            id="help-message-subject"
            placeholder="What do you need help with?"
            className="touch-target h-11"
            autoComplete="off"
            aria-invalid={Boolean(errors.subject) || undefined}
            disabled={isSubmitting}
            {...register('subject')}
          />
          <FieldError errors={[errors.subject]} />
        </Field>
        <Field data-invalid={Boolean(errors.message) || undefined}>
          <FieldLabel htmlFor="help-message-body">Message</FieldLabel>
          <Textarea
            id="help-message-body"
            rows={4}
            placeholder="Describe your question or issue."
            aria-invalid={Boolean(errors.message) || undefined}
            disabled={isSubmitting}
            {...register('message')}
          />
          <FieldError errors={[errors.message]} />
        </Field>
      </FieldGroup>

      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor="help-message-company">Company</label>
        <Input
          id="help-message-company"
          tabIndex={-1}
          autoComplete="off"
          {...register('company')}
        />
      </div>

      <Button type="submit" className="touch-target h-11 gap-2" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Send className="size-4" aria-hidden />
        )}
        {isSubmitting ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  );
}

export function HelpView() {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <header className="space-y-4 pb-10">
        <div className="max-w-sm rounded-lg bg-white px-3 py-2 ring-1 ring-border/60">
          <BrandLockup width={320} priority />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Help & About</h1>
          <Badge variant="secondary">v{APP_INFO.version}</Badge>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          Connect Azure DevOps, find your work, and update it without living in classic
          boards.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="touch-target h-11 gap-2">
            <Link href="/">
              <House className="size-4" aria-hidden />
              Home
            </Link>
          </Button>
          <Button asChild className="touch-target h-11 gap-2">
            <Link href="/settings">
              <KeyRound className="size-4" aria-hidden />
              Open Settings
            </Link>
          </Button>
        </div>
      </header>

      <nav
        aria-label="Help sections"
        className="-mx-4 flex scrollbar-thin gap-2 overflow-x-auto border-y border-border px-4 py-3 md:mx-0 md:flex-wrap md:border-x-0 md:px-0"
      >
        {[
          ['connect-heading', 'Connect'],
          ['workflow-heading', 'Workflow'],
          ['install-heading', 'Install'],
          ['about-heading', 'About'],
          ['contact-heading', 'Contact'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="touch-target inline-flex shrink-0 items-center rounded-md border border-border px-3 text-sm font-medium active:bg-muted"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="divide-y divide-border">
        <section className="space-y-4 py-8" aria-labelledby="connect-heading">
          <h2 id="connect-heading" className="text-xl font-semibold">
            Connect Azure DevOps
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Create a Personal Access Token in Azure DevOps.</li>
            <li>Open Settings and enter your organization and token.</li>
            <li>Choose a project, save, and test the connection.</li>
          </ol>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Recommended token permissions</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {PAT_PERMISSIONS.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
          </div>
          <Alert>
            <AlertTitle>Keep your token private</AlertTitle>
            <AlertDescription>
              Treat it like a password. Use a shorter remember period on shared devices
              and reset the connection when you finish.
            </AlertDescription>
          </Alert>
          <a
            href="https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            Microsoft PAT guide
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </section>

        <section className="space-y-4 py-8" aria-labelledby="workflow-heading">
          <h2 id="workflow-heading" className="text-xl font-semibold">
            Daily workflow
          </h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-medium">Dashboard</dt>
              <dd className="mt-1 text-muted-foreground">
                Review sprint progress and jump back into active work.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Work Items</dt>
              <dd className="mt-1 text-muted-foreground">
                Filter tasks, bugs, and stories. Open an item to update fields, read or
                add comments, and manage attachments.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Queries</dt>
              <dd className="mt-1 text-muted-foreground">
                Browse and run saved Azure DevOps queries for the selected project.
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-4 py-8" aria-labelledby="install-heading">
          <h2 id="install-heading" className="text-xl font-semibold">
            Install the app
          </h2>
          <p className="text-sm text-muted-foreground">
            Supported browsers show an install action in Settings. On iPhone, open the
            site in Safari, use Share, then choose Add to Home Screen and Open as Web App.
          </p>
        </section>

        <section className="space-y-4 py-8" aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-xl font-semibold">
            About
          </h2>
          <p className="text-sm text-muted-foreground">
            {APP_INFO.name} is built by {AUTHOR.name} for anyone managing daily work in
            Azure DevOps.
          </p>
          <nav
            aria-label="Author links"
            className="flex flex-wrap gap-x-4 gap-y-2 text-sm"
          >
            <a
              href={`mailto:${AUTHOR.email}`}
              className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
            >
              <Mail className="size-4" aria-hidden />
              Email
            </a>
            <a
              href={AUTHOR.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
            >
              GitHub
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <a
              href={AUTHOR.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
            >
              LinkedIn
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </nav>
        </section>

        <section className="space-y-4 py-8" aria-labelledby="contact-heading">
          <div className="space-y-1">
            <h2 id="contact-heading" className="text-xl font-semibold">
              Contact
            </h2>
            <p className="text-sm text-muted-foreground">
              Send a question or report a problem. Replies go to your email.
            </p>
          </div>
          <ContactForm />
        </section>
      </div>
    </article>
  );
}
