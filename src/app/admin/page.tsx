'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ---- Types ----

interface StationInfo {
  id: string;
  name: string;
  hasCredentialConfig: boolean;
  hasModelToggle: boolean;
  credentialSchema: CredentialField[];
  credentials: CredentialField[];
  modelToggles: ModelToggleInfo[];
}

interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'group';
  required: boolean;
  description?: string;
  value?: string;
  children?: CredentialField[];
}

interface ModelToggleInfo {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

// ---- Login Page ----

function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '验证失败');
        return;
      }

      onLogin(token);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Admin 管理控制台</CardTitle>
          <CardDescription>请输入访问令牌以继续</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">访问令牌</Label>
              <Input
                id="token"
                type="password"
                placeholder="输入 Admin Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoFocus
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>验证失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading || !token.trim()}>
              {loading ? '验证中...' : '进入管理'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Credential Editor ----

function CredentialEditor({ station }: { station: StationInfo }) {
  const [credentials, setCredentials] = useState<CredentialField[]>(station.credentials);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const addModel = () => {
    const modelId = prompt('请输入新模型标识（如 deepseek-chat）：');
    if (!modelId || modelId.trim() === '') return;

    const id = modelId.trim();
    if (credentials.some((c) => c.key === id)) {
      alert(`模型 "${id}" 已存在，请勿重复添加`);
      return;
    }

    setCredentials((prev) => [
      ...prev,
      {
        key: id,
        label: modelId.trim(),
        type: 'group',
        required: false,
        // schema 中的 id 字段是模型标识（即本条目的 key），不作为子字段渲染
        children: station.credentialSchema
          .filter((s) => s.key !== 'id')
          .map((s) => ({
            key: s.key,
            label: s.label,
            type: s.type,
            required: s.required,
            value: '',
          })),
      },
    ]);
  };

  const removeModel = (index: number) => {
    if (!confirm(`确定移除模型 "${credentials[index].key}" 的配置？`)) return;
    setCredentials((prev) => prev.filter((_, i) => i !== index));
  };

  const updateChildValue = (modelIndex: number, childKey: string, value: string) => {
    setCredentials((prev) => {
      const updated = [...prev];
      const children = [...(updated[modelIndex].children || [])];
      const childIndex = children.findIndex((c) => c.key === childKey);
      if (childIndex >= 0) {
        children[childIndex] = { ...children[childIndex], value };
        updated[modelIndex] = { ...updated[modelIndex], children };
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/v1/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: station.id,
          credentials,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '保存失败' });
        return;
      }

      setMessage({ type: 'success', text: '配置已保存，将立即生效' });
    } catch {
      setMessage({ type: 'error', text: '网络错误，请重试' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">凭证配置</h3>
        <Button variant="outline" size="sm" onClick={addModel}>
          + 添加模型
        </Button>
      </div>

      {credentials.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          暂无模型配置，点击上方按钮添加
        </div>
      )}

      <div className="space-y-4">
        {credentials.map((cred, idx) => (
          <Card key={cred.key}>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">{cred.key}</CardTitle>
              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeModel(idx)}>
                删除
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(cred.children || []).map((child) => (
                <div key={child.key} className="space-y-1">
                  <Label className="text-xs">
                    {child.label}
                    {child.required && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    type={child.type === 'password' ? 'password' : 'text'}
                    placeholder={child.label}
                    value={child.value ?? ''}
                    onChange={(e) => updateChildValue(idx, child.key, e.target.value)}
                  />
                  {child.description && (
                    <p className="text-xs text-muted-foreground">{child.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {message && (
        <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
          <AlertTitle>{message.type === 'success' ? '成功' : '失败'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {credentials.length > 0 && (
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? '保存中...' : '保存配置'}
        </Button>
      )}
    </div>
  );
}

// ---- Model Toggle Panel ----

function ModelTogglePanel({ station }: { station: StationInfo }) {
  const [toggles, setToggles] = useState<ModelToggleInfo[]>(station.modelToggles);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggleModel = async (modelId: string, enabled: boolean) => {
    setSaving(true);
    setMessage(null);

    // 乐观更新
    setToggles((prev) => prev.map((t) => (t.id === modelId ? { ...t, enabled } : t)));

    try {
      const res = await fetch('/api/v1/admin/toggles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: station.id, modelId, enabled }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '更新失败' });
        // 回滚
        setToggles((prev) => prev.map((t) => (t.id === modelId ? { ...t, enabled: !enabled } : t)));
        return;
      }

      setMessage({ type: 'success', text: `模型 ${enabled ? '已启用' : '已禁用'}` });
    } catch {
      setMessage({ type: 'error', text: '网络错误，请重试' });
      setToggles((prev) => prev.map((t) => (t.id === modelId ? { ...t, enabled: !enabled } : t)));
    } finally {
      setSaving(false);
    }
  };

  if (toggles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        无可管理的模型
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {toggles.map((model) => (
          <Card key={model.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex-1">
                <p className="font-medium">{model.name}</p>
                <p className="text-xs text-muted-foreground">{model.id}</p>
                {model.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{model.description}</p>
                )}
              </div>
              <Switch
                checked={model.enabled}
                onCheckedChange={(checked) => toggleModel(model.id, checked)}
                disabled={saving}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {message && (
        <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
          <AlertTitle>{message.type === 'success' ? '成功' : '失败'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ---- Station Panel ----

function StationPanel({ station }: { station: StationInfo }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">{station.name}</h2>
        <Badge variant="outline">{station.id}</Badge>
      </div>

      <Tabs defaultValue={station.hasCredentialConfig ? 'credentials' : 'toggles'} className="w-full">
        <TabsList>
          {station.hasCredentialConfig && <TabsTrigger value="credentials">凭证配置</TabsTrigger>}
          {station.hasModelToggle && <TabsTrigger value="toggles">模型启停</TabsTrigger>}
        </TabsList>
        {station.hasCredentialConfig && (
          <TabsContent value="credentials">
            <CredentialEditor station={station} />
          </TabsContent>
        )}
        {station.hasModelToggle && (
          <TabsContent value="toggles">
            <ModelTogglePanel station={station} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ---- Main Admin Page ----

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [stations, setStations] = useState<StationInfo[]>([]);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const activeStationIdRef = useRef(activeStationId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 同步 ref 与 state
  useEffect(() => {
    activeStationIdRef.current = activeStationId;
  }, [activeStationId]);

  // 认证通过后加载中转站列表
  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;

    async function fetchStations() {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/v1/admin/stations');
        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 401) {
            setAuthenticated(false);
            return;
          }
          const data = await res.json();
          setError(data.error || '加载失败');
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setStations(data.stations);
        if (data.stations.length > 0 && !activeStationIdRef.current) {
          setActiveStationId(data.stations[0].id);
        }
      } catch {
        if (!cancelled) setError('网络错误，请重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStations();

    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const handleLogin = (token: string) => {
    setAuthenticated(true);
  };

  const handleLogout = async () => {
    setAuthenticated(false);
    setStations([]);
    setActiveStationId(null);
  };

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const activeStation = stations.find((s) => s.id === activeStationId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">Admin 管理控制台</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            退出
          </Button>
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Station selector */}
        {stations.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto">
            {stations.map((s) => (
              <Button
                key={s.id}
                variant={activeStationId === s.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveStationId(s.id)}
              >
                {s.name}
              </Button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && stations.length === 0 && !error && (
          <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
            没有可管理的子站
          </div>
        )}

        {!loading && activeStation && <StationPanel station={activeStation} />}
      </div>
    </div>
  );
}