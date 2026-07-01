'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { isAdmin } from '@/hooks/useAdmin';
import {
  listPendingRequests,
  approvePublishRequest,
  rejectPublishRequest,
  type PublishRequest,
} from '@/lib/publish-requests';
import { Button } from '@/components/ui/button';
import { useTheme, ThemeToggle } from '@/hooks/useTheme';
import { Globe, Check, X, Loader2 } from 'lucide-react';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { useDialog } from '@/components/ui/dialog-provider';

export default function AdminReviewsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { settings, isLoaded } = useStudioSettings();
  const { alert, confirm } = useDialog();

  useEffect(() => {
    if (isLoaded && settings) {
      document.title = `Admin Reviews — ${settings.studioName}`;
    }
  }, [isLoaded, settings]);

  const isUserAdmin = !loading && user && isAdmin(user.email);

  const [requests, setRequests] = useState<PublishRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isUserAdmin) {
      router.replace('/');
      return;
    }
    
    setRequestsLoading(true);
    listPendingRequests()
      .then(setRequests)
      .catch(console.error)
      .finally(() => setRequestsLoading(false));
  }, [user, loading, isUserAdmin, router]);

  const handleApprove = async (id: string) => {
    const isConfirmed = await confirm('Approve this frame to be published to the community?');
    if (!isConfirmed) return;
    setProcessingId(id);
    try {
      await approvePublishRequest(id);
      setRequests(prev => prev.filter(req => req.id !== id));
    } catch (e) {
      console.error(e);
      await alert('Failed to approve request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const isConfirmed = await confirm('Reject this frame publish request?');
    if (!isConfirmed) return;
    setProcessingId(id);
    try {
      await rejectPublishRequest(id);
      setRequests(prev => prev.filter(req => req.id !== id));
    } catch (e) {
      console.error(e);
      await alert('Failed to reject request.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || !isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </main>
    );
  }

  if (!user || !isUserAdmin) return null;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <div className="flex items-center justify-center bg-primary rounded w-7 h-7">
              <span className="text-sm">🛡️</span>
            </div>
            <h1 className="font-serif font-bold text-sm text-foreground m-0">Admin Reviews</h1>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-12">
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-bold text-lg text-foreground">Pending Community Publish Requests</h2>
            </div>
          </div>

          {requestsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground">No pending requests</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map((req) => (
                <div key={req.id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{req.frame.emoji || '✨'}</span>
                          <h3 className="font-medium text-sm text-foreground truncate">{req.frame.name || 'Untitled'}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          By: {req.user.displayName || 'Anonymous'} ({req.user.uid})
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {req.frame.config?.elements?.filter(e => e.type === 'photo').length || 0} photos
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        onClick={() => handleApprove(req.id)}
                        disabled={processingId === req.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                        Approve
                      </Button>
                      <Button 
                        onClick={() => handleReject(req.id)}
                        disabled={processingId === req.id}
                        variant="outline"
                        className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
                      >
                        {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
