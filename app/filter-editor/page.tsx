'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FilterEditor from '@/components/FilterEditor';
import { loadUserFilter, createUserFilter, updateUserFilter } from '@/lib/user-filters';
import { useAuth } from '@/hooks/useAuth';
import { FilterPreset } from '@/lib/edit-types';

function FilterEditorPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');

  const [initialConfig, setInitialConfig] = useState<FilterPreset | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadUserFilter(id).then(existing => {
        if (existing) setInitialConfig(existing);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleSave = async (config: FilterPreset) => {
    if (!user) {
      alert("Must be logged in to save custom filters.");
      return;
    }
    
    // If it's a new filter (we determine if `id` was in URL)
    if (id) {
      await updateUserFilter(user.uid, id, config);
    } else {
      await createUserFilter(user.uid, config);
    }
    router.push('/filters');
  };

  const handleCancel = () => {
    router.push('/filters');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading editor...</div>;
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="flex-shrink-0 h-16 border-b border-border px-6 flex items-center justify-between bg-surface-0">
        <h1 className="font-display font-bold text-lg">Filter Studio</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <FilterEditor 
          initialConfig={initialConfig}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </main>
  );
}

export default function FilterEditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <FilterEditorPageContent />
    </Suspense>
  );
}
