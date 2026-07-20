import { registerSW } from "virtual:pwa-register";

/*------------------------------------------------*/
/* Types                                          */
/*------------------------------------------------*/

type UpdateFunction = (
  reloadPage?: boolean,
) => Promise<void>;

/*------------------------------------------------*/
/* État                                           */
/*------------------------------------------------*/

let currentNotice:
  HTMLDivElement | null = null;

let updateServiceWorker:
  UpdateFunction = async () => {};

/*------------------------------------------------*/
/* Styles                                         */
/*------------------------------------------------*/

function installNoticeStyles(): void {
  if (
    document.querySelector(
      "#pwa-update-styles",
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id = "pwa-update-styles";

  style.textContent = `
    .pwa-notice {
      position: fixed;
      z-index: 2000;
      right: 16px;
      bottom: 16px;
      left: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: min(620px, calc(100% - 32px));
      padding: 15px 16px;
      margin: 0 auto;
      color: #f1f3f5;
      background: #151515;
      border: 1px solid #4f8cff;
      border-radius: 13px;
      box-shadow:
        0 18px 50px
        rgb(0 0 0 / 75%);
    }

    .pwa-notice-content {
      min-width: 0;
    }

    .pwa-notice-title {
      margin: 0 0 4px;
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 750;
    }

    .pwa-notice-message {
      margin: 0;
      color: #b9b9b9;
      font-size: 0.82rem;
      line-height: 1.4;
    }

    .pwa-notice-actions {
      display: flex;
      flex-shrink: 0;
      gap: 8px;
    }

    .pwa-notice-button {
      min-height: 40px;
      padding: 9px 13px;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 700;
      border-radius: 9px;
      cursor: pointer;
    }

    .pwa-notice-button-primary {
      color: #ffffff;
      background: #326ed8;
      border: 1px solid #4f8cff;
    }

    .pwa-notice-button-primary:hover {
      background: #3e7bea;
    }

    .pwa-notice-button-secondary {
      color: #d0d0d0;
      background: #242424;
      border: 1px solid #424242;
    }

    .pwa-notice-button-secondary:hover {
      color: #ffffff;
      background: #303030;
    }

    @media (max-width: 560px) {
      .pwa-notice {
        align-items: stretch;
        flex-direction: column;
        gap: 12px;
      }

      .pwa-notice-actions {
        width: 100%;
      }

      .pwa-notice-button {
        flex: 1;
      }
    }
  `;

  document.head.appendChild(style);
}

/*------------------------------------------------*/
/* Fermeture                                      */
/*------------------------------------------------*/

function closeNotice(): void {
  currentNotice?.remove();
  currentNotice = null;
}

/*------------------------------------------------*/
/* Notification générique                         */
/*------------------------------------------------*/

function createNotice(
  title: string,
  message: string,
): HTMLDivElement {
  closeNotice();
  installNoticeStyles();

  const notice =
    document.createElement("div");

  notice.className = "pwa-notice";
  notice.setAttribute("role", "status");
  notice.setAttribute(
    "aria-live",
    "polite",
  );

  const content =
    document.createElement("div");

  content.className =
    "pwa-notice-content";

  const titleElement =
    document.createElement("p");

  titleElement.className =
    "pwa-notice-title";

  titleElement.textContent = title;

  const messageElement =
    document.createElement("p");

  messageElement.className =
    "pwa-notice-message";

  messageElement.textContent = message;

  const actions =
    document.createElement("div");

  actions.className =
    "pwa-notice-actions";

  content.append(
    titleElement,
    messageElement,
  );

  notice.append(
    content,
    actions,
  );

  currentNotice = notice;

  return notice;
}

/*------------------------------------------------*/
/* Nouvelle version                               */
/*------------------------------------------------*/

function showUpdateNotice(): void {
  const notice = createNotice(
    "Nouvelle version disponible",
    "Enregistre toute observation en cours, puis lance la mise à jour.",
  );

  const actions =
    notice.querySelector<HTMLDivElement>(
      ".pwa-notice-actions",
    )!;

  const laterButton =
    document.createElement("button");

  laterButton.type = "button";

  laterButton.className =
    "pwa-notice-button " +
    "pwa-notice-button-secondary";

  laterButton.textContent =
    "Plus tard";

  laterButton.addEventListener(
    "click",
    closeNotice,
  );

  const updateButton =
    document.createElement("button");

  updateButton.type = "button";

  updateButton.className =
    "pwa-notice-button " +
    "pwa-notice-button-primary";

  updateButton.textContent =
    "Mettre à jour";

  updateButton.addEventListener(
    "click",
    () => {
      updateButton.disabled = true;

      updateButton.textContent =
        "Mise à jour…";

      void updateServiceWorker(true);
    },
  );

  actions.append(
    laterButton,
    updateButton,
  );

  document.body.appendChild(notice);
}

/*------------------------------------------------*/
/* Mode hors connexion                            */
/*------------------------------------------------*/

function showOfflineReadyNotice(): void {
  const notice = createNotice(
    "Application prête",
    "La vie de Maia peut maintenant fonctionner hors connexion.",
  );

  const actions =
    notice.querySelector<HTMLDivElement>(
      ".pwa-notice-actions",
    )!;

  const closeButton =
    document.createElement("button");

  closeButton.type = "button";

  closeButton.className =
    "pwa-notice-button " +
    "pwa-notice-button-primary";

  closeButton.textContent = "OK";

  closeButton.addEventListener(
    "click",
    closeNotice,
  );

  actions.appendChild(closeButton);

  document.body.appendChild(notice);
}

/*------------------------------------------------*/
/* Enregistrement du service worker               */
/*------------------------------------------------*/

updateServiceWorker = registerSW({
  immediate: true,

  onNeedRefresh() {
    showUpdateNotice();
  },

  onOfflineReady() {
    showOfflineReadyNotice();
  },

  onRegisterError(error) {
    console.error(
      "Erreur d’enregistrement de la PWA :",
      error,
    );
  },
});