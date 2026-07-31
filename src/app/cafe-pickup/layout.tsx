import type { Metadata } from 'next';
export const metadata: Metadata = { title: '카페 수령대' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
