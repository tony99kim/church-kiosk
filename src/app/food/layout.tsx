import type { Metadata } from 'next';
export const metadata: Metadata = { title: '음식 준비대' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
