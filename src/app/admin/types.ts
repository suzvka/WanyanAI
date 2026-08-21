// ---- Admin 控制台共享类型 ----

export interface StationInfo {
  id: string;
  name: string;
  hasCredentialConfig: boolean;
  hasModelToggle: boolean;
  credentialSchema: CredentialField[];
  credentials: CredentialField[];
  modelToggles: ModelToggleInfo[];
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'group';
  required: boolean;
  description?: string;
  value?: string;
  children?: CredentialField[];
}

export interface ModelToggleInfo {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}
