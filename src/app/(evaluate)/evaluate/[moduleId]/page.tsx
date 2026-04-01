import { notFound } from 'next/navigation';
import EvaluateClient from '@/components/evaluate/EvaluateClient';
import { getPlatformConfig } from '@/server/config';
import { getModuleById, getAllModules } from '@/server/modules';
import { createInitialEvaluationInputFromModule } from '@/config/defaults';

export const dynamic = 'force-dynamic';

interface EvaluatePageProps {
  params: Promise<{
    moduleId: string;
  }>;
}

export default async function EvaluatePage({ params }: EvaluatePageProps) {
  const { moduleId } = await params;
  const platformConfig = await getPlatformConfig();
  const moduleConfig = await getModuleById(moduleId);
  const modules = await getAllModules();

  if (!moduleConfig) {
    notFound();
  }

  const initialEvaluationInput = createInitialEvaluationInputFromModule(moduleConfig);

  return (
    <EvaluateClient
      platformConfig={platformConfig}
      moduleConfig={moduleConfig}
      modules={modules}
      initialEvaluationInput={initialEvaluationInput}
    />
  );
}
