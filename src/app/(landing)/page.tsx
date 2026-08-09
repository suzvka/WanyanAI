import LandingClient from '@/components/landing/LandingClient';
import { getPlatformConfig } from '@/server/config';
import { getPageModulePublicEntries } from '@/server/modules';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const platformConfig = await getPlatformConfig();
  const modules = await getPageModulePublicEntries();

  return <LandingClient appearance={platformConfig.appearance} modules={modules} />;
}
