export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background" style={{ padding: '64px 24px', background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto" style={{ background: 'var(--surface-1)', padding: 32, borderRadius: 12, border: '0.5px solid var(--border)' }}>
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Terms of Service</h1>
        <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-lg font-semibold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>1. Acceptance of Terms</h2>
          <p>By accessing and using this photobooth application, you accept and agree to be bound by the terms and provision of this agreement.</p>
          
          <h2 className="text-lg font-semibold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>2. User Content</h2>
          <p>You retain all rights to the photos you take using our service. All photo processing, including background removal, happens locally on your device. We do not collect, store, or transmit your photos to any external servers.</p>
          
          <h2 className="text-lg font-semibold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>3. Acceptable Use</h2>
          <p>You agree not to use the service for any unlawful purpose or in any way that could damage, disable, overburden, or impair our servers or networks.</p>
          
          <h2 className="text-lg font-semibold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>4. Modifications</h2>
          <p>We reserve the right to modify these terms at any time. We will always post the most current version on our site. By continuing to use the service after changes become effective, you agree to be bound by the revised terms.</p>
        </div>
      </div>
    </main>
  );
}
