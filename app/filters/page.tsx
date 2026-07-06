'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/hooks/useAdmin';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Plus, Pencil, Trash2, Globe, Sliders } from 'lucide-react';
import { listUserFilters, deleteUserFilter } from '@/lib/user-filters';
import { listPublicFilters, deletePublicFilter, updateAnyPublicFilter } from '@/lib/public-filters';
import { requestFilterPublish } from '@/lib/publish-requests';
import type { FilterPreset } from '@/lib/edit-types';
import type { PublicFilter } from '@/lib/public-filters';
import { useDialog } from '@/components/ui/dialog-provider';

export default function FiltersDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { confirm, alert } = useDialog();

  const [userFilters, setUserFilters] = useState<FilterPreset[]>([]);
  const [publicFilters, setPublicFilters] = useState<PublicFilter[]>([]);
  
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const isUserAdmin = isAdmin(user?.email);

  useEffect(() => {
    if (user) {
      listUserFilters(user.uid).then(setUserFilters);
    } else {
      setUserFilters([]);
    }
    
    if (isUserAdmin) {
      listPublicFilters()
        .then(setPublicFilters)
        .finally(() => setLoadingPublic(false));
    }
  }, [user, isUserAdmin]);

  const handleCreateNew = () => {
    router.push('/filter-editor');
  };

  const handleEditFilter = (id: string) => {
    router.push(`/filter-editor?id=${id}`);
  };

  const handleDeleteUserFilter = async (id: string) => {
    const ok = await confirm('Are you sure you want to delete this custom filter?');
    if (!ok) return;
    await deleteUserFilter(user?.uid || '', id);
    if (user) {
      listUserFilters(user.uid).then(setUserFilters);
    }
  };

  const handlePublishFilter = async (filter: FilterPreset) => {
    if (!user) {
      await alert('Please sign in to publish filters.');
      return;
    }
    setPublishingId(filter.id);
    try {
      await requestFilterPublish(
        filter.id,
        { uid: user.uid, displayName: user.displayName || 'Anonymous' },
        filter
      );
      await alert('Your filter has been submitted for review!');
    } catch (err) {
      console.error(err);
      await alert('Failed to submit filter for review. Please try again.');
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeletePublicFilter = async (id: string) => {
    const ok = await confirm('Are you sure you want to delete this public filter?');
    if (!ok) return;
    await deletePublicFilter(user?.email || '', id);
    setPublicFilters(publicFilters.filter(f => f.id !== id));
  };

  return (
    <main className="min-h-screen bg-background">
      <Header 
        rightContent={
          <Button onClick={handleCreateNew} className={`flex items-center gap-1.5 ${isMobile ? 'px-2 py-1 text-xs' : ''}`}>
            <Plus className={isMobile ? 'w-3 h-3' : 'w-3 h-3'} />
            {!isMobile && 'New Filter'}
          </Button>
        }
      />

      <div className={`max-w-6xl mx-auto space-y-12 ${isMobile ? 'px-3 py-4' : 'px-6 py-8'}`}>
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-bold text-lg text-foreground">My Custom Filters</h2>
            </div>
          </div>
          
          {userFilters.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-3">No custom filters yet</p>
              <Button onClick={handleCreateNew} variant="outline" size="sm">
                <Plus className="w-3 h-3 mr-1" />
                Create Your First Filter
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userFilters.map((f) => (
                <div key={f.id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{f.emoji || '✨'}</span>
                          <h3 className="font-medium text-sm text-foreground truncate">{f.name || 'Untitled'}</h3>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePublishFilter(f)}
                        disabled={publishingId === f.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs transition"
                        style={{ 
                          background: publishingId === f.id ? 'var(--text-muted)' : 'var(--brand)',
                          color: '#fff',
                        }}
                      >
                        <Globe className="w-3 h-3" />
                        {publishingId === f.id ? '...' : 'Submit'}
                      </button>
                      <button
                        onClick={() => handleEditFilter(f.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs border border-border hover:bg-accent transition"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUserFilter(f.id)}
                        className="flex items-center justify-center p-1.5 rounded hover:bg-destructive/10 transition"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {isUserAdmin && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-bold text-lg text-foreground">Community Filters</h2>
              </div>
            </div>

            {loadingPublic ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : publicFilters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No community filters yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicFilters.map((f) => (
                  <div key={f.id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{f.emoji}</span>
                            <h3 className="font-medium text-sm text-foreground truncate">{f.name || 'Untitled'}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeletePublicFilter(f.id)}
                            className="p-1 rounded hover:bg-destructive/10 transition"
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>{f.active ? '✓ Active' : '⏸ Hidden'}</p>
                        {f.ownerName && <p className="mt-1">By: {f.ownerName}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
