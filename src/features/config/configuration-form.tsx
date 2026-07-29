'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlugZap, RotateCcw, Save, FolderSync } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { ADO_API } from '@core/constants';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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

export function ConfigurationForm() {
  const router = useRouter();
  const {
    hydrated,
    settings,
    pat,
    health,
    projects,
    projectsError,
    projectsLoading,
    saveConfiguration,
    resetConfiguration,
    testConnection,
    loadProjects,
  } = useConnection();

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const form = useForm<AdoConnectionFormValues>({
    resolver: zodResolver(adoConnectionSchema),
    defaultValues: {
      organization: '',
      project: '',
      apiVersion: ADO_API.DEFAULT_VERSION,
      pat: '',
      rememberPat: false,
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (!hydrated) return;
    form.reset({
      organization: settings.organization,
      project: settings.project ?? '',
      apiVersion: settings.apiVersion || ADO_API.DEFAULT_VERSION,
      pat,
      rememberPat: settings.rememberPat,
    });
  }, [hydrated, settings, pat, form]);

  const organization = form.watch('organization');
  const patValue = form.watch('pat');
  const canCallApi = Boolean(organization?.trim() && patValue);

  async function persistCurrentValues(values: AdoConnectionFormValues) {
    await saveConfiguration({
      organization: values.organization,
      project: normalizeOptionalProject(values.project),
      apiVersion: values.apiVersion,
      pat: values.pat,
      rememberPat: values.rememberPat,
    });
  }

  async function onSave(values: AdoConnectionFormValues) {
    setSaving(true);
    try {
      await persistCurrentValues(values);
      toast.success('Configuration saved');

      if (values.organization && values.pat) {
        try {
          setLoadingProjects(true);
          await loadProjects();
        } catch {
          // Manual project entry remains available; error shown via context.
        } finally {
          setLoadingProjects(false);
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save configuration',
      );
    } finally {
      setSaving(false);
    }
  }

  async function onTestConnection() {
    const valid = await form.trigger(['organization', 'pat', 'apiVersion']);
    if (!valid) return;

    const values = form.getValues();
    setTesting(true);
    try {
      await persistCurrentValues(values);
      const result = await testConnection();
      toast.success(`Connected — ${result.projectCount} project(s) available`);
    } catch (error) {
      if (error instanceof AdoClientError) {
        toast.error(error.message, {
          description: error.suggestions[0],
        });
      } else {
        toast.error(error instanceof Error ? error.message : 'Connection test failed');
      }
    } finally {
      setTesting(false);
    }
  }

  async function onLoadProjects() {
    const valid = await form.trigger(['organization', 'pat', 'apiVersion']);
    if (!valid) return;

    const values = form.getValues();
    setLoadingProjects(true);
    try {
      await persistCurrentValues(values);
      const list = await loadProjects();
      toast.success(`Loaded ${list.length} project(s)`);
    } catch (error) {
      if (error instanceof AdoClientError) {
        toast.error(error.message, { description: error.suggestions[0] });
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to load projects');
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
      rememberPat: false,
    });
    toast.message('Configuration reset');
  }

  function onContinue() {
    if (!canCallApi) {
      toast.error('Save organization and PAT before continuing');
      return;
    }
    router.push('/dashboard');
  }

  if (!hydrated) {
    return (
      <Card className="w-full max-w-2xl">
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

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
              Azure DevOps
            </p>
            <CardTitle className="text-2xl">Connect your organization</CardTitle>
          </div>
          {statusBadge(health.status)}
        </div>
        <CardDescription>
          Project is optional. Leave it empty to use organization-scoped APIs. Your PAT is
          never placed in URLs and is only stored locally when Remember PAT is enabled.
        </CardDescription>
        {health.message ? (
          <Alert variant={health.status === 'failed' ? 'destructive' : 'default'}>
            <AlertTitle>Connection status</AlertTitle>
            <AlertDescription>{health.message}</AlertDescription>
          </Alert>
        ) : null}
      </CardHeader>

      <CardContent>
        <form
          id="ado-config-form"
          onSubmit={form.handleSubmit(onSave)}
          className="space-y-6"
        >
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
                    Create a PAT with at least Project (Read) scope. Show, copy, or clear
                    without exposing it in the address bar.
                  </FieldDescription>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              name="rememberPat"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal" className="items-center">
                  <Checkbox
                    id="rememberPat"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    className="size-5"
                  />
                  <div className="min-w-0">
                    <FieldLabel htmlFor="rememberPat" className="font-normal">
                      Remember PAT on this device
                    </FieldLabel>
                    <FieldDescription>
                      Off by default. When enabled, the token is stored in localStorage.
                    </FieldDescription>
                  </div>
                </Field>
              )}
            />

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
                    Searchable list loads after a successful organization + PAT save or
                    connection test. Manual entry always works.
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
                    Default is {ADO_API.DEFAULT_VERSION} (Azure DevOps REST 7.2). Override
                    only when an endpoint requires a preview version.
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
            form="ado-config-form"
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

        <Button
          type="button"
          variant="default"
          className="touch-target h-11 w-full"
          onClick={onContinue}
          disabled={!canCallApi}
        >
          Continue to Dashboard
        </Button>
      </CardFooter>
    </Card>
  );
}
