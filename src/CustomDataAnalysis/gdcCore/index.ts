type CountHookLazyQuery = UseLazyQuery<QueryDefinition<FilterSet, (request: GraphqlApiSliceRequest) => Promise<{
    error: GraphQLFetchError | string;
    data?: undefined;
} | {
    data: GraphQLApiResponse<any>;
    error?: undefined;
}>, never, number, "graphql">>;
type CountQueryResponse = {
    data: number;
    isFetching: boolean;
    isError: boolean;
    isSuccess: boolean;
};
type CountHook = () => CountQueryResponse;

declare class CountHookRegistry {
    private static instance;
    private registry;
    private constructor();
    static getInstance(): CountHookRegistry;
    registerHook(name: string, func: CountHook | CountHookLazyQuery): void;
    getHook(name: string): CountHook;
}

export CountHookRegistry;·