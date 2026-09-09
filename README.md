# Cibus

Cibus is the mobile-first web client for **Eat Right**, Loyola College's food court platform. It provides a modern ordering experience while using the existing Foodcourt JSP application as its system of record.

The application is built with SvelteKit and runs as a Node server.

To run a production build locally, configure `.env` (see `.env.example`), then run:

```sh
npm run build
npm start
```

`npm start` loads `.env` when present; environment variables supplied by the
deployment take precedence. Running `node build` directly requires supplying
the environment yourself. Set `FOODCOURT_API_BASE_URL` to the backend's absolute
HTTP(S) base URL, including its context path (for example, `/foodcourtapi`).

## License

This repository is private and intended for the Eat Right project. No public license is granted.
