import { BrandMark } from '@/components/Brand';

export default function NotFound() {
  return (
    <main className="wrap" style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
        <BrandMark size={44} />
        <h1 className="page-title">Page not found</h1>
        <p className="muted">That stack, component or page does not exist.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn" href="/">Home</a>
          <a className="btn btn-primary" href="/build">Build a stack</a>
        </div>
      </div>
    </main>
  );
}
