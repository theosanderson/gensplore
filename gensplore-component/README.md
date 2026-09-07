# Gensplore React component

## Installation

```sh
npm install gensplore
```

React and React DOM 18.3 or 19 are peer dependencies: the viewer uses your application's React instance. ESM and CommonJS entry points and TypeScript declarations are included.

## Usage

```tsx
import Gensplore from 'gensplore';

export function Preview({ genbankString }: { genbankString: string }) {
  return <Gensplore genbankString={genbankString} />;
}
```

`genbankString` is the complete GenBank file text, including the reference sequence and annotations. Styles, fonts and controls load automatically with the component, using the same CSS injection plugin as Taxonium. No separate CSS import or Tailwind configuration is required. Its selectors are scoped to `.gensplore`, including the portalled dialogs.

**Upgrading:** direct imports of the old `dist/gensplore.es.js` / UMD files should use the package entry point instead.

| Prop | Type | Purpose |
| --- | --- | --- |
| `genbankString` | `string` | Required reference file contents. |
| `fastaUrl` | `string` | Optional alternative FASTA URL. Removing it clears the comparison. |
| `searchInput` | `string \| null` | Optional controlled search. Otherwise search is managed internally. |
| `setSearchInput` | `(value: string \| null) => void` | Search change callback; `null` clears it. |
| `setTitleCallback` | `(title: string) => void` | Reference/comparison title callback. The viewer does not set the document title itself. |

`GensploreProps` is exported as a TypeScript type. Remote FASTA URLs require CORS access. The drawer also accepts local FASTA files. The inline alignment worker needs `worker-src blob:` if your application uses a Content Security Policy; bundled fonts need `font-src data:`. For nonce-based styles, put `<meta property="csp-nonce" content="YOUR_NONCE">` in the document head; the injected style element uses that nonce. The viewer also uses inline style attributes for dynamic layout. See the [repository README](https://github.com/theosanderson/gensplore#comparing-an-alternative-fasta) for supported inputs and comparison limits. Biological function is not predicted.

## Astro / Loculus

Use a React island because the viewer depends on browser layout and scrolling:

```astro
---
import Gensplore from 'gensplore';
const { genbankString, fastaUrl } = Astro.props;
---
<Gensplore client:only="react" genbankString={genbankString} fastaUrl={fastaUrl} />
```

Callbacks belong inside a React wrapper; functions cannot be serialized as Astro island props. The viewer currently uses the page scroll position and viewport-fixed controls. An independently scrolling or multiple-viewer layout would require further integration work.

The package smoke test installs an actual npm tarball in a separate Astro 7 / Vite 8 / TypeScript 5.9 application using Loculus's React 18.3 versions, and repeats with React 19. It checks ESM/CommonJS imports, type checking, production rendering, the FASTA worker, title updates, search, and CSS isolation. This does not yet add the viewer to Loculus or implement its aligned-sequence API.
