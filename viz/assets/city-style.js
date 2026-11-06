"use strict";
const newCityStyle = qs.get("map") === "1" || qs.get("layers") === "1";
const cityStyle = document.getElementById("city-style");
cityStyle.setAttribute("aria-label", LANG === "ru" ? "Вид города" : "City style");
cityStyle.add(new Option(LANG === "ru" ? "Исходный вид" : "Original look", "original"));
cityStyle.add(new Option(LANG === "ru" ? "Новый вид" : "New look", "new"));
cityStyle.value = newCityStyle ? "new" : "original";
cityStyle.addEventListener("change", () => {
  const url = new URL(location.href);
  url.searchParams.delete("layers");
  if (cityStyle.value === "new") {
    url.searchParams.set("map", "1");
    url.searchParams.set("live", "1");
  } else {
    url.searchParams.delete("map");
    url.searchParams.delete("live");
  }
  location.assign(url);
});
addEventListener("pageshow", () => { cityStyle.value = newCityStyle ? "new" : "original"; });
