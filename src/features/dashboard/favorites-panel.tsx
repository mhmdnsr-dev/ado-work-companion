'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { createElement, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { NAV_ITEMS, type NavItemId } from '@core/constants';
import { loadFavorites, toggleFavorite } from '@core/domain';
import { getNavIcon } from '@/components/layout/nav-icons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { createLocalStorageAdapter } from '@/lib/adapters';
import { cn } from '@/lib/utils';

export function DashboardFavorites() {
  const storage = useMemo(() => createLocalStorageAdapter(), []);
  const [favorites, setFavorites] = useState<NavItemId[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadFavorites(storage);
      if (!cancelled) {
        setFavorites(loaded);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  async function onToggle(id: NavItemId) {
    const next = await toggleFavorite(storage, id);
    setFavorites(next);
    toast.message(next.includes(id) ? 'Added to favorites' : 'Removed from favorites');
  }

  const favoriteItems = NAV_ITEMS.filter((item) => favorites.includes(item.id));

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-lg">Favorites</CardTitle>
        <CardDescription>
          Quick links to the areas you use most. Star any section to pin it here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {!hydrated ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : (
          <>
            {favoriteItems.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {favoriteItems.map((item) => (
                  <li key={item.id}>
                    <Button
                      variant="secondary"
                      className="touch-target h-11 w-full justify-start gap-2"
                      asChild
                    >
                      <Link href={item.href}>
                        {createElement(getNavIcon(item.icon), {
                          className: 'size-4 shrink-0',
                          'aria-hidden': true,
                        })}
                        {item.label}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No favorites yet. Star sections below to pin them.
              </p>
            )}

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                All sections
              </p>
              <ul className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const starred = favorites.includes(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
                    >
                      <Link
                        href={item.href}
                        className="touch-target flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm font-medium"
                      >
                        {createElement(getNavIcon(item.icon), {
                          className: 'size-4 shrink-0',
                          'aria-hidden': true,
                        })}
                        <span className="truncate">{item.label}</span>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="touch-target size-11 shrink-0"
                        aria-label={
                          starred
                            ? `Remove ${item.label} from favorites`
                            : `Add ${item.label} to favorites`
                        }
                        aria-pressed={starred}
                        onClick={() => void onToggle(item.id)}
                      >
                        <Star
                          className={cn('size-4', starred && 'fill-warning text-warning')}
                        />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
