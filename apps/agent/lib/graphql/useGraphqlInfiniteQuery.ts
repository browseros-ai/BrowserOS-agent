import {
  type InfiniteData,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query'
import type { TypedDocumentString } from '@/generated/graphql/graphql'
import { execute } from './execute'
import { getQueryKeyFromDocument } from './getQueryKeyFromDocument'

/**
 * @public
 */
export const useGraphqlInfiniteQuery = <
  TQueryFnData,
  TVariables extends Record<string, any> | undefined = undefined,
  TPageParam extends string | undefined | number = undefined,
>(
  query: TypedDocumentString<TQueryFnData, TVariables>,
  getVariables: (pageParam: TPageParam) => TVariables,
  options: Omit<
    UseInfiniteQueryOptions<
      TQueryFnData, // TQueryFnData
      Error, // TError
      InfiniteData<TQueryFnData, TPageParam> // TData
    >,
    'queryKey' | 'queryFn'
  > & {
    /** Required by React Query v5 */
    initialPageParam: TPageParam
  },
): UseInfiniteQueryResult<InfiniteData<TQueryFnData, TPageParam>, Error> => {
  const queryKey = [getQueryKeyFromDocument(query)] as const

  return useInfiniteQuery<
    TQueryFnData, // TQueryFnData
    Error, // TError
    InfiniteData<TQueryFnData, TPageParam> // TData (pages + pageParams)
  >({
    queryKey,
    queryFn: async ({ pageParam }) =>
      execute<TQueryFnData, TVariables>(
        query,
        getVariables(pageParam as TPageParam),
      ),
    ...options,
  })
}
