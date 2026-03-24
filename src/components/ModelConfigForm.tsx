'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Globe, 
  Key, 
  Database,
  ArrowRight,
  Save,
  RefreshCw
} from 'lucide-react';
import { ModelConfig, ModelInfo } from '@/types/modelConfig';
import { modelConfigService } from '@/services/modelConfig';

interface ModelConfigFormProps {
  onConfigSaved: (config: ModelConfig) => void;
  initialConfig?: ModelConfig | null;
}

type Step = 'input' | 'select-model' | 'test' | 'success';

export default function ModelConfigForm({ onConfigSaved, initialConfig }: ModelConfigFormProps) {
  const [step, setStep] = useState<Step>('input');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState('');

  // 初始化时如果有已有配置，加载它
  useEffect(() => {
    if (initialConfig) {
      setBaseUrl(initialConfig.baseUrl);
      setApiKey(initialConfig.apiKey);
      setSelectedModel(initialConfig.selectedModel);
    }
  }, [initialConfig]);

  // 步骤1: 验证连接并获取模型列表
  const handleValidate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await modelConfigService.validateAndFetchModels(baseUrl, apiKey);
      
      if (result.success && result.models) {
        setModels(result.models);
        setStep('select-model');
      } else {
        setError(result.error || '验证失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证过程出错');
    } finally {
      setIsLoading(false);
    }
  };

  // 步骤2: 选择模型后测试连接
  const handleTestModel = async () => {
    const modelToTest = selectedModel || customModel;
    if (!modelToTest) {
      setError('请选择或输入模型');
      return;
    }

    setStep('test');
    setIsLoading(true);
    setError(null);

    try {
      const result = await modelConfigService.testModelConnection(
        baseUrl, 
        apiKey, 
        modelToTest
      );

      if (result.success) {
        setStep('success');
      } else {
        setError(result.error || '模型连接测试失败');
        setStep('select-model');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试过程出错');
      setStep('select-model');
    } finally {
      setIsLoading(false);
    }
  };

  // 步骤3: 保存配置
  const handleSaveConfig = () => {
    const modelToSave = selectedModel || customModel;
    const config: ModelConfig = {
      baseUrl,
      apiKey,
      selectedModel: modelToSave
    };

    try {
      modelConfigService.saveConfig(config);
      onConfigSaved(config);
    } catch (err) {
      setError('保存配置失败');
    }
  };

  // 重置到第一步
  const resetToInput = () => {
    setStep('input');
    setError(null);
  };

  // 重新验证
  const revalidate = () => {
    setStep('input');
    setError(null);
    setSelectedModel('');
    setCustomModel('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle>模型配置</CardTitle>
              <CardDescription>配置浏览器本地直连模型 API 所需的信息</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 步骤指示器 */}
          <div className="flex items-center justify-between">
            {[
              { step: 'input', label: '输入配置', icon: Globe },
              { step: 'select-model', label: '选择模型', icon: Database },
              { step: 'test', label: '测试连接', icon: RefreshCw },
              { step: 'success', label: '完成', icon: CheckCircle2 }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = step === item.step;
              const isPast = ['select-model', 'test', 'success'].includes(step) && 
                (item.step === 'input' || 
                 (item.step === 'select-model' && ['test', 'success'].includes(step)) ||
                 (item.step === 'test' && step === 'success'));
              
              return (
                <div key={item.step} className="flex flex-col items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2
                    ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 
                      isPast ? 'bg-green-600 border-green-600 text-white' : 
                      'bg-slate-100 border-slate-300 text-slate-400'}
                  `}>
                    {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs mt-1 ${isActive || isPast ? 'text-slate-700' : 'text-slate-400'}`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>错误</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 步骤1: 输入配置 */}
          {step === 'input' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Base URL
                </Label>
                <Input
                  id="baseUrl"
                  placeholder="https://api.openai.com/v1"
                  value={baseUrl}
                  onChange={(e: { target: { value: string } }) => setBaseUrl(e.target.value)}
                />
                <p className="text-sm text-slate-500">
                  支持OpenAI兼容格式的API地址
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API Key
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e: { target: { value: string } }) => setApiKey(e.target.value)}
                />
                <p className="text-sm text-slate-500">
                  您的 API Key 仅保存在当前浏览器本地，不会发送到本项目服务端
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={handleValidate}
                disabled={isLoading || !baseUrl || !apiKey}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    正在验证...
                  </>
                ) : (
                  <>
                    下一步
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* 步骤2: 选择模型 */}
          {step === 'select-model' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  连接成功
                </Badge>
                <Button variant="ghost" size="sm" onClick={revalidate}>
                  重新配置
                </Button>
              </div>

              <div className="space-y-2">
                <Label>选择模型</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择一个模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model: ModelInfo) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">或者</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customModel">自定义模型名称</Label>
                <Input
                  id="customModel"
                  placeholder="输入模型名称"
                  value={customModel}
                  onChange={(e: { target: { value: string } }) => {
                    setCustomModel(e.target.value);
                    if (e.target.value) setSelectedModel('');
                  }}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleTestModel}
                disabled={isLoading || (!selectedModel && !customModel)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    正在测试...
                  </>
                ) : (
                  <>
                    测试模型连接
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* 步骤3: 测试中 */}
          {step === 'test' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold">正在测试模型连接...</h3>
                <p className="text-slate-500">请稍候</p>
              </div>
            </div>
          )}

          {/* 步骤4: 成功 */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-green-700 mb-2">配置验证成功！</h3>
                <p className="text-slate-600">浏览器已可直接调用模型接口，可以开始使用了</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Base URL:</span>
                    <p className="font-medium truncate">{baseUrl}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">模型:</span>
                    <p className="font-medium">{selectedModel || customModel}</p>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleSaveConfig}
              >
                <Save className="w-4 h-4 mr-2" />
                保存配置并继续
              </Button>
            </div>
          )}
        </CardContent>

        {step !== 'success' && step !== 'test' && (
          <CardFooter className="flex justify-between">
            {step === 'select-model' && (
              <Button variant="ghost" onClick={resetToInput}>
                返回
              </Button>
            )}
            {step === 'input' && initialConfig && (
              <Button variant="ghost" onClick={() => onConfigSaved(initialConfig)}>
                使用已有配置
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
