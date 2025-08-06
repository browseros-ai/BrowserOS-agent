/**
 * Re-export BrowserOS types as the primary configuration format
 * 
 * The new BrowserOS provider configuration is now the primary format.
 * Legacy LLMSettings types have been removed in favor of the unified
 * BrowserOSProvider structure.
 */
export { 
  BrowserOSProvider,
  BrowserOSProvidersConfig,
  BrowserOSProviderType,
  BrowserOSProviderSchema,
  BrowserOSProvidersConfigSchema,
  BrowserOSPrefObject,
  BrowserOSPrefObjectSchema,
  ProviderCapabilitiesSchema,
  ModelConfigSchema,
  BROWSEROS_PREFERENCE_KEYS
} from './browserOSTypes' 