import ModulesClient from '@/components/landing/ModulesClient';
import { getPlatformConfig } from '@/server/config';
import { getPageModulePublicEntries } from '@/server/modules';

export const dynamic = 'force-dynamic';

export default async function ModulesPage() {
  const platformConfig = await getPlatformConfig();
  const modules = await getPageModulePublicEntries();

  return <ModulesClient platformConfig={platformConfig} modules={modules} />;
}
