/*
 * Copyright © 2023 Anonyome Labs, Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConfigurationNotSetError,
  DefaultConfigurationManager,
} from '@sudoplatform/sudo-common'
import { SudoUserClient } from '@sudoplatform/sudo-user'
import { ApolloCache } from 'apollo-cache'
import {
  InMemoryCache,
  IntrospectionFragmentMatcher,
  IntrospectionResultData,
  NormalizedCacheObject,
} from 'apollo-cache-inmemory'
import { ApolloLink } from 'apollo-link'
import { AUTH_TYPE, AWSAppSyncClient } from 'aws-appsync'
import * as t from 'io-ts'
import { SudoUserClientNotSetError } from './error'

/**
 * Config required to set up an Api Client Manager
 */
// eslint-disable-next-line tree-shaking/no-side-effects-in-initialization
export const ApiClientConfig = t.type({
  region: t.string,
  apiUrl: t.string,
})
export type ApiClientConfig = t.TypeOf<typeof ApiClientConfig>

/**
 * Options which control how and where to connect to the AWSAppSync client
 */
export type ClientOptions = {
  disableOffline?: boolean
  link?: ApolloLink
  // Override the default cache to support configuring the type of fragment
  // matcher. This allows support of fragments with union and interface types.
  cache?: ApolloCache<NormalizedCacheObject>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage?: any
  // Override the default appsync location configuration with that of a
  // specific service endpoint by specifying that service's config namespace.
  configNamespace?: string
}

/**
 * Manages one or more GraphQL client instances that may be shared by multiple service clients,
 * depending on their configuration.
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
   * Create and fetch a new AWSAppSync client.
   *
   * @param options ClientOptions for configuring AWSAppSyncClient connection and location
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

const defaultConfigNamespace = 'apiService'
/**
 * Singleton to manage a GraphQL client instance that may be shared by multiple service clients.
 */
export class DefaultApiClientManager implements ApiClientManager {
  private static instance: DefaultApiClientManager

  private _authClient: SudoUserClient | undefined
  private _defaultConfig: ApiClientConfig | undefined
  private _namespacedClients: Record<
    string,
    AWSAppSyncClient<NormalizedCacheObject>
  > = {}

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
      // Invalidate any existing clients since we have a new auth client
      this._namespacedClients = {}
    }

    return DefaultApiClientManager.instance
  }

  public setConfig(config: ApiClientConfig): DefaultApiClientManager {
    this._defaultConfig = config

    return DefaultApiClientManager.instance
  }

  public unsetConfig(): void {
    this._defaultConfig = undefined
  }

  public getClient(
    options?: ClientOptions,
  ): AWSAppSyncClient<NormalizedCacheObject> {
    let configNamespace = options?.configNamespace ?? defaultConfigNamespace

    const config = this.getConfigForNamespace(configNamespace)

    if (!config) {
      throw new ConfigurationNotSetError()
    }

    if (this.matchesDefaultConfig(config)) {
      configNamespace = defaultConfigNamespace
    }

    if (!this._authClient) {
      throw new SudoUserClientNotSetError()
    }

    let client = this._namespacedClients[configNamespace]
    if (!client) {
      const authClient = this._authClient

      let cache = options?.cache
      if (!cache) {
        /*
         * By default, add an InMemory cache with
         * a fragment matcher with empty types array.
         * This allows union types and types derived
         * from interfaces to be disambiguated in most
         * cases. In particular we rely on this in
         * the virtual cards SDK.
         */
        const id: IntrospectionResultData = {
          __schema: {
            types: [],
          },
        }
        const fragmentMatcher = new IntrospectionFragmentMatcher({
          introspectionQueryResultData: id,
        })
        cache = new InMemoryCache({ fragmentMatcher })
      }

      client = new AWSAppSyncClient(
        {
          url: config.apiUrl,
          region: config.region,
          auth: {
            type: AUTH_TYPE.AMAZON_COGNITO_USER_POOLS,
            jwtToken: async () => {
              try {
                return await authClient.getLatestAuthToken()
              } catch {
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
          cache,
        },
      )
      this._namespacedClients[configNamespace] = client
    }

    return client
  }

  public async reset(): Promise<void> {
    const promises = Object.values(this._namespacedClients).map(
      async (v): Promise<void> => {
        await v.resetStore()
      },
    )
    await Promise.all(promises)
  }

  private getConfigForNamespace(
    configNamespace: string,
  ): ApiClientConfig | undefined {
    return this.isDefaultConfigNamespace(configNamespace)
      ? this.getDefaultConfig()
      : this.createConfigForNamespace(configNamespace)
  }

  private isDefaultConfigNamespace(configNamespace: string): boolean {
    return configNamespace === defaultConfigNamespace
  }

  private getDefaultConfig(): ApiClientConfig | undefined {
    this._defaultConfig ??= this.createConfigForNamespace(
      defaultConfigNamespace,
    )

    return this._defaultConfig
  }

  private createConfigForNamespace(
    configNamespace: string,
  ): ApiClientConfig | undefined {
    return DefaultConfigurationManager.getInstance().bindConfigSet<ApiClientConfig>(
      ApiClientConfig,
      configNamespace,
    )
  }

  private matchesDefaultConfig(config: ApiClientConfig): boolean {
    if (!this._defaultConfig) {
      return false
    }
    return (
      config.apiUrl === this._defaultConfig.apiUrl &&
      config.region === this._defaultConfig.region
    )
  }
}
