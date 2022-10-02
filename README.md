# Piano

A fully featured piano with multiplayer and midi support able to be played
with a computer keyboard, mouse, midi keyboard, and touchscreen.

Live demo at https://calbabreaker.github.io/piano.

![2022-10-02_23-50](https://user-images.githubusercontent.com/57030377/193456251-ef1df795-774b-41b6-a47d-b37f5bc923c7.png)

## Structure

The project is seperated into two folders [frontend/](./frontend) and [backend/](./backend).

The frontend folder will contain the piano frontend website. This can just be
hosted somewhere statically able to serve files after building. The
`deploy-frontend` branch will contain the built version of the `main` branch.

The backend folder will contain the node.js backend server running socket.io. This needs
to be hosted somewhere able to run node.js (eg. Digitalocean droplet, heroku, etc.)

## Developing

To start developing, install [pnpm](https://pnpm.io/) then clone the
repo by doing `git clone https://github.com/Calbabreaker/piano --depth 1` then
read the README.md on each of the folders.
