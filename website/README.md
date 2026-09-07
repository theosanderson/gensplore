# Gensplore website

Use Node 24 and Corepack (`corepack enable`). Build `../gensplore-component` first, then run `yarn install --immutable` and `yarn start` here. Run `yarn build` for the production site; it installs and builds the component too, so deployments work from a clean checkout.

The website links to the component through a Yarn portal. Rebuild the component after changing it; the website uses that build directly.
