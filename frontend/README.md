# Piano Frontend

This folder contains the code for the piano frontend (ui).

## Developing

Run `yarn` to install dependencies.

Then run `yarn dev` to launch watching development server.

Finally, run `yarn build` to build into `public/` folder that will contain the
static html able to be put on any file server.

To set the backend server, make a `.env` file with these contents:

```sh
BACKEND_HOST=
BACKEND_PATH=
```

Then put the server domain/ip after `BACKEND_HOST=`. If the server running
on a path set `BACKEND_PATH` as well. For example to run use the server running on
localhost, do: `BACKEND_HOST=http://localhost:3000`
