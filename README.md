# Piano

A nice little piano with multiplayer support.

## Structure

The project is seperated into two folders `frontend/` and `backend/`.

The frontend stuff will contain the piano frontend and it will contact the specified backend 
server for websockets and stuff. This can just be hosted somewhere statically able to serve files.

The backend stuff will contain the backend server hosted somewhere with socket.io. This needs
to be hosted somewhere able to run node.js (eg. Digitalocean droplet)
