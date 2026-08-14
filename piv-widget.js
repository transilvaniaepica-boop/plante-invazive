(function () {
  var root = document.getElementById("piv-root");
  if (!root) return;

  var GOOGLE_MAPS_API_KEY = root.getAttribute("data-maps-key") || "";
  var APPS_SCRIPT_URL = root.getAttribute("data-backend-url") || "";
  var DEFAULT_CENTER = { lat: 45.9432, lng: 24.9668 };
  var MAX_PHOTO_MB = 5;

  root.innerHTML =
    '<div class="piv-header">' +
      '<div>' +
        '<h3>\uD83C\uDF3F Raporteaza o planta invaziva</h3>' +
        '<p>Fara cont &mdash; atinge harta pe locul unde ai observat planta</p>' +
      '</div>' +
    '</div>' +
    '<div class="piv-map-wrap">' +
      '<div id="piv-map"></div>' +
      '<div class="piv-hint">Atinge / da click pe harta exact unde ai vazut planta invaziva, apoi adauga poze.</div>' +
      '<button class="piv-locate" id="piv-locate-btn" type="button">\uD83D\uDCCD Locatia mea</button>' +
      '<div class="piv-manual-loc" id="piv-manual-loc">' +
        '<a href="' + (root.getAttribute("data-locate-url") || "#") + '" target="_blank" rel="noopener" id="piv-manual-link">GPS nu merge aici? Deschide-l separat \u2197</a>' +
        '<div class="piv-manual-row">' +
          '<input type="text" id="piv-manual-input" placeholder="ex: 45.943, 24.966">' +
          '<button type="button" id="piv-manual-go">Mergi</
