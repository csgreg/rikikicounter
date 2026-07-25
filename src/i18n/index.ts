import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import hu from "./locales/hu.json";
import en from "./locales/en.json";

const LANG_KEY = "rikiki_lang";

export type AppLanguage = "hu" | "en";

function getInitialLanguage(): AppLanguage {
  const saved = localStorage.getItem(LANG_KEY);
  return saved === "en" ? "en" : "hu";
}

i18n.use(initReactI18next).init({
  resources: {
    hu: { translation: hu },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: "hu",
  interpolation: {
    escapeValue: false, // React already escapes; some strings carry <b>/<strong> markup via <Trans>
  },
  returnObjects: true,
});

// Keep the choice across visits, same pattern as every other rikiki_* key.
i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANG_KEY, lng);
});

export default i18n;
