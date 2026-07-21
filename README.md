# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.16.1 create --template minimal --types ts --add tailwindcss="plugins:none" --install npm cibus
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Running the Node build

The adapter-node server listens for plain HTTP on port 3000:

```sh
HOST=0.0.0.0 PORT=3000 node build
```

Use `http://<server-ip>:3000` when connecting to it directly. The Node adapter does
not terminate TLS, so `https://<server-ip>:3000` will fail during the SSL handshake.

For HTTPS, put a TLS reverse proxy in front of the Node server and tell SvelteKit
which forwarded headers to trust. For example, when the proxy supplies the usual
`X-Forwarded-Proto` and `X-Forwarded-Host` headers:

```sh
PROTOCOL_HEADER=x-forwarded-proto HOST_HEADER=x-forwarded-host node build
```

Only set these variables when requests can reach the app through a trusted proxy;
otherwise clients could spoof the headers.
