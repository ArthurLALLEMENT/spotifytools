/******************************************************************************/
/* Constants                                                                  */
/******************************************************************************/

const VERSION = "2.0";

const RESSOURCES = [
  
  "./",
  "./index.html",
  "./service_worker.js",
  "./css/style.css",
  "./css/bulma.css",
  "./js/pwa.js",
  "./js/script.js",

  // Favicon et images
  "./favicon/favicon.ico",
  "./favicon/favicon.svg",
  "./favicon/site.webmanifest",
  "./favicon/web-app-manifest-192x192.png",
  "./favicon/web-app-manifest-512x512.png",
  "./favicon/apple-touch-icon.png",
  "./img/logospotifytools.png",
  "./img/spotify-marker.png"
];

/******************************************************************************/
/* Listeners                                                                  */
/******************************************************************************/

self.addEventListener("install", onInstall); //fonction appeler lors de l'instalation et à chaque MAJ
self.addEventListener("fetch", onFetch); //fonction lancer à chaque requête Web

/******************************************************************************/
/* Install                                                                    */
/******************************************************************************/

function onInstall(event) {
  console.debug("onInstall()"); //Print dans la console le nom de la fonction en cours

  event.waitUntil(caching()); //Attendre la fin de la fonction appeler
  self.skipWaiting(); // ??
}

/******************************************************************************/

async function caching() { //Déclaration d'une fonction asynchrone (qui peut prendre du temps)
  console.debug("caching()"); // Print dans la console le nom de la fonction

  const KEYS = await caches.keys(); // le "await" permet de dire que cette action doit etre terminée avant de passer à la suite

  if (!KEYS.includes(VERSION)) { //Si la version en cache ne contient pas de valeur comme la constante "VERSION" définit plus haut
    console.log("Caching version:", VERSION); // Print dans la console le nom de la fonction
    const CACHE = await caches.open(VERSION); // On ouvre une nouvelle version dans le cache
    await CACHE.addAll(RESSOURCES); // On remplie le cache avec les nouveaux fichier

    for (const KEY of KEYS) {
      if (KEY !== VERSION) { // Si la la version en cache ne correspond pas a la valeur de la constante "VERSION"
        console.log("Suppress old cache version:", KEY); // Print dans la console l'action faite
        await caches.delete(KEY);// on supprime tout le contenue du cache
      }
    }
  }
}

/******************************************************************************/
/* Fetch                                                                      */
/******************************************************************************/

function onFetch(event) {
  console.debug("onFetch()"); // Print dans la console le nom de la fonction

  event.respondWith(getResponse(event.request)); // Appel de la fonction "getResponse"
}

/******************************************************************************/

async function getResponse(request) { //Déclaration d'une fonction asynchrone (qui peut prendre du temps)
  console.debug("getResponse()");// Print dans la console le nom de la fonction

  const RESPONSE = await caches.match(request); // le "await" permet de dire que cette action doit etre terminée avant de passer à la suite

  if (RESPONSE) { // Si on a une correspondance
    console.log("Fetch from cache", request.url); // on l'affiche dans la console
    return RESPONSE; // On utilise ce qui est contenue dans le cache
  } else { // Sinon
    console.log("Fetch from server", request.url); // on l'affiche dans la console
    return fetch(request); // On utilise le contenue de la requete du serveur
  }
}

/******************************************************************************/