
<!-- LIBS ALGOLIA -->
<script src="https://cdn.jsdelivr.net/npm/algoliasearch@4.10.5/dist/algoliasearch-lite.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/instantsearch.js@4.27.0/dist/instantsearch.production.min.js"></script>
<script>
// ============================================================================
// algolia-home-search.js - Page d'accueil simplifiée
// ============================================================================

window.addEventListener("DOMContentLoaded", function () {
  // 1. CONSTANTES ------------------------------------------------------------
  var ALGOLIA_APP_ID = "DRTSPIHOUM";
  var ALGOLIA_SEARCH_KEY = "137b70e88a3288926c97a689cdcf4048";
  var ALGOLIA_INDEX_NAME = "elsee_index";

  var DIRECTORY_BASE_URL = "https://www.elsee.care/lannuaire-des-partenaires-elsee";

  // 2. ÉTAT GLOBAL -----------------------------------------------------------
  var searchInstance = null;
  var selectedFacetTags = new Set(); // "type:::X", "specialities:::Y"

  function isMobileDevice() {
    if (typeof window === "undefined") return false;
    if (window.matchMedia && window.matchMedia("(max-width: 767px)").matches) {
      return true;
    }
    return (window.innerWidth || 0) <= 767;
  }

  // 3. INIT ALGOLIA ----------------------------------------------------------
  function initAlgoliaHome() {
    if (
      typeof algoliasearch === "undefined" ||
      typeof instantsearch === "undefined"
    ) {
      setTimeout(initAlgoliaHome, 200);
      return;
    }

    var searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);

    var search = instantsearch({
      indexName: ALGOLIA_INDEX_NAME,
      searchClient: searchClient
    });

    searchInstance = search;

    // 4. WIDGET SUGGESTIONS (types + spécialités) ----------------------------
    var dynamicSuggestionsWidget = {
      render: function (opts) {
        var results = opts.results;
        if (!results) return;

        var typeWrapper = document.getElementById("tags_autocomplete_type");
        var speWrapper = document.getElementById("tags_autocomplete_spe");

        if (!typeWrapper || !speWrapper) return;

        typeWrapper.classList.add("directory_suggestions_tags_wrapper");
        speWrapper.classList.add("directory_suggestions_tags_wrapper");

       
        // --- SPÉCIALITÉS -----------------------------------------------------
        var speFacetValues =
          results.getFacetValues("specialities", {
            sortBy: ["count:desc", "name:asc"]
          }) || [];
        if (!Array.isArray(speFacetValues)) speFacetValues = [];

        var selectedSpe = Array.from(selectedFacetTags)
          .filter(function (k) {
            return k.indexOf("specialities:::") === 0;
          })
          .map(function (k) {
            return k.split(":::")[1];
          });

        var seen = new Set();
        var speBlocks = [];

        selectedSpe.forEach(function (value) {
          seen.add(value);
          speBlocks.push({ name: value, count: null });
        });

        for (var i = 0; i < speFacetValues.length; i++) {
          var fv = speFacetValues[i];
          if (!fv || !fv.name) continue;
          if (seen.has(fv.name)) continue;
          if (speBlocks.length >= 10) break;
          if (fv.count === 0) continue;
          speBlocks.push({ name: fv.name, count: fv.count });
          seen.add(fv.name);
        }

        var speHtml = speBlocks
          .map(function (item) {
            var key = "specialities:::" + item.name;
            var isSelected = selectedFacetTags.has(key);
            return (
              '<div class="directory_suggestions_tag ' +
              (isSelected ? "is-selected" : "") +
              '" data-facet-name="specialities" data-facet-value="' +
              item.name +
              '">' +
              item.name +
              "</div>"
            );
          })
          .join("");

        speWrapper.innerHTML = speHtml;
      }
    };

    // 5. FONCTION URL => PAGE RÉSULTATS --------------------------------------
    function buildUrlFromState(state) {
      var params = new URLSearchParams();

      var query = (state.query || "").trim();
      if (query) {
        params.set("q", query);
      }

      var facetRef = state.facetsRefinements || {};
      var disjRef = state.disjunctiveFacetsRefinements || {};

      var typeRef =
        (disjRef.type && disjRef.type.length ? disjRef.type : facetRef.type) ||
        [];
      var speRef =
        (disjRef.specialities && disjRef.specialities.length
          ? disjRef.specialities
          : facetRef.specialities) || [];

      if (typeRef.length > 0) {
        params.set("type", typeRef.join(","));
      }

      if (speRef.length > 0) {
        params.set("specialities", speRef.join(","));
      }

      var qs = params.toString();
      var finalUrl = DIRECTORY_BASE_URL + (qs ? "?" + qs : "");

      return finalUrl;
    }

    function updateSearchButtonHref() {
      if (!searchInstance || !searchInstance.helper) return;

      var btnContainer = document.getElementById("search_button");
      if (!btnContainer) {
        console.log("[HOME SEARCH] #search_button introuvable");
        return;
      }

      var state = searchInstance.helper.state;
      var url = buildUrlFromState(state);

      if (
        btnContainer.tagName &&
        btnContainer.tagName.toLowerCase() === "a"
      ) {
        btnContainer.setAttribute("href", url);
        return;
      }

      var link = btnContainer.querySelector("a");
      if (link) {
        link.setAttribute("href", url);
      }
    }

    // 6. TAGS SÉLECTIONNÉS : création/suppression de .directory_searchbar_selected_tag
    function renderSelectedTagsInField() {
      var networkContainer = document.querySelector(".directory_search_field_container_network");
      if (!networkContainer) return;

      var chipContainer = networkContainer.querySelector(".directory_searchbar_selected_tag");

      // aucun tag sélectionné → on supprime la div si elle existe
      if (!selectedFacetTags.size) {
        if (chipContainer && chipContainer.parentNode) {
          chipContainer.parentNode.removeChild(chipContainer);
        }
        return;
      }

      // au moins un tag → on crée la div si elle n'existe pas
      if (!chipContainer) {
        chipContainer = document.createElement("div");
        chipContainer.className = "directory_searchbar_selected_tag";

        var searchField = networkContainer.querySelector(".directory_search_field_container");
        if (searchField) {
          networkContainer.insertBefore(chipContainer, searchField);
        } else {
          networkContainer.insertBefore(chipContainer, networkContainer.firstChild);
        }
      }

      // Limiter l’affichage à 2 tags + un tag "+X" si plus
      var selectedArray = Array.from(selectedFacetTags);
      var maxVisible = 2;
      var htmlParts = [];

      selectedArray.slice(0, maxVisible).forEach(function (key) {
        var parts = key.split(":::");
        var facetName = parts[0];
        var facetValue = parts[1];
        htmlParts.push(
          '<div class="directory_suggestions_tag is-selected" ' +
          'data-selected-chip="1" ' +
          'data-facet-name="' + facetName + '" ' +
          'data-facet-value="' + facetValue + '">' +
          facetValue +
          "</div>"
        );
      });

      if (selectedArray.length > maxVisible) {
        var hiddenCount = selectedArray.length - maxVisible;
        // Tag synthétique "+X" avec les mêmes classes CSS
        htmlParts.push(
          '<div class="directory_suggestions_tag is-selected" ' +
          'data-selected-chip="1" ' +
          'data-more-chips="1">' +
          "+" + hiddenCount +
          "</div>"
        );
      }

      chipContainer.innerHTML = htmlParts.join("");
    }

    // 7. CLICK SUR LES TAGS SÉLECTIONNÉS (suppression + filtre) --------------
    function setupSelectedTagClicks() {
      var networkContainer = document.querySelector(".directory_search_field_container_network");
      if (!networkContainer || !searchInstance || !searchInstance.helper) return;

      networkContainer.addEventListener("click", function (e) {
        var chip = e.target.closest("[data-selected-chip='1']");
        if (!chip) return;

        // Ne rien faire pour le tag "+X" (pas de data-facet-name)
        var facetName = chip.getAttribute("data-facet-name");
        var facetValue = chip.getAttribute("data-facet-value");
        if (!facetName || !facetValue) return;

        var helper = searchInstance.helper;
        var key = facetName + ":::" + facetValue;

        if (!selectedFacetTags.has(key)) return;

        selectedFacetTags.delete(key);

        if (facetName === "type") {
          helper.removeDisjunctiveFacetRefinement(facetName, facetValue);
        } else if (facetName === "specialities") {
          helper.removeFacetRefinement(facetName, facetValue);
        }

        helper.search();
      });
    }

    // 8. WIDGETS --------------------------------------------------------------
    search.addWidgets([
      instantsearch.widgets.configure({
        facets: ["specialities"],
        disjunctiveFacets: ["type"],
        hitsPerPage: 0
      }),

      instantsearch.widgets.searchBox({
        container: "#searchbox",
        placeholder: isMobileDevice()
          ? "Recherchez ici ..."
          : "Écrivez ici tout ce qui concerne vos besoins...",
        cssClasses: {
          root: "directory_search_field_container",
          input: "directory_search_text"
        }
      }),

      dynamicSuggestionsWidget
    ]);

    // 9. DROPDOWN SEARCH ------------------------------------------------------
    function setupSearchDropdown() {
      var input = document.querySelector(".directory_search_field_container");
      var dropdown =
        document.getElementById("tags_autocomplete") ||
        document.querySelector(".directory_search_dropdown_wrapper");

      if (!input || !dropdown) return;

      function openDropdown() {
        dropdown.style.display = "flex";
      }

      function closeDropdown(e) {
        if (dropdown.contains(e.target) || input.contains(e.target)) return;
        dropdown.style.display = "none";
      }

      input.addEventListener("focus", openDropdown);
      input.addEventListener("click", openDropdown);
      document.addEventListener("click", closeDropdown);
    }

    // 10. CLIC SUR TAGS SUGGÉRÉS ---------------------------------------------
    function setupSuggestionClicks() {
      var dropdown =
        document.getElementById("tags_autocomplete") ||
        document.querySelector(".directory_search_dropdown_wrapper");
      if (!dropdown) return;

      dropdown.addEventListener("click", function (e) {
        var tag = e.target.closest(".directory_suggestions_tag");
        if (!tag || !searchInstance || !searchInstance.helper) return;

        var facetName = tag.getAttribute("data-facet-name");
        var facetValue = tag.getAttribute("data-facet-value");
        if (!facetName || !facetValue) return;

        var helper = searchInstance.helper;
        var key = facetName + ":::" + facetValue;
        var isSelected = selectedFacetTags.has(key);

        if (facetName === "type") {
          if (isSelected) {
            selectedFacetTags.delete(key);
            helper.removeDisjunctiveFacetRefinement(facetName, facetValue);
          } else {
            selectedFacetTags.add(key);
            helper.addDisjunctiveFacetRefinement(facetName, facetValue);
          }
        } else if (facetName === "specialities") {
          if (isSelected) {
            selectedFacetTags.delete(key);
            helper.removeFacetRefinement(facetName, facetValue);
          } else {
            selectedFacetTags.add(key);
            helper.addFacetRefinement(facetName, facetValue);
          }
        }

        helper.search();
      });
    }

    // 11. SYNCHRO BOUTON + RENDER --------------------------------------------
    search.on("render", function () {
      if (search.helper && search.helper.state) {
        updateSearchButtonHref();
      }
      renderSelectedTagsInField();
    });

    // 12. CLIC SUR LE BOUTON SEARCH ------------------------------------------
    function setupSearchButtonClick() {
      var btnEl = document.getElementById("search_button");
      if (!btnEl || !searchInstance || !searchInstance.helper) return;

      btnEl.addEventListener("click", function (e) {
        var state = searchInstance.helper.state;
        var url = buildUrlFromState(state);
        if (!url) return;

        if (btnEl.tagName && btnEl.tagName.toLowerCase() === "a") {
          btnEl.setAttribute("href", url);
        }

        e.preventDefault();
        window.location.href = url;
      });
    }

    // 13. LANCEMENT -----------------------------------------------------------
    search.start();
    setupSearchDropdown();
    setupSuggestionClicks();
    setupSelectedTagClicks();
    setupSearchButtonClick();

    if (search.helper && search.helper.state) {
      updateSearchButtonHref();
      renderSelectedTagsInField();
    }
  }

  initAlgoliaHome();
});
</script>
