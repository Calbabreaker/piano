# Piano Frontend

This folder contains the code for the piano frontend (ui).

## Developing

Run `pnpm install` to install dependencies.

Then run `pnpm dev` to launch watching development server.

Run `pnpm build` to build into `public/` folder that will contain the
static html able to be put on any file server.

To set the backend server, make a `.env` file with these contents:

```sh
VITE_BACKEND_HOST=
VITE_BACKEND_PATH=
```

Put the server domain/ip and port after `VITE_BACKEND_HOST=`. If the server running
on a path set `VITE_BACKEND_PATH` as well. For example to run use the server running on
localhost, do: `VITE_BACKEND_HOST=localhost:5000`
