// ----- Buttons -----
const INSTALL_BUTTON = document.getElementById("install_button");
const RELOAD_BUTTON = document.getElementById("reload_button");
const TEXT_INSTALL = document.getElementById("text_install");


if (INSTALL_BUTTON) INSTALL_BUTTON.addEventListener("click", installPwa);
if (RELOAD_BUTTON) RELOAD_BUTTON.addEventListener("click", reloadPwa);

/******************************************************************************/
/* Main                                                                       */
/******************************************************************************/

main();

function main() {
    console.debug("main()");

    if (window.matchMedia("(display-mode: standalone)").matches) {
        console.log("Running as PWA");

        registerServiceWorker();
    } else {
        console.log("Running as Web page");

        window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.addEventListener("appinstalled", onAppInstalled);
    }
}

/******************************************************************************/
/* Install PWA                                                                */
/******************************************************************************/

let beforeInstallPromptEvent;

// Fonction qui est appelée lorsque l'événement `beforeinstallprompt` est déclenché
function onBeforeInstallPrompt(event) {
    console.debug("onBeforeInstallPrompt()");

    event.preventDefault();  // Empêche l'affichage automatique de la bannière d'installation
    INSTALL_BUTTON.disabled = false;  // Rend le bouton d'installation cliquable
    // Enregistre l'événement pour l'utiliser plus tard
    beforeInstallPromptEvent = event;
}

// Fonction qui est appelée pour installer la PWA
async function installPwa() {
    console.debug("installPwa()");

    const result = await beforeInstallPromptEvent.prompt();  // Affiche la bannière d'installation

    switch (result.outcome) {
        case "accepted":
            console.log("PWA Install accepted");
            break;
        case "dismissed":
            console.log("PWA Install dismissed");
            break;
    }

    INSTALL_BUTTON.disabled = true;  // Désactive le bouton après l'interaction
    TEXT_INSTALL.classList.add("hidden");
    // Supprime l'écouteur d'événement pour l'install
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
}

/**************************************/

function onAppInstalled() {
    console.debug("onAppInstalled()");

    registerServiceWorker();  // Enregistre le service worker si l'application est installée
}

/*****************************************************************************/
/* Register Service Worker                                                   */
/*****************************************************************************/

async function registerServiceWorker() {
    console.debug("[PWA] registerServiceWorker()");

    if (!("serviceWorker" in navigator)) {
        console.warn("[PWA] Service Workers not supported");
        return;
    }

    try {
        console.log("[PWA] Registering Service Worker…");
        const registration = await navigator.serviceWorker.register("./service_worker.js");

        console.log("[PWA] Service Worker registered with scope:", registration.scope);

        // Surveille les mises à jour du service worker
        registration.addEventListener("updatefound", function() {
            onUpdateFound(registration);
        });
    } catch (error) {
        console.error("[PWA] Service Worker registration failed:", error);
    }
}

/*****************************************************************************/
/* Update Handling                                                           */
/*****************************************************************************/

function onUpdateFound(registration) {
    console.debug("[PWA] Update found");

    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", function() {
        onStateChange(newWorker);
    });
}

function onStateChange(serviceWorker) {
    console.debug("[PWA] State changed:", serviceWorker.state);

    if (serviceWorker.state === "installed" && navigator.serviceWorker.controller) {
        console.log("[PWA] New version available");
        RELOAD_BUTTON.style.display = "inline-block";  // Affiche le bouton de rechargement
        RELOAD_BUTTON.disabled = false;
    }
}

/*****************************************************************************/
/* Reload PWA                                                                */
/*****************************************************************************/

function reloadPwa() {
    console.debug("[PWA] reloadPwa()");
    window.location.reload();  // Recharge la page pour appliquer la mise à jour du service worker
}
