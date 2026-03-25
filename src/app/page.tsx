import HomeClient from '@/components/home/HomeClient';
import { createInitialEvaluationInputFromConfig, getPublishedOpsConfig } from '@/server/config';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const opsConfig = await getPublishedOpsConfig();
  const initialEvaluationInput = createInitialEvaluationInputFromConfig(opsConfig);

  return <HomeClient opsConfig={opsConfig} initialEvaluationInput={initialEvaluationInput} />;
}
