'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { FolderSync, Loader2, PlugZap, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  ADO_API,
  APP_INFO,
  DEFAULT_PAT_COOKIE_LIFETIME,
  isPatCookieLifetime,
  PAT_COOKIE_LIFETIME_OPTIONS,
  type PatCookieLifetime,
} from '@core/constants';
import {
  adoConnectionSchema,
  normalizeOptionalProject,
  type AdoConnectionFormValues,
} from '@core/schemas';
import { AdoClientError } from '@core/types';
import { useConnection } from '@/components/providers';
import { PatInput } from '@/components/shared/pat-input';
import { ProjectCombobox } from '@/components/shared/project-combobox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

function statusBadge(status: string) {
  switch (status) {
    case 'connected':
      return <Badge className="bg-success text-success-foreground">Connected</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'unconfigured':
      return <Badge variant="secondary">Not configured</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

function resolvePatCookieLifetime(value: unknown): PatCookieLifetime {
  return isPatCookieLifetime(value) ? value : DEFAULT_PAT_COOKIE_LIFETIME;
}

function ConfigurationFormSkeleton({ isSettings }: { isSettings: boolean }) {
  return (
    <Card className={isSettings ? 'w-full' : 'w-full max-w-2xl'}>
      <CardHeader>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  );
}

export function ConfigurationForm({
  mode = 'setup',
}: {
  /** `setup` is the /configure gate; `settings` embeds the same form in-app. */
  mode?: 'setup' | 'settings';
}) {
  const { hydrated } = useConnection();
  const isSettings = mode === 'settings';

  // Mount the form only after settings hydrate so org/project/lifetime autofill
  // from localStorage on first paint (same as a saved configure session).
  if (!hydrated) {
    return <ConfigurationFormSkeleton isSettings={isSettings} />;
  }

  return <ConfigurationFormLoaded mode={mode} />;
}

function ConfigurationFormLoaded({
  mode,
}: {
  mode: 'setup' | 'settings';
}) {
  const router = useRouter();
  const {
    settings,
    health,
    projects,
    projectsError,
    projectsLoading,
    isConfigured,
    hasServerPat,
    saveConfiguration,
    resetConfiguration,
    testConnection,
    loadProjects,
  } = useConnection();

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const formId = mode === 'settings' ? 'ado-settings-config-form' : 'ado-config-form';
  const isSettings = mode === 'settings';

  const form = useForm<AdoConnectionFormValues>({
    resolver: zodResolver(adoConnectionSchema),
    defaultValues: {
      organization: settings.organization,
      project: settings.project ?? '',
      apiVersion: settings.apiVersion || ADO_API.DEFAULT_VERSION,
      pat: '',
      patCookieLifetime: resolvePatCookieLifetime(settings.patCookieLifetime),
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    form.reset({
      organization: settings.organization,
      project: settings.project ?? '',
      apiVersion: settings.apiVersion || ADO_API.DEFAULT_VERSION,
      pat: '',
      patCookieLifetime: resolvePatCookieLifetime(settings.patCookieLifetime),
    });
  }, [
    form,
    settings.organization,
    settings.project,
    settings.apiVersion,
    settings.patCookieLifetime,
  ]);

  const organization = form.watch('organization');
  const patValue = form.watch('pat');
  const patCookieLifetime = form.watch('patCookieLifetime');
  const canCallApi = Boolean(organization?.trim() && (patValue || hasServerPat));

  function toLiveCredentials(values: AdoConnectionFormValues) {
    return {
      organization: values.organization,
      project: normalizeOptionalProject(values.project),
      apiVersion: values.apiVersion,
      pat: values.pat,
      patCookieLifetime: values.patCookieLifetime,
    };
  }

  async function ensurePatPresent(values: AdoConnectionFormValues): Promise<boolean> {
    if (values.pat.trim() || hasServerPat) return true;
    form.setError('pat', {
      type: 'manual',
      message: 'A personal access token is required',
    });
    toast.error('Please enter your personal access token to continue');
    return false;
  }

  async function onSave(values: AdoConnectionFormValues) {
    if (!(await ensurePatPresent(values))) return;

    setSaving(true);
    try {
      await saveConfiguration(toLiveCredentials(values));
      form.setValue('pat', '');
      toast.success('Connection settings saved');

      if (values.organization) {
        try {
          setLoadingProjects(true);
          await loadProjects(toLiveCredentials({ ...values, pat: values.pat }));
        } catch {
          // Manual project entry remains available.
        } finally {
          setLoadingProjects(false);
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save your settings. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onTestConnection() {
    const valid = await form.trigger(['organization', 'apiVersion']);
    if (!valid) return;

    const values = form.getValues();
    if (!(await ensurePatPresent(values))) return;

    setTesting(true);
    try {
      const result = await testConnection(toLiveCredentials(values));
      form.setValue('pat', '');
      toast.success(
        result.projectCount === 1
          ? 'Connected — 1 project found'
          : `Connected — ${result.projectCount} projects found`,
      );
    } catch (error) {
      if (error instanceof AdoClientError) {
        toast.error(error.message, {
          description: error.suggestions[0],
        });
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not reach Azure DevOps. Please try again.',
        );
      }
    } finally {
      setTesting(false);
    }
  }

  async function onLoadProjects() {
    const valid = await form.trigger(['organization', 'apiVersion']);
    if (!valid) return;

    const values = form.getValues();
    if (!(await ensurePatPresent(values))) return;

    setLoadingProjects(true);
    try {
      const list = await loadProjects(toLiveCredentials(values));
      form.setValue('pat', '');
      toast.success(
        list.length === 1 ? 'Loaded 1 project' : `Loaded ${list.length} projects`,
      );
    } catch (error) {
      if (error instanceof AdoClientError) {
        toast.error(error.message, { description: error.suggestions[0] });
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not load projects. Please try again.',
        );
      }
    } finally {
      setLoadingProjects(false);
    }
  }

  async function onReset() {
    await resetConfiguration();
    form.reset({
      organization: '',
      project: '',
      apiVersion: ADO_API.DEFAULT_VERSION,
      pat: '',
      patCookieLifetime: DEFAULT_PAT_COOKIE_LIFETIME,
    });
    toast.message('Connection settings cleared');
    if (isSettings) {
      router.push('/configure');
    }
  }

  function onContinue() {
    if (!isConfigured && !canCallApi) {
      toast.error('Save your organization and access token before continuing');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <Card className={isSettings ? 'w-full' : 'w-full max-w-2xl'}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {!isSettings ? (
              <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
                {APP_INFO.shortName}
              </p>
            ) : null}
            <CardTitle className={isSettings ? 'text-xl' : 'text-2xl'}>
              {isSettings
                ? 'Connection'
                : isConfigured
                  ? 'Update your connection'
                  : 'Connect so you can work on your tasks'}
            </CardTitle>
          </div>
          {statusBadge(health.status)}
        </div>
        <CardDescription>
          {isSettings
            ? 'Organization, project, and access token for this device. Leave the token blank to keep the one already saved.'
            : 'Enter your Azure DevOps organization and access token to get started. Project is optional. Your token stays on this device and is never placed in the address bar.'}{' '}
          <Link
            href="/how-to-use"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            How to use guide
          </Link>
        </CardDescription>
        {hasServerPat ? (
          <Alert>
            <AlertTitle>Token already saved</AlertTitle>
            <AlertDescription>
              You can leave the token field empty to keep your current token, or enter a
              new one to replace it.
            </AlertDescription>
          </Alert>
        ) : null}
        {!isSettings ? (
          <Alert>
            <AlertTitle>Need a fresh start?</AlertTitle>
            <AlertDescription>
              Reset clears your saved connection settings and access token from this
              device. You can set them up again anytime on this page.
            </AlertDescription>
          </Alert>
        ) : null}
        {health.message ? (
          <Alert variant={health.status === 'failed' ? 'destructive' : 'default'}>
            <AlertTitle>Connection status</AlertTitle>
            <AlertDescription>{health.message}</AlertDescription>
          </Alert>
        ) : null}
      </CardHeader>

      <CardContent>
        <form id={formId} onSubmit={form.handleSubmit(onSave)} className="space-y-6">
          <FieldGroup>
            <Controller
              name="organization"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="organization">Organization</FieldLabel>
                  <Input
                    {...field}
                    id="organization"
                    placeholder="contoso"
                    autoComplete="organization"
                    aria-invalid={fieldState.invalid}
                    className="touch-target h-11"
                  />
                  <FieldDescription>
                    {`The name in https://dev.azure.com/{organization}`}
                  </FieldDescription>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              name="pat"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="pat">Personal Access Token</FieldLabel>
                  <PatInput
                    id="pat"
                    value={field.value}
                    onChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription id="pat-hint">
                    {hasServerPat
                      ? 'Leave blank to keep your saved token, or enter a new one to replace it.'
                      : 'Required. Create a token in Azure DevOps with at least Project (Read) access.'}
                  </FieldDescription>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              name="patCookieLifetime"
              control={form.control}
              render={({ field }) => {
                const lifetime = resolvePatCookieLifetime(field.value);
                return (
                  <Field>
                    <FieldLabel htmlFor="patCookieLifetime">
                      Remember token on this device
                    </FieldLabel>
                    <Select value={lifetime} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="patCookieLifetime"
                        className="touch-target h-11 w-full max-w-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAT_COOKIE_LIFETIME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Controls how long this app keeps the encrypted token cookie — not the
                      expiry date of the PAT in Azure DevOps.
                    </FieldDescription>
                  </Field>
                );
              }}
            />

            {patCookieLifetime === 'forever' ? (
              <Alert>
                <AlertTitle>Long-lived device session</AlertTitle>
                <AlertDescription>
                  Forever keeps the token cookie on this browser for as long as the
                  browser allows (often about a year). Prefer a shorter window on shared
                  machines, and use Reset when you are done.
                </AlertDescription>
              </Alert>
            ) : null}

            <Separator />

            <Controller
              name="project"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="project-combobox">Project (optional)</FieldLabel>
                  <ProjectCombobox
                    id="project-combobox"
                    value={field.value}
                    onChange={field.onChange}
                    projects={projects}
                    loading={projectsLoading || loadingProjects}
                    error={projectsError}
                    onRefresh={() => void onLoadProjects()}
                    disabled={!canCallApi && projects.length === 0}
                    allowManualEntry
                  />
                  <FieldDescription>
                    Choose a project after connecting, or type a name manually. Leave
                    empty to use organization-wide APIs.
                  </FieldDescription>
                </Field>
              )}
            />

            <Controller
              name="apiVersion"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="apiVersion">API Version</FieldLabel>
                  <Input
                    {...field}
                    id="apiVersion"
                    placeholder={ADO_API.DEFAULT_VERSION}
                    aria-invalid={fieldState.invalid}
                    className="touch-target h-11 font-mono"
                  />
                  <FieldDescription>
                    Defaults to {ADO_API.DEFAULT_VERSION}. Change this only if a specific
                    API needs a different version.
                  </FieldDescription>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 sm:items-stretch">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="submit"
            form={formId}
            className="touch-target h-11"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="touch-target h-11"
            onClick={() => void onTestConnection()}
            disabled={testing || !canCallApi}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlugZap className="size-4" />
            )}
            Test Connection
          </Button>
          <Button
            type="button"
            variant="outline"
            className="touch-target h-11"
            onClick={() => void onLoadProjects()}
            disabled={loadingProjects || !canCallApi}
          >
            {loadingProjects ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FolderSync className="size-4" />
            )}
            Load Projects
          </Button>
          <Button
            type="button"
            variant="outline"
            className="touch-target h-11"
            onClick={() => void onReset()}
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>

        {!isSettings ? (
          <Button
            type="button"
            variant="default"
            className="touch-target h-11 w-full"
            onClick={onContinue}
            disabled={!isConfigured && !canCallApi}
          >
            {isConfigured ? 'Back to Dashboard' : 'Continue to Dashboard'}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
