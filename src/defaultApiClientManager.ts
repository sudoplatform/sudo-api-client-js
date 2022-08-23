import { DefaultConfigurationManager } from '@sudoplatform/sudo-common'
import { SudoUserClient } from '@sudoplatform/sudo-user'
import { NormalizedCacheObject } from 'apollo-cache-inmemory'
import { ApolloLink } from 'apollo-link'
import { AUTH_TYPE, AWSAppSyncClient } from 'aws-appsync'
import * as t from 'io-ts'
import { SudoUserClientNotSetError } from './error'

/**
 * Config required to setup an Api Client Manager
 */
// eslint-disable-next-line tree-shaking/no-side-effects-in-initialization
export const ApiClientConfig = t.type({
  region: t.string,
  apiUrl: t.string,
})
export type ApiClientConfig = t.TypeOf<typeof ApiClientConfig>

/**
 * AWSAppSync client options
 */
export type ClientOptions = {
  disableOffline?: boolean
  link?: ApolloLink
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage?: any
}

/**
 * Manages a singleton GraphQL client instance that may be shared by multiple service clients.
 */
export interface ApiClientManager {
  /**
   * Set an auth client that contains a jwtToken refresh method called getLatestAuthToken() of type
   *  `string | (() => string | Promise<string>)`
   *
   * @param authClient
   *
   * @returns Instance of this client manager
   */
  setAuthClient(authClient: SudoUserClient): ApiClientManager

  /**
   * Set configuration needed for Api Client
   *
   * @param config ApiClientConfig
   *
   * @returns Instance of this client manager
   */
  setConfig(config: ApiClientConfig): ApiClientManager

  /**
   * Used for unit testing scenarios.
   * This will remove any config already set
   */
  unsetConfig(): void

  /**
   * Create and fetch a new AWSAppSync client
   *
   * @param options ClientOptions for configuring AWSAppSyncClient
   *
   * @returns AWSAppSyncClient<NormalizedCacheObject>
   *
   * @throws ConfigurationNotSetError
   * @throws {@link SudoUserClientNotSetError}
   */
  getClient(options?: ClientOptions): AWSAppSyncClient<NormalizedCacheObject>

  /**
   * Clears caches on the client
   */
  reset(): Promise<void>
}

/**
 * Singleton to manage a GraphQL client instance that may be shared by multiple service clients.
 */
export class DefaultApiClientManager implements ApiClientManager {
  private static instance: DefaultApiClientManager

  private _client: AWSAppSyncClient<NormalizedCacheObject> | undefined
  private _authClient: SudoUserClient | undefined
  private _config: ApiClientConfig | undefined

  private constructor() {
    // Do nothing.
  }

  public static getInstance(): DefaultApiClientManager {
    if (!DefaultApiClientManager.instance) {
      DefaultApiClientManager.instance = new DefaultApiClientManager()
    }

    return DefaultApiClientManager.instance
  }

  public setAuthClient(authClient: SudoUserClient): DefaultApiClientManager {
    if (authClient !== this._authClient) {
      this._authClient = authClient
      // Invalidate any existing client since we have a new auth client
      this._client = undefined
    }

    return DefaultApiClientManager.instance
  }

  public setConfig(config: ApiClientConfig): DefaultApiClientManager {
    this._config = config

    return DefaultApiClientManager.instance
  }

  public unsetConfig(): void {
    this._config = undefined
  }

  public getClient(
    options?: ClientOptions,
  ): AWSAppSyncClient<NormalizedCacheObject> {
    if (!this._config) {
      const config =
        DefaultConfigurationManager.getInstance().bindConfigSet<ApiClientConfig>(
          ApiClientConfig,
          'apiService',
        )

      this._config = config
    }

    if (!this._authClient) {
      throw new SudoUserClientNotSetError()
    }

    if (!this._client) {
      const authClient = this._authClient

      this._client = new AWSAppSyncClient(
        {
          url: this._config.apiUrl,
          region: this._config.region,
          auth: {
            type: AUTH_TYPE.AMAZON_COGNITO_USER_POOLS,
            jwtToken: async () => {
              try {
                return await authClient.getLatestAuthToken()
              } catch (error) {
                // Return empty string so the graphql request can fail and the error can be processed by the caller.
                // This is a workaround for AWSAppSyncClient not handling rejected promise if getLatestAuthToken fails.
                return ''
              }
            },
          },
          disableOffline: options?.disableOffline ?? false,
          offlineConfig: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            storage: options?.storage,
          },
        },
        {
          link: options?.link,
        },
      )
    }

    return this._client
  }

  public async reset(): Promise<void> {
    await this._client?.resetStore()
  }
}
