// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const UI_LOCALES = Object.freeze([
  Object.freeze({ code: "en-US", language: "English (US)", dictionary: "en" }),
  Object.freeze({ code: "es", language: "Español", dictionary: "es" }),
  Object.freeze({ code: "fr", language: "Français", dictionary: "fr" }),
  Object.freeze({ code: "de", language: "Deutsch", dictionary: "de" }),
  Object.freeze({ code: "pt-BR", language: "Português (Brasil)", dictionary: "pt" })
]);

const LOCALE_ALIASES = Object.freeze({
  en: "en-US",
  "en-US": "en-US",
  es: "es",
  fr: "fr",
  de: "de",
  pt: "pt-BR",
  "pt-BR": "pt-BR"
});

const SUPPORTED_LOCALE_CODES = Object.freeze(UI_LOCALES.map(({ code }) => code));

function normalizeLocale(value) {
  const locale = String(value || "");
  return Object.prototype.hasOwnProperty.call(LOCALE_ALIASES, locale) ? LOCALE_ALIASES[locale] : "en-US";
}

function isSupportedLocale(value) {
  return Object.prototype.hasOwnProperty.call(LOCALE_ALIASES, String(value || ""));
}

module.exports = {
  UI_LOCALES,
  SUPPORTED_LOCALE_CODES,
  normalizeLocale,
  isSupportedLocale
};
