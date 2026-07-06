export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background" style={{ padding: '64px 24px', background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto" style={{ background: 'var(--surface-1)', padding: 32, borderRadius: 12, border: '0.5px solid var(--border)' }}>
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Privacy Policy</h1>
        <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <h2 className="text-lg font-semibold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>1. Information We Collect</h2>
          <p>We collect basic account information when you create an account. Unless you press the upload button, we do not collect, upload, or store your photos. All photos taken using our application are temporary and remain solely on your device. If you choose to upload them, they are securely saved with encryption to our storage.</p>

          <h2 className="text-lg font-semibold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>2. How We Use Information</h2>
          <p>Account information is used solely to provide and maintain our services. All photo processing (including background removal) happens completely locally on your device via a downloaded AI model, meaning your images are never sent to our servers.</p>

          <h2 className="text-lg font-semibold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>3. Information Sharing</h2>
          <p>We do not share your data or photos with third parties. Since background removal happens entirely on your local device, no images are ever transmitted to any external APIs or third-party services.</p>

          <h2 className="text-lg font-semibold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>4. Data Security</h2>
          <p>We implement appropriate technical and organizational measures designed to protect the security of any personal information we process. However, please note that we cannot guarantee the internet itself is 100% secure.</p>
        </div>
      </div>
    </main>
  );
}
