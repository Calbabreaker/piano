# Piano

A nice little piano with multiplayer support and midi playing able to be played
with keyboard, mouse and touchscreen.

Live demo at https://calbabreaker.github.io/piano.

![piano-screenshot](./.github/piano-screenshot.png)

## Structure

The project is seperated into two folders [frontend/](./frontend) and [backend/](./backend).

The frontend stuff will contain the piano frontend and it will contact the specified backend
server for websockets and stuff. This can just be hosted somewhere statically able to serve files.

The backend stuff will contain the backend server hosted somewhere with socket.io. This needs
to be hosted somewhere able to run node.js (eg. Digitalocean droplet)

To start developing run: `git clone https://github.com/Calbabreaker/piano --depth 1` then read the README.md on each of the folders.
