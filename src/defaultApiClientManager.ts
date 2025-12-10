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
import { internal } from '@sudoplatform/sudo-user'
import * as t from 'io-ts'
import { SudoUserClientNotSetError } from './error'
import { GraphQLClient } from '@sudoplatform/sudo-user'

/**
 * Config required to set up an Api Client Manager
 */
export interface ApiClientConfig {
  region: string
  apiUrl: string
}

/**
 * Options which control how and where to connect to the AppSync client
 */
export type ClientOptions = {
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
   * Create and fetch a new GraphQL client.
   *
   * @param options ClientOptions for configuring AmplifyClient connection and location
   * @returns GraphQLClient
   *
   * @throws ConfigurationNotSetError
   * @throws {@link SudoUserClientNotSetError}
   */
  getClient(options?: ClientOptions): GraphQLClient

  /**
   * Returns the default client config associated with the provided configNamespace,
   * or the default configNamespace if none is provided.
   *
   * @param configNamespace The namespace of the config to retrieve the default client options for.
   * @returns The default client config associated with the provided configNamespace,
   * or the default configNamespace if none is provided.
   */
  getApiClientConfig(configNamespace?: string): ApiClientConfig

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
  private _namespacedClients: Record<string, GraphQLClient> = {}

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

  public getClient(options?: ClientOptions): GraphQLClient {
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

      client = new internal.AmplifyClient({
        graphqlUrl: config.apiUrl,
        region: config.region,
        tokenProvider: async () => {
          try {
            return await authClient.getLatestAuthToken()
          } catch {
            // Return empty string so the graphql request can fail and the error can be processed by the caller.
            return ''
          }
        },
      })
      this._namespacedClients[configNamespace] = client
    }

    return client
  }

  public getApiClientConfig(configNamespace?: string): ApiClientConfig {
    const configNamespaceToUse = configNamespace ?? defaultConfigNamespace

    const config = this.getConfigForNamespace(configNamespaceToUse)

    if (!config) {
      throw new ConfigurationNotSetError()
    }
    return {
      apiUrl: config.apiUrl,
      region: config.region,
    }
  }
  public async reset(): Promise<void> {
    await Promise.resolve()
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
      t.type({
        region: t.string,
        apiUrl: t.string,
      }),
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
