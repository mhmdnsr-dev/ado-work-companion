'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  ExternalLink,
  KeyRound,
  ListTodo,
  Radar,
  Settings,
  Sparkles,
} from 'lucide-react';

import { APP_INFO } from '@core/constants';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const GITHUB_URL = 'https://github.com/mhmdnsr-dev/azure-devOps-work-item-management';

const FEATURES = [
  {
    title: 'Connect once',
    body: 'Enter your organization, optional project, and access token. The token is saved on this device so you do not have to paste it every visit.',
  },
  {
    title: 'Work Items (main job)',
    body: 'Find your tasks, update status and remaining hours, add or read comments, and open attachments—all from a list and side panel.',
  },
  {
    title: 'Queries & comments',
    body: 'Run your saved Azure DevOps searches and follow discussions without jumping around in classic boards.',
  },
  {
    title: 'Projects, files & estimate',
    body: 'Pick your project in Settings, manage attachments on each work item, and run a planning poker estimate session (or open the Azure DevOps Estimate hub).',
  },
  {
    title: 'Dashboard',
    body: 'See connection status, pin favorite pages, and track sprint progress when available.',
  },
] as const;

const WORK_ITEM_STEPS = [
  'Choose a project first (in Settings or with the project picker). Work Items needs a project.',
  'Open Work Items from the side menu.',
  'Narrow the list by type, open or closed, team, sprint, assignee, or search text.',
  'Click a card to open the side panel: title, status, assignee, remaining hours, description, links, comments, and attachments.',
  'Update status or hours, leave a comment, then Save. Use New to create an item when you need one.',
] as const;

const PAT_PERMISSIONS = [
  'Work Items — Read & write (list, create, update, comments, files)',
  'Project and Team — Read (projects, teams, people, sprints)',
  'Analytics — Read (optional; helps with sprint charts)',
] as const;

export function HowToUseView() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">How to use</h1>
          <Badge variant="secondary">v{APP_INFO.version}</Badge>
        </div>
        <p className="text-sm text-muted-foreground md:text-base">
          {APP_INFO.shortName} is for {APP_INFO.audience.toLowerCase()}—including
          developers, QA, product owners, and anyone else on the team. Connect once, then
          update status and hours, comment, and attach files without living in classic
          boards.
        </p>
        <Button asChild className="touch-target h-11 w-fit">
          <Link href="/configure">
            <KeyRound className="size-4" />
            Go to Configure
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="size-5" aria-hidden />
            What you can do
          </CardTitle>
          <CardDescription>Focus on daily task work first; the rest supports it.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="space-y-1">
                <p className="text-sm font-medium text-foreground">{feature.title}</p>
                <p className="text-sm text-muted-foreground">{feature.body}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="size-5" aria-hidden />
            Get an access token
          </CardTitle>
          <CardDescription>
            Azure DevOps calls this a Personal Access Token (PAT). Treat it like a password —
            it lets this app work as you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Sign in at{' '}
              <a
                className="font-medium text-foreground underline-offset-4 hover:underline"
                href="https://dev.azure.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                dev.azure.com
              </a>
              .
            </li>
            <li>
              Click your profile picture (top right) →{' '}
              <span className="font-medium text-foreground">Personal access tokens</span>.
            </li>
            <li>
              Click <span className="font-medium text-foreground">New Token</span>, give it a
              clear name (for example “{APP_INFO.shortName}”), pick an expiry date, and set
              the permissions below.
            </li>
            <li>
              Create the token, <span className="font-medium text-foreground">copy it once</span>
              , then paste it on the Configure page here. Azure DevOps will not show the full
              token again.
            </li>
          </ol>

          <div className="space-y-2">
            <p className="font-medium text-foreground">Permissions to enable</p>
            <ul className="list-disc space-y-1.5 pl-5">
              {PAT_PERMISSIONS.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
          </div>

          <Alert>
            <AlertTitle>Keep your token safe</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                This app keeps your token on this device only. You choose how long to remember
                it. It is never shown in the address bar.
              </p>
              <p>
                On a shared computer, prefer a shorter remember time, and use{' '}
                <span className="font-medium text-foreground">Reset</span> on Configure when you
                finish.
              </p>
            </AlertDescription>
          </Alert>

          <p>
            Microsoft’s guide:{' '}
            <a
              className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
              href="https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate"
              target="_blank"
              rel="noopener noreferrer"
            >
              Personal access tokens
              <ExternalLink className="size-3.5 opacity-70" />
            </a>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Settings className="size-5" aria-hidden />
            Connect the app
          </CardTitle>
          <CardDescription>
            Your organization name is the part after{' '}
            <span className="font-mono text-xs">dev.azure.com/</span> in your Azure DevOps URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open Configure and enter your organization name.</li>
            <li>Paste your access token (later you can leave it blank to keep the saved one).</li>
            <li>
              Choose how long this device should remember the token (14 days is the default).
            </li>
            <li>Optionally pick a project, then Save and Test Connection.</li>
            <li>Continue to the dashboard when you are connected.</li>
          </ol>

          <figure className="overflow-hidden rounded-xl border bg-muted/20">
            <Image
              src="/docs/configure-screen.png"
              alt="Configure screen with organization, access token, remember duration, and optional project"
              width={1200}
              height={1600}
              className="h-auto w-full"
              priority={false}
            />
            <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
              Configure — organization, access token, remember duration, optional project.
            </figcaption>
          </figure>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <ListTodo className="size-5" aria-hidden />
            Work Items
          </CardTitle>
          <CardDescription>
            Where you update status, hours, comments, and files once a project is selected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            {WORK_ITEM_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <p className="font-medium text-foreground">On each list card</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>ID, type, status, priority, remaining hours</li>
              <li>Title, assignee, last updated time, tags</li>
            </ul>
            <p className="pt-2 font-medium text-foreground">In the side panel</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Change status, remaining hours, and other main fields</li>
              <li>Read and add comments</li>
              <li>Manage links to related work</li>
              <li>Save changes when your permissions allow</li>
            </ul>
          </div>

          <Alert>
            <BookOpen className="size-4" />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>
              After you connect, open{' '}
              <Link
                href="/work-items"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Work Items
              </Link>{' '}
              to try the list and side panel with your real project.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Radar className="size-5" aria-hidden />
            Quick tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Settings holds appearance, install, connection, and project selection. About
              explains who the app is for.
            </li>
            <li>
              Use Estimate for a lightweight planning poker session, or open the Azure DevOps
              Estimate hub for a live multiplayer room.
            </li>
            <li>
              On phones, use Chrome’s menu → Install app / Add to Home screen if the in-app
              button is missing.
            </li>
            <li>
              Source code:{' '}
              <a
                className="font-medium text-foreground underline-offset-4 hover:underline"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
