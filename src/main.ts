import "./style.css";

/*------------------------------------------------*/
/* Types                                          */
/*------------------------------------------------*/

type Category =
  | "Propreté"
  | "Sommeil"
  | "Santé"
  | "Comportement"
  | "Alimentation"
  | "Transmission"
  | "Autre";

type Observation = {
  id: string;
  observedAt: string;
  createdAt: string;
  modifiedAt?: string;
  category: Category;
  context: string;
  fact: string;
  exactWords: string;
  interpretation: string;
};

type BackupFile = {
  application: string;
  version: number;
  exportedAt: string;
  observationCount: number;
  observations: Observation[];
};

type MergeResult = {
  observations: Observation[];
  added: number;
  updated: number;
  unchanged: number;
};

/*------------------------------------------------*/
/* Constantes                                     */
/*------------------------------------------------*/

const STORAGE_KEY = "childtrack_observations_v1";
const MAX_IMPORT_SIZE = 10 * 1024 * 1024;

const categories: Category[] = [
  "Propreté",
  "Sommeil",
  "Santé",
  "Comportement",
  "Alimentation",
  "Transmission",
  "Autre",
];

document.title = "La vie de Maia 🐝";

/*------------------------------------------------*/
/* Stockage                                       */
/*------------------------------------------------*/

function loadObservations(): Observation[] {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);

    if (!storedData) {
      return [];
    }

    const parsedData = JSON.parse(storedData);

    return Array.isArray(parsedData) ? parsedData : [];
  } catch (error) {
    console.error("Impossible de lire les observations :", error);
    return [];
  }
}

function saveObservations(
  observationsToSave: Observation[],
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(observationsToSave),
  );
}

/*------------------------------------------------*/
/* Utilitaires                                    */
/*------------------------------------------------*/

function createId(): string {
  if ("randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function getDateTimeLocalValue(
  dateValue?: string,
): string {
  const date = dateValue
    ? new Date(dateValue)
    : new Date();

  const timezoneOffset =
    date.getTimezoneOffset() * 60_000;

  return new Date(
    date.getTime() - timezoneOffset,
  )
    .toISOString()
    .slice(0, 16);
}

function getLocalDateKey(
  dateValue: string,
): string {
  const date = new Date(dateValue);

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(
  dateValue: string,
): Date {
  const [year, month, day] = dateValue
    .split("-")
    .map((part) => Number(part));

  return new Date(year, month - 1, day);
}

function getObservationDayTimestamp(
  dateValue: string,
): number {
  const date = new Date(dateValue);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function getObservationRevisionTimestamp(
  observation: Observation,
): number {
  const revisionDate =
    observation.modifiedAt ??
    observation.createdAt;

  return new Date(revisionDate).getTime();
}

function formatDate(
  dateValue: string,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function formatShortDate(
  dateValue: string,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

function formatSearchDate(
  dateValue: string,
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
  }).format(parseLocalDate(dateValue));
}

function normaliseText(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidDate(
  value: string,
): boolean {
  return !Number.isNaN(
    new Date(value).getTime(),
  );
}

function isCategory(
  value: unknown,
): value is Category {
  return (
    typeof value === "string" &&
    categories.includes(value as Category)
  );
}

function isObservation(
  value: unknown,
): value is Observation {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Partial<Observation>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&

    typeof candidate.observedAt === "string" &&
    isValidDate(candidate.observedAt) &&

    typeof candidate.createdAt === "string" &&
    isValidDate(candidate.createdAt) &&

    (
      candidate.modifiedAt === undefined ||
      (
        typeof candidate.modifiedAt === "string" &&
        isValidDate(candidate.modifiedAt)
      )
    ) &&

    isCategory(candidate.category) &&

    typeof candidate.context === "string" &&
    typeof candidate.fact === "string" &&
    typeof candidate.exactWords === "string" &&
    typeof candidate.interpretation === "string"
  );
}

/*------------------------------------------------*/
/* Import et fusion                               */
/*------------------------------------------------*/

function deduplicateObservations(
  observationsToDeduplicate: Observation[],
): Observation[] {
  const observationsById =
    new Map<string, Observation>();

  for (
    const observation
    of observationsToDeduplicate
  ) {
    const existingObservation =
      observationsById.get(observation.id);

    if (!existingObservation) {
      observationsById.set(
        observation.id,
        observation,
      );

      continue;
    }

    if (
      getObservationRevisionTimestamp(
        observation,
      ) >
      getObservationRevisionTimestamp(
        existingObservation,
      )
    ) {
      observationsById.set(
        observation.id,
        observation,
      );
    }
  }

  return [...observationsById.values()];
}

function parseBackupFile(
  content: string,
): Observation[] {
  let parsedData: unknown;

  try {
    parsedData = JSON.parse(content);
  } catch {
    throw new Error(
      "Le fichier sélectionné ne contient pas un JSON valide.",
    );
  }

  if (
    typeof parsedData !== "object" ||
    parsedData === null
  ) {
    throw new Error(
      "Le fichier ne correspond pas à une sauvegarde valide.",
    );
  }

  const backup =
    parsedData as Partial<BackupFile>;

  const acceptedApplicationNames = [
    "La vie de Maia",
    "ChildTrack",
  ];

  if (
    typeof backup.application !== "string" ||
    !acceptedApplicationNames.includes(
      backup.application,
    )
  ) {
    throw new Error(
      "Cette sauvegarde ne provient pas de La vie de Maia.",
    );
  }

  if (backup.version !== 1) {
    throw new Error(
      "Cette version de sauvegarde n’est pas prise en charge.",
    );
  }

  if (!Array.isArray(backup.observations)) {
    throw new Error(
      "La liste des observations est absente ou incorrecte.",
    );
  }

  if (
    !backup.observations.every(
      isObservation,
    )
  ) {
    throw new Error(
      "Certaines observations du fichier sont invalides.",
    );
  }

  return deduplicateObservations(
    backup.observations,
  );
}

function mergeObservations(
  existingObservations: Observation[],
  importedObservations: Observation[],
): MergeResult {
  const mergedById =
    new Map<string, Observation>();

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (
    const observation
    of existingObservations
  ) {
    mergedById.set(
      observation.id,
      observation,
    );
  }

  for (
    const importedObservation
    of importedObservations
  ) {
    const existingObservation =
      mergedById.get(
        importedObservation.id,
      );

    if (!existingObservation) {
      mergedById.set(
        importedObservation.id,
        importedObservation,
      );

      added += 1;
      continue;
    }

    const importedRevision =
      getObservationRevisionTimestamp(
        importedObservation,
      );

    const existingRevision =
      getObservationRevisionTimestamp(
        existingObservation,
      );

    if (
      importedRevision >
      existingRevision
    ) {
      mergedById.set(
        importedObservation.id,
        importedObservation,
      );

      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  return {
    observations: [
      ...mergedById.values(),
    ],
    added,
    updated,
    unchanged,
  };
}

/*------------------------------------------------*/
/* État de l’application                          */
/*------------------------------------------------*/

let observations = loadObservations();

let activeCategory: Category =
  "Propreté";

let editingObservationId:
  string | null = null;

let pendingImportedObservations:
  Observation[] = [];

/*------------------------------------------------*/
/* Interface                                      */
/*------------------------------------------------*/

document.querySelector<HTMLDivElement>(
  "#app",
)!.innerHTML = `
  <header class="app-header">
    <div class="app-title">
      <p class="app-kicker">
        Journal d’observations
      </p>

      <h1>
        La vie de Maia
        <span aria-hidden="true">🐝</span>
      </h1>
    </div>

    <div class="header-actions">
      <button
        id="import-button"
        class="secondary-button"
        type="button"
      >
        Importer
      </button>

      <input
        id="import-file-input"
        class="hidden-file-input"
        type="file"
        accept=".json,application/json"
      >

      <button
        id="export-button"
        class="secondary-button"
        type="button"
      >
        Exporter
      </button>
    </div>
  </header>

  <main class="app-main">
    <nav
      id="category-navigation"
      class="category-navigation"
      aria-label="Catégories"
    ></nav>

    <div class="new-observation-bar">
      <button
        id="open-form-button"
        class="primary-button new-observation-button"
        type="button"
      >
        + Nouvelle observation
      </button>
    </div>

    <section class="tools-section">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            Recherche
          </p>

          <h2>
            Rechercher dans la catégorie
          </h2>
        </div>

        <button
          id="clear-filters-button"
          class="text-button"
          type="button"
        >
          Effacer
        </button>
      </div>

      <div class="search-grid">
        <label>
          Date recherchée

          <input
            id="search-date"
            type="date"
          >
        </label>

        <label>
          Mot-clé

          <input
            id="search-keyword"
            type="search"
            placeholder="Ex. peur, caca, sommeil..."
            autocomplete="off"
          >
        </label>
      </div>

      <p
        id="search-status"
        class="search-status"
      ></p>
    </section>

    <section
      id="observation-form-section"
      class="form-section hidden"
    >
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            Saisie
          </p>

          <h2 id="form-title">
            Ajouter une observation
          </h2>
        </div>

        <button
          id="close-form-button"
          class="text-button"
          type="button"
        >
          Fermer
        </button>
      </div>

      <form id="observation-form">
        <div class="form-grid">
          <label>
            Date et heure

            <input
              id="observed-at"
              name="observedAt"
              type="datetime-local"
              required
            >
          </label>

          <label>
            Catégorie

            <select
              id="category-select"
              name="category"
              required
            >
              ${categories
                .map(
                  (category) => `
                    <option value="${category}">
                      ${category}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
        </div>

        <label>
          Contexte

          <select
            id="context-select"
            name="context"
          >
            <option value="">
              Non précisé
            </option>

            <option value="Maison">
              Maison
            </option>

            <option value="Assistante maternelle">
              Assistante maternelle
            </option>

            <option value="Avant un DVH">
              Avant un DVH
            </option>

            <option value="Retour de DVH">
              Retour de DVH
            </option>

            <option value="Chez le médecin">
              Chez le médecin
            </option>

            <option value="Extérieur">
              Extérieur
            </option>

            <option value="Autre">
              Autre
            </option>
          </select>
        </label>

        <label>
          Fait observé

          <textarea
            id="fact-input"
            name="fact"
            rows="4"
            required
            placeholder="Décrire uniquement ce qui a été constaté."
          ></textarea>
        </label>

        <label>
          Paroles exactes

          <textarea
            id="exact-words-input"
            name="exactWords"
            rows="2"
            placeholder="Exemple : « peur caca »"
          ></textarea>
        </label>

        <label>
          Interprétation éventuelle

          <textarea
            id="interpretation-input"
            name="interpretation"
            rows="3"
            placeholder="Séparer clairement l’hypothèse du fait observé."
          ></textarea>
        </label>

        <div class="form-actions">
          <button
            id="submit-form-button"
            class="primary-button"
            type="submit"
          >
            Enregistrer
          </button>

          <button
            id="cancel-form-button"
            class="secondary-button"
            type="button"
          >
            Annuler
          </button>
        </div>
      </form>
    </section>

    <section class="timeline-section">
      <div class="section-heading">
        <div>
          <p class="section-kicker">
            Historique par catégorie
          </p>

          <h2 id="current-category-title">
          </h2>
        </div>

        <span
          id="observation-count"
          class="counter"
        ></span>
      </div>

      <div
        id="observation-list"
        class="observation-list"
      ></div>
    </section>
  </main>

  <div
    id="import-dialog"
    class="import-dialog hidden"
    role="dialog"
    aria-modal="true"
    aria-labelledby="import-dialog-title"
  >
    <div class="import-dialog-panel">
      <p class="section-kicker">
        Restauration
      </p>

      <h2 id="import-dialog-title">
        Importer la sauvegarde
      </h2>

      <p
        id="import-summary"
        class="import-summary"
      ></p>

      <div
        id="import-details"
        class="import-details"
      ></div>

      <div class="import-warning">
        <strong>Fusionner</strong>

        <span>
          Conserve les observations déjà
          présentes et ajoute les nouvelles.
        </span>

        <strong>Remplacer</strong>

        <span>
          Supprime les données actuelles
          avant de restaurer le fichier.
        </span>
      </div>

      <div class="import-actions">
        <button
          id="merge-import-button"
          class="primary-button"
          type="button"
        >
          Fusionner
        </button>

        <button
          id="replace-import-button"
          class="danger-button"
          type="button"
        >
          Remplacer
        </button>

        <button
          id="cancel-import-button"
          class="secondary-button"
          type="button"
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
`;

/*------------------------------------------------*/
/* Références DOM                                 */
/*------------------------------------------------*/

const formSection =
  document.querySelector<HTMLElement>(
    "#observation-form-section",
  )!;

const observationForm =
  document.querySelector<HTMLFormElement>(
    "#observation-form",
  )!;

const formTitle =
  document.querySelector<HTMLHeadingElement>(
    "#form-title",
  )!;

const submitFormButton =
  document.querySelector<HTMLButtonElement>(
    "#submit-form-button",
  )!;

const observationList =
  document.querySelector<HTMLDivElement>(
    "#observation-list",
  )!;

const observationCount =
  document.querySelector<HTMLSpanElement>(
    "#observation-count",
  )!;

const observedAtInput =
  document.querySelector<HTMLInputElement>(
    "#observed-at",
  )!;

const categorySelect =
  document.querySelector<HTMLSelectElement>(
    "#category-select",
  )!;

const contextSelect =
  document.querySelector<HTMLSelectElement>(
    "#context-select",
  )!;

const factInput =
  document.querySelector<HTMLTextAreaElement>(
    "#fact-input",
  )!;

const exactWordsInput =
  document.querySelector<HTMLTextAreaElement>(
    "#exact-words-input",
  )!;

const interpretationInput =
  document.querySelector<HTMLTextAreaElement>(
    "#interpretation-input",
  )!;

const categoryNavigation =
  document.querySelector<HTMLElement>(
    "#category-navigation",
  )!;

const currentCategoryTitle =
  document.querySelector<HTMLHeadingElement>(
    "#current-category-title",
  )!;

const searchDateInput =
  document.querySelector<HTMLInputElement>(
    "#search-date",
  )!;

const searchKeywordInput =
  document.querySelector<HTMLInputElement>(
    "#search-keyword",
  )!;

const searchStatus =
  document.querySelector<HTMLParagraphElement>(
    "#search-status",
  )!;

const exportButton =
  document.querySelector<HTMLButtonElement>(
    "#export-button",
  )!;

const importButton =
  document.querySelector<HTMLButtonElement>(
    "#import-button",
  )!;

const importFileInput =
  document.querySelector<HTMLInputElement>(
    "#import-file-input",
  )!;

const importDialog =
  document.querySelector<HTMLDivElement>(
    "#import-dialog",
  )!;

const importSummary =
  document.querySelector<HTMLParagraphElement>(
    "#import-summary",
  )!;

const importDetails =
  document.querySelector<HTMLDivElement>(
    "#import-details",
  )!;

/*------------------------------------------------*/
/* Catégories                                     */
/*------------------------------------------------*/

function getCategoryCount(
  category: Category,
): number {
  return observations.filter(
    (observation) =>
      observation.category === category,
  ).length;
}

function renderCategoryNavigation(): void {
  categoryNavigation.innerHTML =
    categories
      .map((category) => {
        const isActive =
          category === activeCategory;

        const count =
          getCategoryCount(category);

        return `
          <button
            class="category-button ${
              isActive ? "active" : ""
            }"
            type="button"
            data-category="${category}"
            aria-pressed="${isActive}"
          >
            <span>${category}</span>

            <span class="category-count">
              ${count}
            </span>
          </button>
        `;
      })
      .join("");

  document
    .querySelectorAll<HTMLButtonElement>(
      "[data-category]",
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const category = button.dataset.category as Category | undefined;

          if (!category) {
            return;
          }

          activeCategory = category;

          renderCategoryNavigation();
          renderObservations();
        },
      );
    });
}

/*------------------------------------------------*/
/* Formulaire                                     */
/*------------------------------------------------*/

function openNewObservationForm(): void {
  editingObservationId = null;

  observationForm.reset();

  formTitle.textContent =
    "Ajouter une observation";

  submitFormButton.textContent =
    "Enregistrer";

  observedAtInput.value =
    getDateTimeLocalValue();

  categorySelect.value =
    activeCategory;

  formSection.classList.remove(
    "hidden",
  );

  formSection.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function openEditObservationForm(
  id: string,
): void {
  const observation =
    observations.find(
      (item) => item.id === id,
    );

  if (!observation) {
    return;
  }

  editingObservationId =
    observation.id;

  activeCategory =
    observation.category;

  formTitle.textContent =
    "Modifier l’observation";

  submitFormButton.textContent =
    "Enregistrer les modifications";

  observedAtInput.value =
    getDateTimeLocalValue(
      observation.observedAt,
    );

  categorySelect.value =
    observation.category;

  contextSelect.value =
    observation.context;

  factInput.value =
    observation.fact;

  exactWordsInput.value =
    observation.exactWords;

  interpretationInput.value =
    observation.interpretation;

  renderCategoryNavigation();
  renderObservations();

  formSection.classList.remove(
    "hidden",
  );

  formSection.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function closeForm(): void {
  editingObservationId = null;

  observationForm.reset();

  formTitle.textContent =
    "Ajouter une observation";

  submitFormButton.textContent =
    "Enregistrer";

  formSection.classList.add(
    "hidden",
  );
}

/*------------------------------------------------*/
/* Suppression                                    */
/*------------------------------------------------*/

function deleteObservation(
  id: string,
): void {
  const confirmed =
    window.confirm(
      "Supprimer définitivement cette observation ?",
    );

  if (!confirmed) {
    return;
  }

  observations =
    observations.filter(
      (observation) =>
        observation.id !== id,
    );

  saveObservations(observations);

  renderCategoryNavigation();
  renderObservations();

  if (
    editingObservationId === id
  ) {
    closeForm();
  }
}

/*------------------------------------------------*/
/* Recherche                                      */
/*------------------------------------------------*/

function observationMatchesKeyword(
  observation: Observation,
  keyword: string,
): boolean {
  if (!keyword) {
    return true;
  }

  const searchableText =
    normaliseText(
      [
        observation.context,
        observation.fact,
        observation.exactWords,
        observation.interpretation,
      ].join(" "),
    );

  return searchableText.includes(
    keyword,
  );
}

function getFilteredObservations(): {
  categoryTotal: number;
  filteredObservations: Observation[];
  statusMessage: string;
} {
  const categoryObservations =
    observations
      .filter(
        (observation) =>
          observation.category ===
          activeCategory,
      )
      .sort(
        (first, second) =>
          new Date(
            second.observedAt,
          ).getTime() -
          new Date(
            first.observedAt,
          ).getTime(),
      );

  const keyword =
    normaliseText(
      searchKeywordInput.value,
    );

  const keywordFiltered =
    categoryObservations.filter(
      (observation) =>
        observationMatchesKeyword(
          observation,
          keyword,
        ),
    );

  const searchedDate =
    searchDateInput.value;

  if (!searchedDate) {
    const statusMessage =
      keyword
        ? `${keywordFiltered.length} résultat(s) contenant « ${searchKeywordInput.value.trim()} ».`
        : "";

    return {
      categoryTotal:
        categoryObservations.length,

      filteredObservations:
        keywordFiltered,

      statusMessage,
    };
  }

  const exactDateObservations =
    keywordFiltered.filter(
      (observation) =>
        getLocalDateKey(
          observation.observedAt,
        ) === searchedDate,
    );

  if (
    exactDateObservations.length > 0
  ) {
    return {
      categoryTotal:
        categoryObservations.length,

      filteredObservations:
        exactDateObservations,

      statusMessage:
        `${exactDateObservations.length} observation(s) trouvée(s) ` +
        `le ${formatSearchDate(searchedDate)}.`,
    };
  }

  if (
    keywordFiltered.length === 0
  ) {
    return {
      categoryTotal:
        categoryObservations.length,

      filteredObservations: [],

      statusMessage:
        keyword.length > 0
          ? "Aucune observation ne correspond à cette date et à ce mot-clé."
          : "Aucune observation disponible dans cette catégorie.",
    };
  }

  const searchedTimestamp =
    parseLocalDate(
      searchedDate,
    ).getTime();

  let nearestDateKey = "";

  let nearestDistance =
    Number.POSITIVE_INFINITY;

  for (
    const observation
    of keywordFiltered
  ) {
    const observationTimestamp =
      getObservationDayTimestamp(
        observation.observedAt,
      );

    const distance =
      Math.abs(
        observationTimestamp -
        searchedTimestamp,
      );

    if (
      distance < nearestDistance
    ) {
      nearestDistance = distance;

      nearestDateKey =
        getLocalDateKey(
          observation.observedAt,
        );
    }
  }

  const nearestObservations =
    keywordFiltered.filter(
      (observation) =>
        getLocalDateKey(
          observation.observedAt,
        ) === nearestDateKey,
    );

  return {
    categoryTotal:
      categoryObservations.length,

    filteredObservations:
      nearestObservations,

    statusMessage:
      `Aucune observation le ${formatSearchDate(searchedDate)}. ` +
      `Affichage de la date la plus proche : ` +
      `${formatSearchDate(nearestDateKey)}.`,
  };
}

/*------------------------------------------------*/
/* Affichage des observations                     */
/*------------------------------------------------*/

function renderObservations(): void {
  const {
    categoryTotal,
    filteredObservations,
    statusMessage,
  } = getFilteredObservations();

  currentCategoryTitle.textContent =
    activeCategory;

  searchStatus.textContent =
    statusMessage;

  const filtersAreActive =
    Boolean(searchDateInput.value) ||
    Boolean(
      searchKeywordInput.value.trim(),
    );

  if (filtersAreActive) {
    observationCount.textContent =
      `${filteredObservations.length} / ${categoryTotal}`;
  } else {
    observationCount.textContent =
      categoryTotal === 1
        ? "1 observation"
        : `${categoryTotal} observations`;
  }

  if (
    filteredObservations.length === 0
  ) {
    observationList.innerHTML = `
      <div class="empty-state">
        <h3>Aucun résultat</h3>

        <p>
          Modifie les critères de recherche
          ou efface les filtres.
        </p>
      </div>
    `;

    return;
  }

  observationList.innerHTML =
    filteredObservations
      .map(
        (observation) => `
          <article class="observation-card">
            <div class="observation-card-header">
              <div class="observation-heading">
                <h3>
                  ${escapeHtml(
                    formatDate(
                      observation.observedAt,
                    ),
                  )}
                </h3>

                ${
                  observation.context
                    ? `
                      <p class="context">
                        ${escapeHtml(
                          observation.context,
                        )}
                      </p>
                    `
                    : ""
                }

                ${
                  observation.modifiedAt
                    ? `
                      <p class="modified-date">
                        Modifiée le
                        ${escapeHtml(
                          formatShortDate(
                            observation.modifiedAt,
                          ),
                        )}
                      </p>
                    `
                    : ""
                }
              </div>

              <div class="card-actions">
                <button
                  class="edit-button"
                  type="button"
                  data-edit-id="${escapeHtml(
                    observation.id,
                  )}"
                >
                  Modifier
                </button>

                <button
                  class="delete-button"
                  type="button"
                  data-delete-id="${escapeHtml(
                    observation.id,
                  )}"
                >
                  Supprimer
                </button>
              </div>
            </div>

            <div class="observation-content">
              <section>
                <h4>Fait observé</h4>

                <p>
                  ${escapeHtml(
                    observation.fact,
                  )}
                </p>
              </section>

              ${
                observation.exactWords
                  ? `
                    <section>
                      <h4>
                        Paroles exactes
                      </h4>

                      <blockquote>
                        ${escapeHtml(
                          observation.exactWords,
                        )}
                      </blockquote>
                    </section>
                  `
                  : ""
              }

              ${
                observation.interpretation
                  ? `
                    <section class="interpretation">
                      <h4>
                        Interprétation éventuelle
                      </h4>

                      <p>
                        ${escapeHtml(
                          observation.interpretation,
                        )}
                      </p>
                    </section>
                  `
                  : ""
              }
            </div>
          </article>
        `,
      )
      .join("");

  document
    .querySelectorAll<HTMLButtonElement>(
      "[data-edit-id]",
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const id =
            button.dataset.editId;

          if (id) {
            openEditObservationForm(id);
          }
        },
      );
    });

  document
    .querySelectorAll<HTMLButtonElement>(
      "[data-delete-id]",
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const id =
            button.dataset.deleteId;

          if (id) {
            deleteObservation(id);
          }
        },
      );
    });
}

/*------------------------------------------------*/
/* Export                                         */
/*------------------------------------------------*/

function exportBackup(): void {
  const backup: BackupFile = {
    application:
      "La vie de Maia",

    version: 1,

    exportedAt:
      new Date().toISOString(),

    observationCount:
      observations.length,

    observations,
  };

  const jsonContent =
    JSON.stringify(
      backup,
      null,
      2,
    );

  const blob =
    new Blob(
      [jsonContent],
      {
        type:
          "application/json;charset=utf-8",
      },
    );

  const downloadUrl =
    URL.createObjectURL(blob);

  const today =
    getLocalDateKey(
      new Date().toISOString(),
    );

  const downloadLink =
    document.createElement("a");

  downloadLink.href =
    downloadUrl;

  downloadLink.download =
    `la-vie-de-maia-sauvegarde-${today}.json`;

  document.body.appendChild(
    downloadLink,
  );

  downloadLink.click();
  downloadLink.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(
      downloadUrl,
    );
  }, 1000);

  const initialText =
    exportButton.textContent ??
    "Exporter";

  exportButton.textContent =
    "Exporté ✓";

  exportButton.disabled = true;

  window.setTimeout(() => {
    exportButton.textContent =
      initialText;

    exportButton.disabled = false;
  }, 1500);
}

/*------------------------------------------------*/
/* Import                                         */
/*------------------------------------------------*/

function getImportedCategorySummary(
  importedObservations: Observation[],
): string {
  return categories
    .map((category) => {
      const count =
        importedObservations.filter(
          (observation) =>
            observation.category ===
            category,
        ).length;

      return count > 0
        ? `
          <div class="import-category-line">
            <span>
              ${escapeHtml(category)}
            </span>

            <strong>${count}</strong>
          </div>
        `
        : "";
    })
    .join("");
}

function openImportDialog(
  fileName: string,
  importedObservations: Observation[],
): void {
  pendingImportedObservations =
    importedObservations;

  const existingIds =
    new Set(
      observations.map(
        (observation) =>
          observation.id,
      ),
    );

  const duplicateCount =
    importedObservations.filter(
      (observation) =>
        existingIds.has(
          observation.id,
        ),
    ).length;

  const newCount =
    importedObservations.length -
    duplicateCount;

  importSummary.textContent =
    `${fileName} contient ` +
    `${importedObservations.length} observation(s).`;

  importDetails.innerHTML = `
    <div class="import-statistics">
      <div>
        <span>Nouvelles</span>
        <strong>${newCount}</strong>
      </div>

      <div>
        <span>Déjà présentes</span>
        <strong>${duplicateCount}</strong>
      </div>

      <div>
        <span>Données actuelles</span>
        <strong>${observations.length}</strong>
      </div>
    </div>

    <div class="import-category-summary">
      ${getImportedCategorySummary(
        importedObservations,
      )}
    </div>
  `;

  importDialog.classList.remove(
    "hidden",
  );
}

function closeImportDialog(): void {
  pendingImportedObservations = [];

  importDialog.classList.add(
    "hidden",
  );
}

async function handleImportFile(
  file: File,
): Promise<void> {
  if (
    file.size > MAX_IMPORT_SIZE
  ) {
    window.alert(
      "Le fichier est trop volumineux. Taille maximale : 10 Mo.",
    );

    return;
  }

  try {
    const fileContent =
      await file.text();

    const importedObservations =
      parseBackupFile(
        fileContent,
      );

    openImportDialog(
      file.name,
      importedObservations,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "La sauvegarde n’a pas pu être importée.";

    window.alert(message);
  }
}

function clearSearchFilters(): void {
  searchDateInput.value = "";
  searchKeywordInput.value = "";
}

function completeImport(): void {
  clearSearchFilters();
  closeForm();
  closeImportDialog();

  renderCategoryNavigation();
  renderObservations();
}

function importByMerging(): void {
  const mergeResult =
    mergeObservations(
      observations,
      pendingImportedObservations,
    );

  observations =
    mergeResult.observations;

  saveObservations(observations);
  completeImport();

  window.alert(
    "Import terminé.\n\n" +
    `Ajoutées : ${mergeResult.added}\n` +
    `Mises à jour : ${mergeResult.updated}\n` +
    `Inchangées : ${mergeResult.unchanged}`,
  );
}

function importByReplacing(): void {
  const confirmed =
    window.confirm(
      "Toutes les observations actuellement présentes seront " +
      "supprimées et remplacées par le contenu de la sauvegarde.\n\n" +
      "Cette action est irréversible. Continuer ?",
    );

  if (!confirmed) {
    return;
  }

  observations = [
    ...pendingImportedObservations,
  ];

  saveObservations(observations);
  completeImport();

  window.alert(
    `${observations.length} observation(s) ont été restaurées.`,
  );
}

/*------------------------------------------------*/
/* Événements                                     */
/*------------------------------------------------*/

document
  .querySelector<HTMLButtonElement>(
    "#open-form-button",
  )!
  .addEventListener(
    "click",
    openNewObservationForm,
  );

document
  .querySelector<HTMLButtonElement>(
    "#close-form-button",
  )!
  .addEventListener(
    "click",
    closeForm,
  );

document
  .querySelector<HTMLButtonElement>(
    "#cancel-form-button",
  )!
  .addEventListener(
    "click",
    closeForm,
  );

document
  .querySelector<HTMLButtonElement>(
    "#clear-filters-button",
  )!
  .addEventListener(
    "click",
    () => {
      clearSearchFilters();
      renderObservations();
    },
  );

document
  .querySelector<HTMLButtonElement>(
    "#merge-import-button",
  )!
  .addEventListener(
    "click",
    importByMerging,
  );

document
  .querySelector<HTMLButtonElement>(
    "#replace-import-button",
  )!
  .addEventListener(
    "click",
    importByReplacing,
  );

document
  .querySelector<HTMLButtonElement>(
    "#cancel-import-button",
  )!
  .addEventListener(
    "click",
    closeImportDialog,
  );

exportButton.addEventListener(
  "click",
  exportBackup,
);

importButton.addEventListener(
  "click",
  () => {
    importFileInput.value = "";
    importFileInput.click();
  },
);

importFileInput.addEventListener(
  "change",
  () => {
    const selectedFile =
      importFileInput.files?.[0];

    if (selectedFile) {
      void handleImportFile(
        selectedFile,
      );
    }
  },
);

importDialog.addEventListener(
  "click",
  (event) => {
    if (
      event.target === importDialog
    ) {
      closeImportDialog();
    }
  },
);

searchDateInput.addEventListener(
  "change",
  renderObservations,
);

searchKeywordInput.addEventListener(
  "input",
  renderObservations,
);

observationForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    const formData =
      new FormData(
        observationForm,
      );

    const fact =
      String(
        formData.get("fact") ?? "",
      ).trim();

    if (!fact) {
      return;
    }

    const category =
      String(
        formData.get("category"),
      ) as Category;

    const observedAt =
      new Date(
        String(
          formData.get(
            "observedAt",
          ),
        ),
      ).toISOString();

    const context =
      String(
        formData.get(
          "context",
        ) ?? "",
      ).trim();

    const exactWords =
      String(
        formData.get(
          "exactWords",
        ) ?? "",
      ).trim();

    const interpretation =
      String(
        formData.get(
          "interpretation",
        ) ?? "",
      ).trim();

    if (editingObservationId) {
      observations =
        observations.map(
          (observation) => {
            if (
              observation.id !==
              editingObservationId
            ) {
              return observation;
            }

            return {
              ...observation,
              observedAt,
              modifiedAt:
                new Date().toISOString(),
              category,
              context,
              fact,
              exactWords,
              interpretation,
            };
          },
        );
    } else {
      const observation:
        Observation = {
          id: createId(),

          observedAt,

          createdAt:
            new Date().toISOString(),

          category,
          context,
          fact,
          exactWords,
          interpretation,
        };

      observations.push(
        observation,
      );
    }

    activeCategory =
      category;

    saveObservations(
      observations,
    );

    renderCategoryNavigation();
    renderObservations();
    closeForm();
  },
);

/*------------------------------------------------*/
/* Démarrage                                      */
/*------------------------------------------------*/

renderCategoryNavigation();
renderObservations();