import { StatusCodes } from 'http-status-codes';
import { createClient, createConfig } from './gen/client/index.ts';
import * as sdk from './gen/sdk.gen.ts';

export const TdbCounterResponseKinds = {
  received: 'received',
  adjusted: 'adjusted',
  deleted: 'deleted',
  noSuchCounter: 'noSuchCounter',
} as const;

export type TdbCounterNoSuchCounterResponse = {
  readonly kind: typeof TdbCounterResponseKinds.noSuchCounter;
};

const noSuchCounterResponse: TdbCounterNoSuchCounterResponse = {
  kind: TdbCounterResponseKinds.noSuchCounter,
};

export type TdbCounterReceivedResponse =
  | { readonly kind: typeof TdbCounterResponseKinds.received; readonly currentCount: number }
  | TdbCounterNoSuchCounterResponse;

export type TdbCounterAdjustmentResponse =
  | { readonly kind: typeof TdbCounterResponseKinds.adjusted; readonly newCount: number }
  | TdbCounterNoSuchCounterResponse;

export type TdbCounterDeletedResponse =
  | { readonly kind: typeof TdbCounterResponseKinds.deleted }
  | TdbCounterNoSuchCounterResponse;

export const TdbApiErrorKinds = {
  network: 'network',
  incompatibility: 'incompatibility',
  internalServerError: 'internalServerError',

  /**
   * The edge would not take the token, on an operation that never promised a 401.
   *
   * Its own kind rather than an incompatibility: every operation can be refused this way, and it is
   * the one failure the page can actually do something about.
   */
  unauthorized: 'unauthorized',
} as const;

export type TdbApiErrorKind = keyof typeof TdbApiErrorKinds;

export class TdbApiError extends Error {
  constructor(readonly kind: TdbApiErrorKind) {
    super(kind);
    this.name = 'TdbApiError';
  }
}

export type TdbApiClient = {
  createCounter(): Promise<string>;
  deleteCounter(counterId: string): Promise<TdbCounterDeletedResponse>;
  getCount(counterId: string): Promise<TdbCounterReceivedResponse>;
  incrementCount(counterId: string): Promise<TdbCounterAdjustmentResponse>;
  decrementCount(counterId: string): Promise<TdbCounterAdjustmentResponse>;
};

type RawResult<DataT> = {
  data?: DataT | undefined;
  // Optional, because the generated client resolves this way when there was no exchange at all.
  response?: Response | undefined;
};

/**
 * A client for the API at [baseUrl], presenting whatever [bearerToken] answers at the time of each
 * call.
 *
 * A function rather than a token, because a token outlives neither the hour nor the person: asking
 * per call is what keeps a refreshed one from being a client that has to be rebuilt.
 */
export function createTdbApiClient(
  baseUrl: string,
  bearerToken: () => string | null,
): TdbApiClient {
  const httpClient = createClient(createConfig({ baseUrl }));

  httpClient.interceptors.request.use((request) => {
    const token = bearerToken();

    if (token !== null) {
      request.headers.set('authorization', `Bearer ${token}`);
    }

    return request;
  });

  /**
   * Wraps a call to the generated client.
   *
   * @param operation - the name of the operation being called
   * @param callRaw - calls the generated method
   * @param processRawResponse - answers the result for a response the operation was promised, and
   *   `undefined` for any other — a 2xx included
   */
  async function wrapCall<DataT, ResponseT>(
    operation: string,
    callRaw: () => Promise<RawResult<DataT>>,
    processRawResponse: (response: Response, data: DataT | undefined) => ResponseT | undefined,
  ): Promise<ResponseT> {
    const tryCallRaw = async () => {
      try {
        return await callRaw();
      } catch (cause) {
        // The generated client rejects only when the exchange did not happen.
        console.warn(`${operation}: the call did not complete over the network`, cause);

        throw new TdbApiError(TdbApiErrorKinds.network);
      }
    };

    const rawResult = await tryCallRaw();
    const rawResponse = rawResult.response;

    switch (rawResponse) {
      case undefined: {
        console.warn(`${operation}: the call produced no response`);

        throw new TdbApiError(TdbApiErrorKinds.network);
      }

      default: {
        const { status } = rawResponse;

        if (status === StatusCodes.UNAUTHORIZED) {
          console.warn(`${operation}: the token was not accepted`);

          throw new TdbApiError(TdbApiErrorKinds.unauthorized);
        }

        if (status >= StatusCodes.INTERNAL_SERVER_ERROR) {
          console.error(`${operation}: the server failed the request`, status);

          throw new TdbApiError(TdbApiErrorKinds.internalServerError);
        } else {
          const response = processRawResponse(rawResponse, rawResult.data);

          switch (response) {
            case undefined: {
              console.error(
                `${operation}: the server answered ${status}, which this operation was not promised`,
              );

              throw new TdbApiError(TdbApiErrorKinds.incompatibility);
            }

            default: {
              return response;
            }
          }
        }
      }
    }
  }

  function processRawReceivedResponse(
    response: Response,
    data: { readonly count: number } | undefined,
  ): TdbCounterReceivedResponse | undefined {
    if (response.status === StatusCodes.OK && data) {
      return { kind: TdbCounterResponseKinds.received, currentCount: data.count };
    }

    if (response.status === StatusCodes.NOT_FOUND) {
      return noSuchCounterResponse;
    }

    return undefined;
  }

  function processRawAdjustmentResponse(
    response: Response,
    data: { readonly count: number } | undefined,
  ): TdbCounterAdjustmentResponse | undefined {
    if (response.status === StatusCodes.OK && data) {
      return { kind: TdbCounterResponseKinds.adjusted, newCount: data.count };
    }

    if (response.status === StatusCodes.NOT_FOUND) {
      return noSuchCounterResponse;
    }

    return undefined;
  }

  return {
    createCounter: () =>
      wrapCall(
        'createCounter',
        () => sdk.createCounter({ client: httpClient }),
        (response, data) =>
          response.status === StatusCodes.OK && data ? data.counterId : undefined,
      ),

    deleteCounter: (counterId) =>
      wrapCall(
        'deleteCounter',
        () => sdk.deleteCounter({ client: httpClient, path: { counterId } }),
        (response) => {
          if (response.status === StatusCodes.NO_CONTENT) {
            return { kind: TdbCounterResponseKinds.deleted } as const;
          }

          if (response.status === StatusCodes.NOT_FOUND) {
            return noSuchCounterResponse;
          }

          return undefined;
        },
      ),

    getCount: (counterId) =>
      wrapCall(
        'getCount',
        () => sdk.getCount({ client: httpClient, path: { counterId } }),
        processRawReceivedResponse,
      ),

    incrementCount: (counterId) =>
      wrapCall(
        'incrementCount',
        () => sdk.incrementCount({ client: httpClient, path: { counterId } }),
        processRawAdjustmentResponse,
      ),

    decrementCount: (counterId) =>
      wrapCall(
        'decrementCount',
        () => sdk.decrementCount({ client: httpClient, path: { counterId } }),
        processRawAdjustmentResponse,
      ),
  };
}
