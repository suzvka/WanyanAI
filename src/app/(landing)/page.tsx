import LandingClient from '@/components/landing/LandingClient';
import { getPlatformConfig } from '@/server/config';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const platformConfig = await getPlatformConfig();

  return <LandingClient appearance={platformConfig.appearance} />;
}
