(function () {
  var root = document.getElementById("piv-root");
  if (!root) return;

  // Cheile se citesc din atributele data-* puse pe div-ul #piv-root din pagina 123
  // (asa nu mai e nevoie de niciun cod JS in caseta de embed a site-ului)
  var GOOGLE_MAPS_API_KEY = root.getAttribute("data-maps-key") || "";
  var APPS_SCRIPT_URL = root.getAttribute("data-backend-url") || "";
  var DEFAULT_CENTER = { lat: 45.9432, lng: 24.9668 }; // centrul Romaniei, fallback
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
          '<button type="button" id="piv-manual-go">Mergi</button>' +
        '</div>' +
      '</div>' +
      '<div class="piv-panel" id="piv-panel">' +
        '<div class="piv-panel-head">' +
          '<strong>Confirma raportarea</strong>' +
          '<div class="piv-coords" id="piv-coords">&mdash;</div>' +
        '</div>' +
        '<div class="piv-panel-body">' +
          '<label for="piv-desc">Descriere (optional)</label>' +
          '<textarea id="piv-desc" maxlength="300" placeholder="Ex: tufis de cenuser / ambrozie, aprox. 2mp ..."></textarea>' +
          '<label>Fotografii (maxim 3)</label>' +
          '<div class="piv-photos" id="piv-photos">' +
            '<div class="piv-photo-slot" data-slot="0">+</div>' +
            '<div class="piv-photo-slot" data-slot="1">+</div>' +
            '<div class="piv-photo-slot" data-slot="2">+</div>' +
          '</div>' +
          '<input type="file" accept="image/*" class="piv-file-input" id="piv-file-input">' +
          '<p class="piv-note">Fiecare poza max. 5MB, format imagine (jpg/png/webp).</p>' +
        '</div>' +
        '<div class="piv-panel-foot">' +
          '<button class="piv-btn piv-btn-ghost" id="piv-cancel-btn" type="button">Anuleaza</button>' +
          '<button class="piv-btn piv-btn-primary" id="piv-submit-btn" type="button">Trimite</button>' +
        '</div>' +
      '</div>' +
      '<div class="piv-toast" id="piv-toast"></div>' +
    '</div>';

  var map, activeMarker, markersLayer = [];
  var photos = [null, null, null];
  var toastEl = document.getElementById("piv-toast");

  function showToast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add("piv-show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.classList.remove("piv-show");
    }, ms || 3200);
  }

  function amp() { return String.fromCharCode(38); } // "&" construit din cod, nu scris direct

  function leafIcon() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">'
      + '<circle cx="17" cy="17" r="16" fill="#a34a28" stroke="#ffffff" stroke-width="2"/>'
      + '<path d="M11 20c0-7 6-10 12-10-1 7-5 11-12 11-1 0-2-1-2-1" fill="#ffffff"/>'
      + '</svg>';
    return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new google.maps.Size(34, 34) };
  }

  function pinIcon() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">'
      + '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#2f5c46"/>'
      + '<circle cx="15" cy="15" r="6" fill="#ffffff"/>'
      + '</svg>';
    return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new google.maps.Size(30, 42), anchor: new google.maps.Point(15, 42) };
  }

  function initMap() {
    map = new google.maps.Map(document.getElementById("piv-map"), {
      center: DEFAULT_CENTER,
      zoom: 6,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      clickableIcons: false
    });

    map.addListener("click", function (e) {
      openPanelAt(e.latLng.lat(), e.latLng.lng());
    });

    loadExistingReports();

    if (!root.getAttribute("data-locate-url")) {
      var manualLink = document.getElementById("piv-manual-link");
      if (manualLink) manualLink.style.display = "none";
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (pos) {
        map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        map.setZoom(13);
      }, function () { /* refuzat / indisponibil - ramane centrul implicit */ });
    }
  }

  document.getElementById("piv-locate-btn").addEventListener("click", function () {
    if (!navigator.geolocation) { showToast("Localizarea nu e disponibila pe acest dispozitiv."); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      map.setZoom(15);
    }, function () {
      showToast("Locatia automata nu e permisa aici. Foloseste optiunea de mai jos.");
    });
  });

  document.getElementById("piv-manual-go").addEventListener("click", function () {
    var raw = document.getElementById("piv-manual-input").value;
    var parts = raw.split(",").map(function (s) { return parseFloat(s.trim()); });
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      showToast("Scrie coordonatele ca in exemplu: 45.943, 24.966");
      return;
    }
    map.setCenter({ lat: parts[0], lng: parts[1] });
    map.setZoom(15);
    showToast("Harta a fost centrata pe coordonatele tale.");
  });

  function openPanelAt(lat, lng) {
    if (activeMarker) activeMarker.setMap(null);
    activeMarker = new google.maps.Marker({ position: { lat: lat, lng: lng }, map: map, icon: pinIcon() });
    document.getElementById("piv-coords").textContent = "Lat: " + lat.toFixed(5) + "  Lng: " + lng.toFixed(5);
    document.getElementById("piv-panel").classList.add("piv-open");
    document.getElementById("piv-panel").dataset.lat = lat;
    document.getElementById("piv-panel").dataset.lng = lng;
  }

  function closePanel() {
    document.getElementById("piv-panel").classList.remove("piv-open");
    document.getElementById("piv-desc").value = "";
    photos = [null, null, null];
    renderPhotoSlots();
    if (activeMarker) { activeMarker.setMap(null); activeMarker = null; }
  }
  document.getElementById("piv-cancel-btn").addEventListener("click", closePanel);

  var fileInput = document.getElementById("piv-file-input");
  var activeSlot = null;

  document.getElementById("piv-photos").addEventListener("click", function (e) {
    var slot = e.target.closest(".piv-photo-slot");
    if (!slot) return;
    activeSlot = parseInt(slot.dataset.slot, 10);
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    var file = fileInput.files[0];
    if (!file) return;
    if (file.type.indexOf("image/") !== 0) { showToast("Te rog alege un fisier imagine."); return; }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) { showToast("Poza depaseste " + MAX_PHOTO_MB + "MB."); return; }
    var reader = new FileReader();
    reader.onload = function () {
      photos[activeSlot] = { name: file.name, type: file.type, dataUrl: reader.result };
      renderPhotoSlots();
    };
    reader.readAsDataURL(file);
  });

  function renderPhotoSlots() {
    var slots = document.querySelectorAll("#piv-photos .piv-photo-slot");
    slots.forEach(function (slot, i) {
      var p = photos[i];
      if (p) {
        slot.innerHTML = '<img src="' + p.dataUrl + '" alt="poza ' + (i + 1) + '"><button type="button" class="piv-remove" data-slot="' + i + '">\u00d7</button>';
      } else {
        slot.innerHTML = "+";
      }
    });
  }

  document.getElementById("piv-photos").addEventListener("click", function (e) {
    if (e.target.classList.contains("piv-remove")) {
      e.stopPropagation();
      var i = parseInt(e.target.dataset.slot, 10);
      photos[i] = null;
      renderPhotoSlots();
    }
  });

  // Trimitere prin formular ascuns + iframe invizibil (ocoleste blocajul
  // de fetch/XHR din sandbox-ul iframe al 123, care permite navigare/formulare
  // dar nu cereri AJAX catre alte domenii)
  var pivFrame = document.createElement("iframe");
  pivFrame.name = "piv-hidden-frame";
  pivFrame.style.display = "none";
  document.body.appendChild(pivFrame);

  var submitPending = false;

  pivFrame.addEventListener("load", function () {
    if (!submitPending) return; // ignora incarcarea initiala goala a iframe-ului
    submitPending = false;
    var btn = document.getElementById("piv-submit-btn");
    btn.disabled = false; btn.textContent = "Trimite";
    showToast("Multumim! Raportarea a fost inregistrata.");
    closePanel();
  });

  document.getElementById("piv-submit-btn").addEventListener("click", function () {
    var panel = document.getElementById("piv-panel");
    var lat = parseFloat(panel.dataset.lat), lng = parseFloat(panel.dataset.lng);
    if (isNaN(lat) || isNaN(lng)) { showToast("Alege mai intai un punct pe harta."); return; }
    if (!APPS_SCRIPT_URL) { showToast("Widgetul nu e configurat complet (lipseste backend-ul)."); return; }

    var btn = document.getElementById("piv-submit-btn");
    btn.disabled = true; btn.textContent = "Se trimite...";

    var payload = {
      lat: lat,
      lng: lng,
      description: document.getElementById("piv-desc").value.slice(0, 300),
      photos: photos.filter(Boolean),
      submittedAt: new Date().toISOString()
    };

    // afisam imediat markerul local (cu pozele alese de utilizator),
    // nu asteptam raspunsul serverului ca sa stim ca s-a trimis
    addReportMarker({
      lat: lat, lng: lng, description: payload.description,
      photos: payload.photos.map(function (p) { return p.dataUrl; })
    });

    var form = document.createElement("form");
    form.method = "POST";
    form.action = APPS_SCRIPT_URL;
    form.target = "piv-hidden-frame";
    form.style.display = "none";

    var input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);
    form.appendChild(input);

    document.body.appendChild(form);
    submitPending = true;
    form.submit();
    form.remove();

    // plasa de siguranta: daca evenimentul "load" nu se declanseaza
    // (unele sandbox-uri il suprima), reactiveaza butonul oricum dupa 4s
    setTimeout(function () {
      if (submitPending) {
        submitPending = false;
        btn.disabled = false; btn.textContent = "Trimite";
        closePanel();
      }
    }, 4000);
  });

  function loadExistingReports() {
    if (!APPS_SCRIPT_URL) return;
    // JSONP prin tag <script> in loc de fetch, ca sa functioneze si in
    // sandbox-uri care blocheaza cererile AJAX catre alte domenii
    window.__pivReports = function (list) {
      (list || []).forEach(addReportMarker);
    };
    var s = document.createElement("script");
    s.src = APPS_SCRIPT_URL + "?callback=__pivReports";
    s.onerror = function () { /* silent */ };
    document.body.appendChild(s);
  }

  function addReportMarker(report) {
    var marker = new google.maps.Marker({
      position: { lat: parseFloat(report.lat), lng: parseFloat(report.lng) },
      map: map,
      icon: leafIcon(),
      title: "Planta invaziva semnalata"
    });
    var thumbs = (report.photos || []).slice(0, 3).map(function (u) {
      return '<img src="' + u + '" alt="poza raportare">';
    }).join("");
    var content = '<div class="piv-iw"><strong>Planta invaziva semnalata</strong>'
      + (report.description ? '<div>' + escapeHtml(report.description) + '</div>' : '')
      + (thumbs ? '<div class="piv-iw-thumbs">' + thumbs + '</div>' : '')
      + '</div>';
    var infowindow = new google.maps.InfoWindow({ content: content });
    marker.addListener("click", function () { infowindow.open(map, marker); });
    markersLayer.push(marker);
  }

  function escapeHtml(s) {
    return String(s).replace(/[<>"']/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  window.__pivInitMap = initMap;
  var s = document.createElement("script");
  s.src = "https://maps.googleapis.com/maps/api/js?key=" + GOOGLE_MAPS_API_KEY + amp() + "callback=__pivInitMap";
  s.async = true; s.defer = true;
  document.head.appendChild(s);
})();
