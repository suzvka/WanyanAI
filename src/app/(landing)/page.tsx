import LandingClient from '@/components/landing/LandingClient';
import { getPlatformConfig } from '@/server/config';
import { getAllModules } from '@/server/modules';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const platformConfig = await getPlatformConfig();
  const modules = await getAllModules();

  return <LandingClient platformConfig={platformConfig} modules={modules} />;
}
