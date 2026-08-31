'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { createEvent, slugify } from '@/lib/events';
import { useUserFrames, usePublicFrames } from '@/hooks/useFrames';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDialog } from '@/components/ui/dialog-provider';
import {
  Calendar,
  Sparkles,
  MapPin,
  Lock,
  ArrowLeft,
  Check,
  Palette,
  Layers,
  Wifi,
  Hash,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

const THEME_PRESETS = [
  { label: 'Rose Gold', color: '#e11d48' },
  { label: 'Royal Gold', color: '#d97706' },
  { label: 'Emerald Luxe', color: '#059669' },
  { label: 'Midnight Blue', color: '#2563eb' },
  { label: 'Lavender Dream', color: '#7c3aed' },
  { label: 'Classic Noir', color: '#18181b' },
];

export default function NewEventPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { alert } = useDialog();

  const { data: userFrames = [] } = useUserFrames(user?.uid);
  const { data: publicFrames = [] } = usePublicFrames(true);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugModified, setSlugModified] = useState(false);
  const [brideName, setBrideName] = useState('');
  const [groomName, setGroomName] = useState('');
  const [tagline, setTagline] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [venue, setVenue] = useState('');
  const [themeColor, setThemeColor] = useState('#e11d48');
  const [hashtag, setHashtag] = useState('');

  // Experience Settings
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);
  const [primaryFrameId, setPrimaryFrameId] = useState<string>('');
  const [allowFrameSelection, setAllowFrameSelection] = useState(true);
  const [enableLiveGallery, setEnableLiveGallery] = useState(true);
  const [requirePasscode, setRequirePasscode] = useState('');

  // Wi-Fi
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');

  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </main>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugModified) {
      setSlug(slugify(val));
    }
  };

  const toggleFrameSelection = (frameId: string) => {
    let next: string[];
    if (selectedFrameIds.includes(frameId)) {
      next = selectedFrameIds.filter((id) => id !== frameId);
      if (primaryFrameId === frameId) {
        setPrimaryFrameId(next[0] || '');
      }
    } else {
      next = [...selectedFrameIds, frameId];
      if (!primaryFrameId) {
        setPrimaryFrameId(frameId);
      }
    }
    setSelectedFrameIds(next);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      await alert('Please enter an event name.');
      return;
    }

    setSaving(true);
    try {
      const eventId = await createEvent(user.uid, user.email || '', {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        brideName: brideName.trim(),
        groomName: groomName.trim(),
        tagline: tagline.trim(),
        eventDate,
        venue: venue.trim(),
        themeColor,
        hashtag: hashtag.trim(),
        frameIds: selectedFrameIds,
        primaryFrameId,
        allowFrameSelection,
        enableLiveGallery,
        requirePasscode: requirePasscode.trim(),
        wifiSsid: wifiSsid.trim(),
        wifiPassword: wifiPassword.trim(),
        active: true,
        mode: 'hybrid',
      });

      router.push(`/events/${eventId}/qr`);
    } catch (err: any) {
      console.error(err);
      await alert(err.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const allAvailableFrames = [
    ...userFrames.map((f) => ({ id: `user-${f.id}`, name: f.name || 'Untitled', emoji: f.emoji || '✨', type: 'My Frame' })),
    ...publicFrames.map((f) => ({ id: f.id, name: f.name, emoji: f.emoji || '🎨', type: 'Community' })),
  ];

  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/events" className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Link>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Create New Event</h1>
          <p className="text-sm text-muted-foreground">
            Set up an event with custom frame layouts, branded QR code signage, and a live photo gallery.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Section 1: Basic Event Details */}
          <div className="bg-[var(--surface-2)] p-6 rounded-3xl border border-border space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Event Identity
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Event Name *
                </label>
                <Input
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Sarah & Liam's Wedding 2026"
                  className="bg-background text-sm"
                />
              </div>

              {/* Couple / Wedding names for dynamic frames */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <span>👰 Bride's Name</span>
                  <span className="text-[10px] text-muted-foreground lowercase">(optional for dynamic frames)</span>
                </label>
                <Input
                  value={brideName}
                  onChange={(e) => setBrideName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <span>🤵 Groom's Name</span>
                  <span className="text-[10px] text-muted-foreground lowercase">(optional for dynamic frames)</span>
                </label>
                <Input
                  value={groomName}
                  onChange={(e) => setGroomName(e.target.value)}
                  placeholder="e.g. Liam"
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Event URL Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">/e/</span>
                  <Input
                    value={slug}
                    onChange={(e) => {
                      setSlug(slugify(e.target.value));
                      setSlugModified(true);
                    }}
                    placeholder="sarah-liam-2026"
                    className="bg-background font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tagline / Subtitle (Optional)
                </label>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Celebrating our special day"
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Event Date
                </label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Venue / Location (Optional)
                </label>
                <Input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="The Grand Ballroom, Beverly Hills"
                  className="bg-background text-sm"
                />
              </div>
            </div>

            {/* Theme Color */}
            <div className="space-y-3 pt-2 border-t border-border">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Palette className="w-4 h-4" />
                Theme & Accent Color
              </label>

              <div className="flex flex-wrap items-center gap-3">
                {THEME_PRESETS.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    onClick={() => setThemeColor(p.color)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition ${
                      themeColor === p.color ? 'border-foreground font-semibold scale-105 shadow-sm' : 'border-border opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: p.color }} />
                    <span>{p.label}</span>
                  </button>
                ))}
                <div className="flex items-center gap-2 pl-2">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{themeColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Frame Selection & Locking */}
          <div className="bg-[var(--surface-2)] p-6 rounded-3xl border border-border space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Assigned Event Frames
                </h2>
                <p className="text-xs text-muted-foreground">
                  Select which frame(s) guests can use during this event.
                </p>
              </div>

              <Link
                href="/editor"
                target="_blank"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                + Create new frame in Editor
              </Link>
            </div>

            {allAvailableFrames.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
                No custom frames found. Default public frames will be used.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {allAvailableFrames.map((f) => {
                  const isSelected = selectedFrameIds.includes(f.id);
                  const isPrimary = primaryFrameId === f.id;

                  return (
                    <div
                      key={f.id}
                      onClick={() => toggleFrameSelection(f.id)}
                      className={`relative p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-background hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <span className="text-xl">{f.emoji}</span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-foreground truncate">{f.name}</div>
                      <div className="text-[10px] text-muted-foreground">{f.type}</div>

                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrimaryFrameId(f.id);
                          }}
                          className={`mt-2 w-full py-1 rounded text-[10px] font-medium transition ${
                            isPrimary
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary'
                          }`}
                        >
                          {isPrimary ? '★ Default Frame' : 'Set as Default'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Frame Behavior Toggle */}
            <div className="pt-3 border-t border-border flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground">Allow Frame Selection</div>
                <div className="text-[11px] text-muted-foreground">
                  If disabled, guests immediately start with the default frame locked in (skips frame selector).
                </div>
              </div>
              <input
                type="checkbox"
                checked={allowFrameSelection}
                onChange={(e) => setAllowFrameSelection(e.target.checked)}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Section 3: Experience & Live Gallery Settings */}
          <div className="bg-[var(--surface-2)] p-6 rounded-3xl border border-border space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Gallery & Access Controls
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  Event Hashtag (Optional)
                </label>
                <Input
                  value={hashtag}
                  onChange={(e) => setHashtag(e.target.value)}
                  placeholder="#SarahLiamWedding2026"
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Guest Access PIN (Optional)
                </label>
                <Input
                  value={requirePasscode}
                  onChange={(e) => setRequirePasscode(e.target.value)}
                  placeholder="e.g. 1234 (Leave blank for open public access)"
                  className="bg-background text-sm"
                />
              </div>
            </div>

            {/* Live Gallery Toggle */}
            <div className="pt-3 border-t border-border flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground">Enable Live Photo Wall</div>
                <div className="text-[11px] text-muted-foreground">
                  Creates a real-time digital guestbook & slideshow display at <code>/e/[slug]/gallery</code>.
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableLiveGallery}
                onChange={(e) => setEnableLiveGallery(e.target.checked)}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Section 4: Venue Wi-Fi Credentials (Optional) */}
          <div className="bg-[var(--surface-2)] p-6 rounded-3xl border border-border space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" />
              Venue Wi-Fi (Printed on Standees)
            </h2>
            <p className="text-xs text-muted-foreground">
              Optional credentials to display on printable table tents so guests can connect quickly.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Wi-Fi SSID (Network Name)
                </label>
                <Input
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="Venue-Guest-WiFi"
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Wi-Fi Password
                </label>
                <Input
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="wedding2026"
                  className="bg-background text-sm"
                />
              </div>
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/events')}
              className="rounded-full px-6"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="rounded-full px-8 gap-2 shadow-lg hover:shadow-xl transition-all"
            >
              {saving ? 'Creating Event...' : 'Create & Generate QR Codes →'}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
