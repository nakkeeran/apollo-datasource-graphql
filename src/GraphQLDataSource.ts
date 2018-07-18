import { ApolloLink, execute, GraphQLRequest, makePromise } from 'apollo-link';
import { setContext } from 'apollo-link-context';
import { onError } from 'apollo-link-error';
import { createHttpLink } from 'apollo-link-http';
import { ApolloError, AuthenticationError, ForbiddenError } from 'apollo-server-errors';
import to from 'await-to-js';
import fetch from 'isomorphic-fetch';

export class GraphQLDataSource {
  public baseURL?: string;

  public async query(query: any, variables?: {}) {
    return this.executeSingleOperation({ query, variables });
  }

  protected willSendRequest?(request: any): any;

  private composeLinks(): ApolloLink {
    const uri = this.resolveUri();

    return ApolloLink.from([
      this.onErrorLink(),
      this.onRequestLink(),
      createHttpLink({ fetch, uri }),
    ]);
  }

  private didEncounterError(error: any) {
    const status = error.statusCode ? error.statusCode : null;
    const message = error.bodyText ? error.bodyText : null;

    let apolloError: ApolloError;

    switch (status) {
      case 401:
        apolloError = new AuthenticationError(message);
        break;
      case 403:
        apolloError = new ForbiddenError(message);
        break;
      default:
        apolloError = new ApolloError(message);
    }

    throw apolloError;
  }

  private async executeSingleOperation(operation: GraphQLRequest) {
    const link = this.composeLinks();

    const [error, response] = await to(makePromise(execute(link, operation)));

    if (error) {
      this.didEncounterError(error);
    }

    return response;
  }

  private resolveUri(): string {
    const baseURL = this.baseURL;

    if (!baseURL) {
      throw new ApolloError('Please provide Graphql URI in your GraphqlDataSource');
    }

    return baseURL;
  }

  private onRequestLink() {
    return setContext((_, request) => {
      if (this.willSendRequest) {
        this.willSendRequest(request);
      }

      return request;
    });
  }

  private onErrorLink() {
    return onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors) {
        graphQLErrors.map(graphqlError =>
          console.error(
            `[GraphQL error]: ${graphqlError}`,
          ),
        );
      }

      if (networkError) {
        console.log(`[Network Error]: ${networkError}`);
      }
    });
  }
}