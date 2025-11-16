/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams: { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `${'/(tabs)'}` | `/`; params?: Router.UnknownInputParams; } | { pathname: `${'/(tabs)'}/maps` | `/maps`; params?: Router.UnknownInputParams; } | { pathname: `/utils/MadSocket`; params?: Router.UnknownInputParams; } | { pathname: `/utils/socket`; params?: Router.UnknownInputParams; };
      hrefOutputParams: { pathname: Router.RelativePathString, params?: Router.UnknownOutputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownOutputParams } | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams; } | { pathname: `${'/(tabs)'}` | `/`; params?: Router.UnknownOutputParams; } | { pathname: `${'/(tabs)'}/maps` | `/maps`; params?: Router.UnknownOutputParams; } | { pathname: `/utils/MadSocket`; params?: Router.UnknownOutputParams; } | { pathname: `/utils/socket`; params?: Router.UnknownOutputParams; };
      href: Router.RelativePathString | Router.ExternalPathString | `/_sitemap${`?${string}` | `#${string}` | ''}` | `${'/(tabs)'}${`?${string}` | `#${string}` | ''}` | `/${`?${string}` | `#${string}` | ''}` | `${'/(tabs)'}/maps${`?${string}` | `#${string}` | ''}` | `/maps${`?${string}` | `#${string}` | ''}` | `/utils/MadSocket${`?${string}` | `#${string}` | ''}` | `/utils/socket${`?${string}` | `#${string}` | ''}` | { pathname: Router.RelativePathString, params?: Router.UnknownInputParams } | { pathname: Router.ExternalPathString, params?: Router.UnknownInputParams } | { pathname: `/_sitemap`; params?: Router.UnknownInputParams; } | { pathname: `${'/(tabs)'}` | `/`; params?: Router.UnknownInputParams; } | { pathname: `${'/(tabs)'}/maps` | `/maps`; params?: Router.UnknownInputParams; } | { pathname: `/utils/MadSocket`; params?: Router.UnknownInputParams; } | { pathname: `/utils/socket`; params?: Router.UnknownInputParams; };
    }
  }
}
