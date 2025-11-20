declare namespace chrome {
  namespace storage {
    interface StorageArea {
      get(keys: string[] | null, callback: (items: { [key: string]: any }) => void): void;
      set(items: { [key: string]: any }, callback?: () => void): void;
    }
    const local: StorageArea;
  }
  namespace identity {
    interface TokenDetails {
      interactive?: boolean;
      account?: { id: string };
      scopes?: string[];
    }
    interface RemoveCachedAuthTokenDetails {
      token: string;
    }
    interface WebAuthFlowOptions {
      url: string;
      interactive?: boolean;
    }
    function getAuthToken(
      details: TokenDetails,
      callback: (token?: string) => void
    ): void;
    function getRedirectURL(path?: string): string;
    function launchWebAuthFlow(
      details: WebAuthFlowOptions,
      callback: (responseUrl?: string) => void
    ): void;
    function removeCachedAuthToken(
      details: RemoveCachedAuthTokenDetails,
      callback: () => void
    ): void;
  }
  namespace runtime {
    const lastError: { message?: string } | undefined;
  }
}

