'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useUserEvents } from '@/hooks/useEvents';
import { deleteEvent, type BoothEvent } from '@/lib/events';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog-provider';
import {
  Calendar,
  Plus,
  QrCode,
  Sparkles,
  ExternalLink,
  Trash2,
  Settings,
  Image as ImageIcon,
  Play,
  Share2,
  MapPin,
  Clock,
  Lock,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

export default function EventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { alert, confirm } = useDialog();
  const { data: events = [], mutate: mutateEvents, isLoading } = useUserEvents(user?.uid);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading events...</p>
      </main>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  const handleDelete = async (event: BoothEvent) => {
    const isConfirmed = await confirm(`Are you sure you want to delete "${event.name}"? All event links will stop working.`);
    if (!isConfirmed) return;

    setDeletingId(event.id);
    try {
      await deleteEvent(user.uid, event.id);
      await mutateEvents((prev = []) => prev.filter((e) => e.id !== event.id), { revalidate: false });
    } catch (err: any) {
      console.error(err);
      await alert(err.message || 'Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = events.filter((e) => e.active).length;

  return (
    <main className="min-h-screen bg-background text-foreground pb-16">
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
        {/* Top Hero Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface-2)] p-6 sm:p-8 rounded-3xl border border-border shadow-sm">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold">
                ✨ Event Studio
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {events.length} {events.length === 1 ? 'Event' : 'Events'} Total · {activeCount} Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              Event Frames & QR Generator
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Create branded photobooth experiences for weddings, parties, corporate summits, and brand pop-ups with locked event frames and dynamic QR codes.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => router.push('/events/new')}
              className="gap-2 px-5 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event</span>
            </Button>
          </div>
        </div>

        {/* Events Grid / Empty State */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading your events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 px-4 border border-dashed border-border rounded-3xl bg-[var(--surface-1)] space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto text-2xl">
              🎪
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="text-lg font-bold">No Events Created Yet</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Set up a custom event with dedicated frames, generate printable QR table tents, and let guests scan to snap or view live photos!
              </p>
            </div>
            <Button onClick={() => router.push('/events/new')} className="gap-2 rounded-full px-6">
              <Plus className="w-4 h-4" />
              Create Your First Event
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((evt) => {
              const eventUrl = typeof window !== 'undefined' ? `${window.location.origin}/e/${evt.slug}` : `/e/${evt.slug}`;
              const galleryUrl = typeof window !== 'undefined' ? `${window.location.origin}/e/${evt.slug}/gallery` : `/e/${evt.slug}/gallery`;

              return (
                <div
                  key={evt.id}
                  className="group flex flex-col justify-between bg-[var(--surface-2)] border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all hover:shadow-lg"
                >
                  <div className="p-5 space-y-4">
                    {/* Header: Title & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                            {evt.name}
                          </h3>
                          {evt.requirePasscode && (
                            <span title="PIN Protected" className="text-muted-foreground">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        {evt.tagline && (
                          <p className="text-xs text-muted-foreground line-clamp-1 italic">
                            &quot;{evt.tagline}&quot;
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          evt.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {evt.active ? 'Active' : 'Archived'}
                      </span>
                    </div>

                    {/* Metadata chips */}
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                        <span>{evt.eventDate || 'No date set'}</span>
                      </div>
                      {evt.venue && (
                        <div className="flex items-center gap-2 truncate">
                          <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                          <span className="truncate">{evt.venue}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono opacity-80">/e/{evt.slug}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="p-4 bg-[var(--surface-1)] border-t border-border space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => router.push(`/e/${evt.slug}`)}
                        className="w-full gap-1.5 text-xs rounded-xl"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Launch Booth
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/events/${evt.id}/qr`)}
                        className="w-full gap-1.5 text-xs rounded-xl hover:border-primary/50"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        QR & Signage
                      </Button>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-1">
                        {evt.enableLiveGallery && (
                          <Link
                            href={`/e/${evt.slug}/gallery`}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded-md hover:bg-muted transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Live Wall
                          </Link>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push(`/events/${evt.id}`)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                          title="Edit Event"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(evt)}
                          disabled={deletingId === evt.id}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
