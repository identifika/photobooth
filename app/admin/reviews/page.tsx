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
    const isConfirmed = await confirm('Approve this and publish it to the community?');
    if (!isConfirmed) return;
    setProcessingId(id);
    try {
      await approvePublishRequest(user?.email || '', id);
      setRequests(prev => prev.filter(req => req.id !== id));
    } catch (e) {
      console.error(e);
      await alert('Failed to approve request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const isConfirmed = await confirm('Reject this publish request?');
    if (!isConfirmed) return;
    setProcessingId(id);
    try {
      await rejectPublishRequest(user?.email || '', id);
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

  const frameRequests = requests.filter(r => !r.type || r.type === 'frame');
  const filterRequests = requests.filter(r => r.type === 'filter');
  const bgRequests = requests.filter(r => r.type === 'background');

  const RequestCard = ({ req }: { req: PublishRequest }) => {
    const isFrame = !req.type || req.type === 'frame';
    const isFilter = req.type === 'filter';
    const isBg = req.type === 'background';
    
    let name = 'Untitled';
    let emoji = '✨';
    let detail = '';
    
    if (isFrame) {
      name = req.frame?.name || 'Untitled';
      emoji = req.frame?.emoji || '✨';
      detail = `${req.frame?.config?.elements?.filter(e => e.type === 'photo').length || 0} photos`;
    } else if (isFilter) {
      name = req.filter?.name || 'Untitled';
      emoji = req.filter?.emoji || '✨';
      detail = `Filter by ${req.user.displayName || 'Anonymous'}`;
    } else if (isBg) {
      name = req.background?.name || 'Untitled';
      emoji = '🖼️';
      detail = `Background by ${req.user.displayName || 'Anonymous'}`;
    }

    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
        {isBg && req.background?.src && (
          <div 
            className="w-full h-32 bg-gray-100 border-b border-border"
            style={req.background.type === 'gradient' ? { background: req.background.src } : {}}
          >
            {req.background.type !== 'gradient' && (
              <img src={req.background.src} className="w-full h-full object-cover" alt="Background preview" />
            )}
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            {!isBg && (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ background: 'var(--surface-1)', border: '0.5px solid var(--border)' }}>
                {emoji}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ background: isFrame ? 'var(--brand)' : isFilter ? 'var(--bg-accent)' : '#10b981', color: '#fff', fontSize: 9 }}>
                  {isFrame ? 'Frame' : isFilter ? 'Filter' : 'Background'}
                </span>
              </div>
              <h3 className="font-medium text-sm text-foreground truncate">{name}</h3>
              <p className="text-xs text-muted-foreground truncate">
                By: {req.user.displayName || 'Anonymous'}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{detail}</p>
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
    );
  };

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

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">

        {requestsLoading ? (
          <p className="text-sm text-muted-foreground">Loading pending requests...</p>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <Globe className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No pending requests — all clear!</p>
          </div>
        ) : (
          <>
            {/* Frame Requests */}
            {frameRequests.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <h2 className="font-bold text-lg text-foreground">
                    Frame Requests
                    <span className="ml-2 text-sm font-normal text-muted-foreground">({frameRequests.length})</span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {frameRequests.map((req) => <RequestCard key={req.id} req={req} />)}
                </div>
              </section>
            )}

            {/* Filter Requests */}
            {filterRequests.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <h2 className="font-bold text-lg text-foreground">
                    Filter Requests
                    <span className="ml-2 text-sm font-normal text-muted-foreground">({filterRequests.length})</span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterRequests.map((req) => <RequestCard key={req.id} req={req} />)}
                </div>
              </section>
            )}

            {/* Background Requests */}
            {bgRequests.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <h2 className="font-bold text-lg text-foreground">
                    Background Requests
                    <span className="ml-2 text-sm font-normal text-muted-foreground">({bgRequests.length})</span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bgRequests.map((req) => <RequestCard key={req.id} req={req} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
