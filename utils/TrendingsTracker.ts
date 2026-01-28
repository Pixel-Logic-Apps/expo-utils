/**
 * Trendings Tracker SDK para React Native
 *
 * SDK de atribuição que conecta impressões web com instalações de app.
 * Envia dados do device para a API de tracking e faz matching por IP.
 *
 * @example
 * ```typescript
 * import { TrendingsTracker } from 'trendings-tracker';
 *
 * // Inicializa na entrada do app (App.tsx)
 * TrendingsTracker.init({
 *   apiUrl: 'https://seu-dominio.com/api',
 *   appId: 'com.seuapp',
 *   debug: __DEV__,
 * });
 *
 * // Rastreia a instalação/abertura
 * TrendingsTracker.trackInstall();
 * ```
 */

import { Platform, NativeModules } from 'react-native';

interface TrendingsConfig {
  /** URL base da API (ex: https://seu-dominio.com/api) */
  apiUrl: string;
  /** ID do app (bundle ID) */
  appId: string;
  /** Ativa logs de debug */
  debug?: boolean;
  /** Timeout em ms para requisições (padrão: 5000) */
  timeout?: number;
}

interface UserProperties {
  /** ID do usuário no seu sistema (Firebase UID, etc) */
  userId?: string;
  /** Email do usuário (será hasheado antes de enviar) */
  email?: string;
  /** Telefone do usuário (será hasheado antes de enviar) */
  phone?: string;
  /** Propriedades customizadas */
  [key: string]: string | number | boolean | undefined;
}

interface EventProperties {
  /** Valor monetário (para eventos de compra) */
  value?: number;
  /** Moeda (USD, BRL, etc) */
  currency?: string;
  /** ID do produto */
  productId?: string;
  /** Nome do produto */
  productName?: string;
  /** ID da transação */
  transactionId?: string;
  /** Propriedades customizadas */
  [key: string]: string | number | boolean | undefined;
}

interface EventResponse {
  success: boolean;
  event_id?: string;
  error?: string;
}

interface TrackResponse {
  success: boolean;
  matched?: boolean;
  campaign_id?: string;
  time_to_install?: number;
  error?: string;
}

interface DeviceInfo {
  device_id: string;
  device_os: 'ios' | 'android';
  os_version: string;
  device_model: string;
  app_id: string;
  app_version?: string;
  locale: string;
}

class TrendingsTrackerClass {
  private config: TrendingsConfig | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private userProperties: UserProperties = {};
  private hasTracked: boolean = false;

  /**
   * Inicializa o SDK com as configurações
   */
  init(config: TrendingsConfig): void {
    if (!config.apiUrl) {
      console.error('[TrendingsTracker] apiUrl é obrigatório');
      return;
    }

    // Remove barra final se existir
    config.apiUrl = config.apiUrl.replace(/\/$/, '');

    this.config = {
      ...config,
      debug: config.debug ?? false,
      timeout: config.timeout ?? 5000,
    };

    this.deviceInfo = this.collectDeviceInfo();

    this.log('SDK inicializado', this.config);
  }

  /**
   * Rastreia a instalação/abertura do app
   * Envia dados para a API que faz matching com impressões anteriores
   *
   * @returns Promise com resultado do tracking
   */
  async trackInstall(): Promise<TrackResponse> {
    if (!this.config) {
      console.error('[TrendingsTracker] SDK não inicializado. Chame init() primeiro.');
      return { success: false, error: 'SDK not initialized' };
    }

    if (this.hasTracked) {
      this.log('Instalação já rastreada nesta sessão');
      return { success: true, matched: false, error: 'Already tracked this session' };
    }

    try {
      const url = `${this.config.apiUrl}/install.php`;
      const payload = this.deviceInfo;

      this.log('Enviando dados de instalação', { url, payload });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      this.hasTracked = true;

      this.log('Resposta recebida', data);

      return data;
    } catch (error: any) {
      const errorMessage = error.name === 'AbortError' ? 'Request timeout' : error.message;
      this.log('Erro ao rastrear instalação', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Define propriedades do usuário para atribuição
   * Chame este método quando o usuário fizer login ou você tiver mais dados
   *
   * @example
   * ```typescript
   * TrendingsTracker.setUser({
   *   userId: 'firebase-uid-123',
   *   email: 'user@example.com',
   *   isPremium: true,
   * });
   * ```
   */
  setUser(properties: UserProperties): void {
    if (!this.config) {
      console.error('[TrendingsTracker] SDK não inicializado. Chame init() primeiro.');
      return;
    }

    this.userProperties = { ...this.userProperties, ...properties };
    this.log('User properties updated', this.userProperties);
  }

  /**
   * Obtém o userId atual
   */
  getUserId(): string | undefined {
    return this.userProperties.userId;
  }

  /**
   * Envia evento customizado (compra, level up, etc)
   *
   * @example
   * ```typescript
   * // Compra in-app
   * TrendingsTracker.trackEvent('inapp_purchase', {
   *   value: 9.99,
   *   currency: 'USD',
   *   productId: 'premium_monthly',
   *   productName: 'Premium Mensal',
   *   transactionId: 'txn_123',
   * });
   *
   * // Evento customizado
   * TrendingsTracker.trackEvent('level_completed', {
   *   level: 5,
   *   score: 1000,
   * });
   * ```
   */
  async trackEvent(eventName: string, properties?: EventProperties): Promise<EventResponse> {
    if (!this.config) {
      console.error('[TrendingsTracker] SDK não inicializado. Chame init() primeiro.');
      return { success: false, error: 'SDK not initialized' };
    }

    try {
      const url = `${this.config.apiUrl}/event.php`;
      const payload = {
        event_name: eventName,
        timestamp: Date.now(),
        device: this.deviceInfo,
        user: this.userProperties,
        properties: properties || {},
      };

      this.log(`Sending event: ${eventName}`, { url, payload });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      this.log('Event response', data);

      return data;
    } catch (error: any) {
      const errorMessage = error.name === 'AbortError' ? 'Request timeout' : error.message;
      this.log(`Error sending event: ${eventName}`, { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Atalho para evento de compra in-app
   *
   * @example
   * ```typescript
   * TrendingsTracker.trackPurchase({
   *   value: 9.99,
   *   currency: 'USD',
   *   productId: 'premium_monthly',
   *   transactionId: 'txn_123',
   * });
   * ```
   */
  async trackPurchase(properties: EventProperties): Promise<EventResponse> {
    return this.trackEvent('inapp_purchase', properties);
  }

  /**
   * Coleta informações do device
   */
  private collectDeviceInfo(): DeviceInfo {
    const deviceId = this.getDeviceId();

    return {
      device_id: deviceId,
      device_os: Platform.OS as 'ios' | 'android',
      os_version: Platform.Version?.toString() ?? 'unknown',
      device_model: this.getDeviceModel(),
      app_id: this.config?.appId ?? 'unknown',
      app_version: this.getAppVersion(),
      locale: this.getLocale(),
    };
  }

  /**
   * Obtém ID único do device
   * Em produção, use react-native-device-info para um ID mais confiável
   */
  private getDeviceId(): string {
    // Tenta usar DeviceInfo se disponível
    try {
      const DeviceInfo = NativeModules.RNDeviceInfo;
      if (DeviceInfo?.getUniqueId) {
        return DeviceInfo.getUniqueId();
      }
    } catch (e) {
      // Fallback
    }

    // Gera um ID único baseado em timestamp + random
    // NOTA: Em produção, use AsyncStorage para persistir este ID
    return `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtém modelo do device
   */
  private getDeviceModel(): string {
    try {
      const DeviceInfo = NativeModules.RNDeviceInfo;
      if (DeviceInfo?.getModel) {
        return DeviceInfo.getModel();
      }
    } catch (e) {
      // Fallback
    }

    return Platform.OS === 'ios' ? 'iPhone' : 'Android Device';
  }

  /**
   * Obtém versão do app
   */
  private getAppVersion(): string {
    try {
      const DeviceInfo = NativeModules.RNDeviceInfo;
      if (DeviceInfo?.getVersion) {
        return DeviceInfo.getVersion();
      }
    } catch (e) {
      // Fallback
    }

    return '1.0.0';
  }

  /**
   * Obtém locale do device
   */
  private getLocale(): string {
    try {
      const { NativeModules: NM } = require('react-native');

      // iOS
      if (Platform.OS === 'ios') {
        return (
          NM.SettingsManager?.settings?.AppleLocale ||
          NM.SettingsManager?.settings?.AppleLanguages?.[0] ||
          'en'
        );
      }

      // Android
      if (NM.I18nManager?.localeIdentifier) {
        return NM.I18nManager.localeIdentifier;
      }
    } catch (e) {
      // Fallback
    }

    return 'en';
  }

  /**
   * Log de debug
   */
  private log(message: string, data?: any): void {
    if (!this.config?.debug) return;

    const prefix = '[TrendingsTracker]';

    if (data) {
      console.log(prefix, message, JSON.stringify(data, null, 2));
    } else {
      console.log(prefix, message);
    }
  }

  /**
   * Reseta o estado do tracker (útil para testes)
   */
  reset(): void {
    this.hasTracked = false;
    this.log('Tracker resetado');
  }

  /**
   * Verifica se o SDK foi inicializado
   */
  isInitialized(): boolean {
    return this.config !== null;
  }

  /**
   * Retorna as informações do device coletadas
   */
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }
}

// Exporta instância singleton
export const TrendingsTracker = new TrendingsTrackerClass();

// Exporta tipos
export type {
  TrendingsConfig,
  TrackResponse,
  DeviceInfo,
  UserProperties,
  EventProperties,
  EventResponse,
};
