// -------------------//
// config spotify api //
// -------------------//
const CLIENT_ID = "d6b72f1e943246c0922a6548c3d48ed0";
const REDIRECT_URI = "https://srv-peda2.iut-acy.univ-smb.fr/lallemea/map/";
let token = null;

// ---------------------------------//
// localstorage pour les top tracks //
// ---------------------------------//
const LS_TITRES_LONG_TERME = "spotify_long_term_tracks";
const LS_TITRES_COURT_TERME = "spotify_short_term_tracks";


// ---------------------------------------------//
// localstorage pour l'historique des playlists //
// ---------------------------------------------//
let historiquePlaylists = [];

// charger les playlists deja enregistrées
if (localStorage.getItem("playlistHistory")) {
    historiquePlaylists = JSON.parse(localStorage.getItem("playlistHistory"));
}

// -----------------------------------------------------------------------------------------------------------------------//
// gestion de la connexion et l’autorisation avec Spotify pour que l' app puisse lire et écrire des données sur le compte //
// -----------------------------------------------------------------------------------------------------------------------//

// fonction pour generer un code random
function genererChaineAleatoire(longueur) {
    let texte = "";
    let caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < longueur; i++) {
        // on prend un caract random et on l'ajoute
        texte += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }

    return texte
}

// fonction pour hasher une chaine en SHA-256
async function hacherSha256(texte) {
    let encodeur = new TextEncoder();
    let donnees = encodeur.encode(texte);
    return await crypto.subtle.digest("SHA-256", donnees)
}

// convertir le hash en base64 url safe
function encoderBase64Url(octets) {
    // transforme bytes en string
    let chaine = String.fromCharCode.apply(null, new Uint8Array(octets))
    let base64 = btoa(chaine)        // encode en base64

    // rend safe pour url
    base64 = base64.replace(/\+/g, "-")
    base64 = base64.replace(/\//g, "_")
    base64 = base64.replace(/=+$/, "")

    return base64
}

// genere le code challenge pour PKCE a partir du code verifier
async function genererCodeChallenge(codeVerificateur) {
    let resume = await hacherSha256(codeVerificateur)
    return encoderBase64Url(resume)
}

// --------------------------------------//
// fonction pour lancer le login spotify //
// --------------------------------------//
async function loginSpotify() {
    // code verifier random
    let codeVerificateur = genererChaineAleatoire(128)

    // code challenge (hash du code verifier)
    let codeChallenge = await genererCodeChallenge(codeVerificateur)

    // on garde le code verifier pour plus tard
    localStorage.setItem("spotify_code_verifier", codeVerificateur)

    // parametres pour la connexion spotify
    let parametres = new URLSearchParams({
        response_type: "code",                  // on veut un code temporaire
        client_id: CLIENT_ID,                   // notre id app spotify
        scope: "user-top-read playlist-modify-private", // ce qu'on veut faire
        redirect_uri: REDIRECT_URI,             // ou spotify va renvoyer le code
        code_challenge_method: "S256",          // methode pkce
        code_challenge: codeChallenge           // le code challenge
    })

    //redirection vers spotify pour se connecter
    window.location.href = "https://accounts.spotify.com/authorize?" + parametres.toString()
}

// --------------------------------------------//
// recuperer le token depuis l'url apres login //
// --------------------------------------------//
async function extraireTokenDepuisUrl() {
    let parametres = new URLSearchParams(window.location.search)
    let code = parametres.get("code")               // le code temporaire
    let storedToken = localStorage.getItem("spotify_token")

    // si pas de code mais token deja dans localstorage → on l'utilise
    if (!code && storedToken) {
        token = storedToken
        return
    }

    // si pas de code et pas de token → on sort
    if (!code) return

    // on recupere le code verifier stocké
    let codeVerificateur = localStorage.getItem("spotify_code_verifier")

    // on prepare les infos pour echanger le code contre un token
    let corpsRequete = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerificateur
    })

    // appel POST vers spotify pour avoir le token
    let reponse = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: corpsRequete
    })

    let donnees = await reponse.json()

    // si tout va bien, on stock le token
    if (donnees.access_token) {
        token = donnees.access_token
        localStorage.setItem("spotify_token", token)

        // on nettoie l'url pour enlever le code
        window.history.replaceState({}, document.title, REDIRECT_URI)
    }
    else {
        console.error("erreur pkce :", donnees)
    }
}
// ------------------//
// appel api spotify //
// ------------------//



// GET vers Spotify API (récupérer des informations... récup des données)
async function requeteGet(pointEntree) {
    if (!token) {
        console.warn("pas de token spotify")
        return null
    }


        let reponse = await fetch("https://api.spotify.com/" + pointEntree, { //on retourne directement le JSON reçu
            headers: { "Authorization": "Bearer " + token } // Spotify exige une authentification OAuth en bearer pour autoriser le porteur du token a recup des informations
        })

        if (reponse.status < 200 || reponse.status >= 300) {
            console.log("erreur spotify :", reponse.status)
            return null
        }

        return await reponse.json()
}


// fonction post pour spotify (création de playlist... créer des données)
async function requetePost(pointEntree, donnees) {
    if (!token) {
        console.warn("pas de token spotify")
        return null
    }

        let reponse = await fetch("https://api.spotify.com/" + pointEntree, { //on retourne directement le JSON reçu
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(donnees)
        })

        if (reponse.status < 200 || reponse.status >= 300) { //response.ok vérifie si la requête est 200–299
            console.log("erreur spotify :", reponse.status)
            return null
        }

        return await reponse.json()
}



// -------------------------//
// recuperer les top tracks //
// -------------------------//
async function recupererTopTitres() {
    if (!navigator.onLine) {
        let titres = localStorage.getItem(LS_TITRES_LONG_TERME)
        if (titres) return JSON.parse(titres)
    }

    let donnees = await requeteGet("v1/me/top/tracks?time_range=long_term&limit=5")
    if (donnees && donnees.items) {
        localStorage.setItem(LS_TITRES_LONG_TERME, JSON.stringify(donnees.items))
        return donnees.items
    }

    return []
}

async function recupererTopTitresCourtTerme() {
    if (!navigator.onLine) {
        let titres = localStorage.getItem(LS_TITRES_COURT_TERME)
        if (titres) return JSON.parse(titres)
    }

    let donnees = await requeteGet("v1/me/top/tracks?time_range=short_term&limit=5")
    if (donnees && donnees.items) {
        localStorage.setItem(LS_TITRES_COURT_TERME, JSON.stringify(donnees.items))
        return donnees.items
    }

    return []
}

async function recupererUrisTitresCourtTerme(limite) {
    if (!limite) {
      limite = 20 // valeur par defaut
    }
    let uris = []
    let donnees = await requeteGet("v1/me/top/tracks?time_range=short_term&limit=" + limite)
    if (donnees && donnees.items) {
        for (let i = 0; i < donnees.items.length; i++) {
            uris.push(donnees.items[i].uri)
        }
    }
    return uris
}

// ---------------------------------//
// affichage tracks dans le tableau //
// ---------------------------------//
function afficherTitresDansTableau(titres) { // ~~ creation de variables dans la fonction/ trouver un autre moyen
    let corpsTableau = document.querySelector("#tracksTable tbody")
    corpsTableau.innerHTML = ""

    for (let i = 0; i < titres.length; i++) {
        let titre = titres[i]
        let artistes = ""
        let ligne = document.createElement("tr")
        let urlImage = ""

        for (let j = 0; j < titre.artists.length; j++) {
            if (j > 0) artistes += ", "
            artistes += titre.artists[j].name
        }

        if (titre.album && titre.album.images && titre.album.images[2]) {
            urlImage = titre.album.images[2].url
        }

        ligne.innerHTML =
            "<td><img src='" + urlImage + "' width='64' height='64'></td>" +
            "<td>" + titre.name + "</td>" +
            "<td>" + artistes + "</td>" +
            "<td>" + titre.album.name + "</td>"

        corpsTableau.appendChild(ligne)
    }
}


function afficherTitresCourtTerme(titres) { // ~~ creation de variables dans la fonction/ trouver un autre moyen
    let corpsTableau = document.querySelector("#shortTracksTable tbody")
    corpsTableau.innerHTML = ""

    for (let i = 0; i < titres.length; i++) {
        let artistes = ""
        let titre = titres[i]
        let ligne = document.createElement("tr")
        let urlImage = ""
        // concatener les artistes

        for (let j = 0; j < titre.artists.length; j++) {
            if (j > 0) artistes += ", "
            artistes += titre.artists[j].name
        }

        // image de l'album si elle existe

        if (titre.album && titre.album.images && titre.album.images[2]) {
            urlImage = titre.album.images[2].url
        }

        ligne.innerHTML =
            "<td><img src='" + urlImage + "' width='54' height='54' style='border-radius:6px'></td>" +
            "<td>" + titre.name + "</td>" +
            "<td>" + artistes + "</td>" +
            "<td>" + titre.album.name + "</td>"

        corpsTableau.appendChild(ligne)
    }
}


// -----------------------//
// map et geolocalisation //
// -----------------------//
const ICONE_SPOTIFY = L.icon({
    iconUrl: './img/spotify-marker.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
})

let carte = null;
let carteChargee = false // pour pas init 2 fois
function initialiserCarte() {
    if (!carteChargee) {
      carteChargee = true
      carte = L.map('map').setView([46.5, 6.5], 5);


      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
      }).addTo(carte)

      // remettre les markers des playlists sauvées
      for (let i = 0; i < historiquePlaylists.length; i++) {
          let p = historiquePlaylists[i]
          ajouterMarqueurPlaylist(p.lat, p.lon, p.name, p.desc)
      }

      mettreAJourListePlaylists()

      // geoloc si dispo
      if (!navigator.geolocation) {
        alert("geolocalisation pas supportée")
      }
    }
}

// ajouter un marker pour chaque playlist
function ajouterMarqueurPlaylist(lat, lon, nom, desc) {

    let marqueur; // le marqueur de position

    if (!carte) return

    L.marker([lat, lon], { icon: ICONE_SPOTIFY })
        .addTo(carte)
        .bindPopup("<strong>" + nom + "</strong><br>" + desc)
}

// ------------------------//
// creation playlist perso //
// ------------------------//
async function creerPlaylist() {
    let nombreTitres = parseInt(document.getElementById("trackCountInput").value) || 20
    let nomPlaylist = document.getElementById("playlistNameInput").value || "Playlist perso"
    let descPlaylist = document.getElementById("playlistDescInput").value || "Generée automatiquement"

    let moi = await requeteGet("v1/me");
    if (!moi) {
        return null
    }

    let titres = await recupererUrisTitresCourtTerme(nombreTitres)
    if (!titres.length) {
        return null
    }

    // créer playlist
    let playlist = await requetePost("v1/users/" + moi.id + "/playlists", {
        name: nomPlaylist,
        description: descPlaylist,
        public: false
    })

    await requetePost("v1/playlists/" + playlist.id + "/tracks", { uris: titres })


    // tt ce qui depent de la position est ici
    // On vérifie si le navigateur supporte la géolocalisation
    if (navigator.geolocation) {

        // On récupère la position actuelle de l'utilisateur
        navigator.geolocation.getCurrentPosition(

            // Fonction appelée si la géoloc marche
            function(pos) {

                // Récupération de la latitude
                let lat = pos.coords.latitude

                // Récupération de la longitude
                let lon = pos.coords.longitude

                // Création d'un objet avec les infos de la playlist
                let donneesPlaylist = {
                    name: nomPlaylist,        // nom de la playlist
                    desc: descPlaylist,        // description
                    lat: lat,                  // latitude ou on était
                    lon: lon,                  // longitude aussi
                    url: playlist.external_urls.spotify // lien spotify
                }

                // On ajoute la playlist dans l'historique
                historiquePlaylists.push(donneesPlaylist)

                // On sauvegarde l'historique dans le localStorage
                localStorage.setItem("playlistHistory", JSON.stringify(historiquePlaylists))

                // On ajoute un marker sur la carte a l'endroit ou on est
                ajouterMarqueurPlaylist(lat, lon, nomPlaylist, descPlaylist)

                // On met a jour la liste des playlists affichée
                mettreAJourListePlaylists()
            },

            // Fonction appelée si ya une erreur de géolocalisation
            function(err) {
                console.error("erreur geoloc :", err) // affichage de l'erreur dans la console
            }
        )
    }

    return playlist
}


// -----------------------------------//
// playlists prédéfinies pour le gyro //
// -----------------------------------//
const PLAYLISTS_AMBIANCE = {
    chill: "52y1R1Q7uAvqtrbvBf7KZL",
    neutre: "1jDGvHRTfqGiTnQBwXeE6W",
    energique: "4N23ATsApW0CrxcE4uvL5Y"
}
function generateGyroPlaylist(ambiance) {

    // securité si ambiance inconnue
    if (!PLAYLISTS_AMBIANCE[ambiance]) {
        ambiance = "neutre"
    }

    // recuperation de l'id de la playlist
    let idPlaylist = PLAYLISTS_AMBIANCE[ambiance]

    // recuperation de la section gyroscope
    let sectionGyro = document.getElementById("gyroSection")

    // recuperation du lecteur spotify gyroscope
    let iframe = document.getElementById("spotifyPlayerGyro")

    // message de statut
    let statut = document.getElementById("gyroStatus")

    // si un element manque on arrete
    if (!sectionGyro || !iframe) {
        console.error("elements gyro manquants")
        return
    }

    // afficher la section si elle etait cachée
    sectionGyro.classList.remove("hidden")

    // reset de l'iframe pour forcer le reload spotify
    iframe.src = ""

    // petit delai sinon spotify recharge pas
    setTimeout(function() {
        iframe.src = "https://open.spotify.com/embed/playlist/" + idPlaylist
    }, 50)

    // affichage du message utilisateur
    if (statut) {
        statut.textContent = "ambiance detectée : " + ambiance
    }

    console.log("playlist gyro chargée :", ambiance)
}

// ----------//
// gyroscope //
// ----------//
// etat du gyroscope (actif ou pas)
let gyroActif = false;

// tableau ou on stock les valeurs du gyro (gamma)
let valeursGyro = [];

// timer pour l'analyse
let minuteurGyro = null;

const DUREE_GYRO = 3000; // 3s

// fonction appelée pour lancer l'analyse du gyroscope
function demarrerPlaylistGyroscope() {

    // verifie si le navigateur supporte le gyroscope
    if (typeof DeviceOrientationEvent === "undefined") {
        alert("gyroscope non supporté")
        return
    }

    // reset des valeurs precedentes
    valeursGyro = []

    // affiche le loader/progress bar
    afficherChargeurGyro()

    // lance le timer d'analyse
    demarrerMinuteurGyro()

    // sur ios faut demander la permission explicitement
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission().then(function(reponse) {

            // si permission ok on active l'ecoute
            if (reponse === "granted") activerEcouteurGyro()
            else {
                alert("permission refusée")
                arreterGyroscope()
            }
        })
    } else {
        // android & co, pas besoin de permission
        activerEcouteurGyro()
    }
}

// active l'event listener du gyroscope
function activerEcouteurGyro() {

    // evite de lancer deux fois
    if (gyroActif) return

    gyroActif = true

    // on ecoute les changements d'orientation du tel
    window.addEventListener("deviceorientation", collecterDonneesGyro)
}

// fonction appelée a chaque event du gyroscope
function collecterDonneesGyro(event) {

    // si le gyro est plus actif on fait rien
    if (!gyroActif) return

    // on garde que la valeur gamma (inclinaison gauche/droite)
    if (event.gamma != null) valeursGyro.push(event.gamma)
}

// lance le timer qui dure DUREE_GYRO
function demarrerMinuteurGyro() {

    let progression = document.getElementById("gyroProgress")
    let valeur = 0

    let intervalle = 50 // maj toutes les 50ms
    let etape = 100 / (DUREE_GYRO / intervalle)

    minuteurGyro = setInterval(function() {
        valeur += etape
        progression.value = valeur

        // quand on arrive a 100% on stop tout
        if (valeur >= 100) {
            clearInterval(minuteurGyro)
            arreterGyroscope()
            analyserDonneesGyro()
        }
    }, intervalle)
}

// stop complet du gyroscope
function arreterGyroscope() {

    gyroActif = false

    // suppression de l'event listener
    window.removeEventListener("deviceorientation", collecterDonneesGyro)

    // cache le loader quand le temps est écoulé
    cacherChargeurGyro()

    // securité : on coupe le timer
    clearInterval(minuteurGyro)
}

// analyse les données recoltées
function analyserDonneesGyro() {

    // si aucune donnée, le user a pas bougé
    if (valeursGyro.length === 0) {
        alert("aucun mouvement detecté")
        return
    }

    // calcul de la moyenne des valeurs
    let somme = 0
    for (let i = 0; i < valeursGyro.length; i++) {
        somme += valeursGyro[i]
    }

    let moyenne = somme / valeursGyro.length

    // detection de l'ambiance selon les mouvments
    let ambiance = "neutre"

    if (moyenne > 10) ambiance = "energique"
    else if (moyenne < -10) ambiance = "chill"

    // generation de la playlist selon le mood
    // (Note: s'assurer que la fonction generateGyroPlaylist est bien définie quelque part)
    generateGyroPlaylist(ambiance)
}

// affiche la barre de progression
function afficherChargeurGyro() {

    let progression = document.getElementById("gyroProgress")
    let statut = document.getElementById("gyroStatus")

    progression.classList.remove("hidden")
    progression.value = 0

    statut.textContent = "analyse des mouvements..."
}

// cache la barre de progression
function cacherChargeurGyro() {

    document.getElementById("gyroProgress").classList.add("hidden")
    document.getElementById("gyroStatus").textContent = ""
}

// --------------//
// spotify embed //
// --------------//

// Met a jour le lecteur spotify avec l'id de la playlist
function mettreAJourLecteurSpotify(idPlaylist) {

    // On récupere l'iframe du lecteur spotify
    let iframe = document.getElementById("spotifyPlayer")

    // On change la source de l'iframe pour charger la playlist
    iframe.src = "https://open.spotify.com/embed/playlist/" + idPlaylist
}


// --------------//
// slider tracks //
// --------------//

// Configure le curseur pour choisir le nombre de titres
function configurerCurseurNombreTitres() {

    // Curseur (input range)
    let curseur = document.getElementById("trackCountInput")

    // Element qui affiche la valeur du curseur
    let sortie = document.getElementById("trackCountValue")

    // Quand on bouge le curseur
    curseur.addEventListener("input", function() {

        // On met a jour le texte avec la valeur actuelle
        sortie.textContent = curseur.value
    })
}

// ---------------------//
// navbar burger script //
// ---------------------//

// Initialise le menu burger pour le mobile
function initialiserMenuBurger() {

    // Bouton burger
    let burger = document.querySelector(".navbar-burger");

    // Menu principal
    let menu = document.getElementById("navbarMain");

    // Quand on clique sur le burger
    burger.addEventListener("click", function () {

      // Active / desactive l'animation du burger
      burger.classList.toggle("is-active");

      // Affiche ou cache le menu
      menu.classList.toggle("is-active");
    });
}


// ---------------------------//
// boutons toggle et generate //
// ---------------------------//

// Configure le bouton pour afficher / cacher la playlist
function configurerBasculePlaylist() {

    // Bouton toggle playlist
    let bouton = document.getElementById("togglePlaylistBtn")

    // Quand on clique, on bascule l'affichage
    bouton.addEventListener("click", basculerAffichagePlaylist)
}

// Affiche ou cache le conteneur de playlist
function basculerAffichagePlaylist() {

    // Conteneur de la playlist
    let conteneur = document.getElementById("playlistContainer")

    // Toggle de la classe hidden
    conteneur.classList.toggle("hidden")
}

// Configure le bouton pour generer une playlist
function configurerGenererPlaylist() {

    // Bouton generation
    let bouton = document.getElementById("generatePlaylistBtn")

    // Au clic on lance la generation
    bouton.addEventListener("click", executerGenerationPlaylist)
}

// Lance la generation de la playlist
async function executerGenerationPlaylist() {

    // Zone ou on affiche le resultat
    let resultat = document.getElementById("playlistResult")

    // message pendant le chargement
    resultat.textContent = "creation de la playlist..."

    // Creation de la playlist (appel async)
    let playlist = await creerPlaylist()

    // Mise a jour du lecteur spotify
    mettreAJourLecteurSpotify(playlist.id)

    // Affichage du resultat final
    resultat.innerHTML =
        "playlist créée : <strong>" + playlist.name + "</strong><br>" +
        "<a href='" + playlist.external_urls.spotify + "' target='_blank'>Ouvrir dans spotify</a>"
}



// -------------//
// toggle table //
// -------------//

// Configure le bouton pour afficher / cacher le tableau
function configurerBasculeTableau() {

    // Bouton du tableau
    let bouton = document.getElementById("toggleTableBtn")

    // Au clic on bascule le tableau
    bouton.addEventListener("click", basculerTableau)
}
// Affiche ou cache le tableau des titres
async function basculerTableau() {

    // Conteneur du tableau
    let conteneur = document.getElementById("tableContainer")

    // Toggle hidden
    conteneur.classList.toggle("hidden")

    // Si le tableau est caché on arrete la fonction
    if (conteneur.classList.contains("hidden")) return

    // Recuperation des titres long terme
    let titresLongTerme = await recupererTopTitres()

    // Si ya des titres on les affiche
    if (titresLongTerme.length > 0) afficherTitresDansTableau(titresLongTerme)

    // Recuperation des titres court terme
    let titresCourtTerme = await recupererTopTitresCourtTerme()

    // Affichage si il y en a
    if (titresCourtTerme.length > 0) afficherTitresCourtTerme(titresCourtTerme)
}


// -----------//
// toggle map //
// -----------//

// Configure le bouton pour afficher / cacher la carte
function configurerBasculeCarte() {

    // Bouton carte
    let bouton = document.getElementById("toggleMapBtn")

    // Au clic on bascule la carte
    bouton.addEventListener("click", basculerCarte)
}
// Affiche ou cache la carte
function basculerCarte() {

    // Section de la carte
    let sectionCarte = document.getElementById("mapSection")

    // Toggle hidden
    sectionCarte.classList.toggle("hidden")

    // Si la carte est cachée on fait rien
    if (sectionCarte.classList.contains("hidden")) return

    // Initialisation de la carte
    initialiserCarte()

    // Petit delai pour corriger la taille
    setTimeout(redimensionnerCarte, 300)
}


// -----------------//
// gyroscope bouton //
// -----------------//
function configurerBoutonGyroscope() {
    let bouton = document.getElementById("gyroscopeBtn")
    bouton.addEventListener("click", basculerGyroscope)
}

function basculerGyroscope() {
    let section = document.getElementById("gyroSection")
    section.classList.toggle("hidden")
    if (section.classList.contains("hidden")) return // si gyroSection a la class hidden alors la fonction s'arrete
    demarrerPlaylistGyroscope()
}

// ----------------------------------//
// liste des playlists geolocalisees //
// ----------------------------------//
function mettreAJourListePlaylists() {
    let liste = document.getElementById("playlistListContent")
    liste.innerHTML = ""

    for (let i = 0; i < historiquePlaylists.length; i++) {
        let p = historiquePlaylists[i]

        let element = document.createElement("li")
        element.style.marginBottom = "10px"

        element.innerHTML =
            "<strong>" + p.name + "</strong><br>" +
            p.desc + "<br>" +
            "<a href='" + p.url + "' target='_blank'>ouvrir dans spotify</a> | "
        liste.appendChild(element)
    }

}

// ---------------------------//
// initialisation window load //
// ---------------------------//
window.addEventListener("load", auChargementFenetre) // qd la page est chargee on appelle la fonction

async function auChargementFenetre() {

    document.getElementById("loginSpotifyBtn").addEventListener("click", loginSpotify);

    await initialiserSpotify() // init du token

    configurerBasculePlaylist();
    configurerGenererPlaylist();
    configurerBasculeTableau();
    configurerBasculeCarte();
    configurerCurseurNombreTitres();
    configurerBoutonGyroscope();
    initialiserMenuBurger();

    // si pas connecté on s'arrete la
    if (!token) {
        console.log("pas connecté a spotify")
        return
    }

    // tableaux tracks
    let titres = await recupererTopTitres()
    if (titres.length > 0) {
        afficherTitresDansTableau(titres)
    }

    let titresCourts = await recupererTopTitresCourtTerme()
    if (titresCourts.length > 0) {
        afficherTitresCourtTerme(titresCourts)
    }
}


// -------------//
// init spotify //
// -------------//
async function initialiserSpotify() {
    await extraireTokenDepuisUrl() // verifie si token dans l'url
}
