// ============================================================================
// algolia-search.js
// ============================================================================
window.addEventListener("DOMContentLoaded", function () {
  // 1. CONSTANTES ------------------------------------------------------------
  var ALGOLIA_APP_ID = "DRTSPIHOUM";
  var ALGOLIA_SEARCH_KEY = "137b70e88a3288926c97a689cdcf4048";
  var ALGOLIA_INDEX_NAME = "elsee_index";

  // placeholders
  var THERAPIST_PLACEHOLDER_URL =
    "https://cdn.prod.website-files.com/64708634ac0bc7337aa7acd8/690dd36e1367cf7f0391812d_Fichier%20Convertio%20(3).webp";
  var DEFAULT_PLACEHOLDER_URL =
    "https://cdn.prod.website-files.com/64708634ac0bc7337aa7acd8/690dd373de251816ebaa511c_Placeholder%20de%20marque.webp";

  // 2. ÉTAT GLOBAL -----------------------------------------------------------
  var selectedFacetTags = new Set();
  var selectedJobTags = [];
  var isNetworkSelected = false;
  var isRemoteSelected = false;
  var isAtHomeSelected = false;
  var speExpanded = false;
  var prestaExpanded = false;
  var jobExpanded = false;
  var currentGeoFilter = null; // {lat,lng,label}
  var searchInstance = null;
  var hasUserLaunchedSearch = false;
  var discountRawValues = []; // valeurs de remboursement renvoyées par Algolia
  var DIRECTORY_BASE_URL = "https://www.elsee.care/lannuaire-des-partenaires-elsee";
  var mainHitHrefSet = new Set();
  var mainHitPathSet = new Set();
  var mainHitOdooSet = new Set();
  var urlParamsApplied = false; 




  // 3. INIT ------------------------------------------------------------------
  function initAlgolia() {
    if (
      typeof algoliasearch === "undefined" ||
      typeof instantsearch === "undefined"
    ) {
      setTimeout(initAlgolia, 200);
      return;
    }

    var searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);

    // 3.1 instance instantsearch
    var search = instantsearch({
  indexName: ALGOLIA_INDEX_NAME,
  searchClient: searchClient,
  searchFunction: function (helper) {
  var query = (helper.state.query || "").trim();

  var userHasFilters =
    selectedFacetTags.size > 0 ||
    selectedJobTags.length > 0 ||
    isNetworkSelected ||
    isRemoteSelected ||
    isAtHomeSelected ||
    currentGeoFilter;

  if (query !== "" || userHasFilters) {
    hasUserLaunchedSearch = true;
  }

  var userFilters = buildFiltersStringFromJobsAndBooleans();
  var finalFilters = composeFilters(userFilters);

  var prevFilters = helper.state.filters || undefined;
  if (prevFilters !== finalFilters) {
    helper.setQueryParameter("filters", finalFilters);
  }

  helper.search();
}



});


    searchInstance = search;

    // 4. UTILS ----------------------------------------------------------------
    function truncate(str, max) {
      if (!str) return "";
      return str.length > max ? str.slice(0, max) + "..." : str;
    }

    function toArray(v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      return [v];
    }


    function isTherapeutes(hit) {
      var t = (hit.type || "").trim().toLowerCase();
      return t === "thérapeutes" || t === "therapeutes";
    }

    function updateOnlyThpVisibility(helperState, hasJobsFacet) {
      var el = document.getElementById("onlythp");
      if (!el) return;

      var disj = helperState.disjunctiveFacetsRefinements || {};
      var facets = helperState.facetsRefinements || {};

      var types =
        (disj.type && disj.type.length ? disj.type : facets.type) || [];

      var noTypeSelected = types.length === 0;

      var hasThera = types.some(function (t) {
        var tt = t.toLowerCase().trim();
        return tt === "thérapeutes" || tt === "therapeutes";
      });

      if (hasJobsFacet && (noTypeSelected || hasThera)) {
        el.style.display = "flex";
      } else {
        el.style.display = "none";
      }
    }

    
    // === Helpers CTA par type (via data-attr + CSS global) ======================
(function () {
  // 1) CSS global une fois pour toutes (priorité !important)
  function ensureCTACSS() {
    if (document.getElementById("cta-style-global")) return;
    var css = `
      .directory_sidebar_ctas_container .directory_sidebar_cta_wrapper { display: none !important; }

      body[data-cta="wellness"]    #adWellness-cta  { display: flex !important; }
      body[data-cta="therapeutes"] #adTherapist-cta { display: flex !important; }
      body[data-cta="marques"]     #adBrand-cta     { display: flex !important; }
      body[data-cta="programmes"]  #adProgram-cta   { display: flex !important; }
      body[data-cta="sports"]      #adSport-cta     { display: flex !important; }
    `;
    var style = document.createElement("style");
    style.id = "cta-style-global";
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  // 2) Normalisation (sans accents) + mapping label → clé data-cta
  function norm(s) {
    return (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function mapLabelToKey(label) {
    var n = norm(label);
    if (n.includes("salons esthetiques") || n.includes("centres bien-etre")) return "wellness";
    if (n.includes("therapeutes")) return "therapeutes";
    if (n.includes("marques")) return "marques";
    if (n.includes("applications") || n.includes("programmes")) return "programmes";
    if (n.includes("sports")) return "sports";
    return ""; // rien
  }

  // 3) Applique en posant/unset l’attribut sur <body>
  function applyCTAFromSelectedTypes(selectedTypes) {
    var list = Array.isArray(selectedTypes) ? selectedTypes : [];

    // un seul type → on mappe; sinon on enlève l’attribut
    var key = (list.length === 1) ? mapLabelToKey(list[0]) : "";
    if (key) {
      document.body.setAttribute("data-cta", key);
    } else {
      document.body.removeAttribute("data-cta");
    }
  }

  // 4) Observer pour réappliquer après réinjections DOM
  function ensureObserver() {
    if (window.__ctaObserverAttached) return;
    window.__ctaObserverAttached = true;

    var container = document.querySelector(".directory_sidebar_ctas_container") || document.body;
    var obs = new MutationObserver(function () {
      if (window.__lastSelectedTypes) applyCTAFromSelectedTypes(window.__lastSelectedTypes);
    });
    obs.observe(container, { childList: true, subtree: true });
    window.__ctaObserver = obs;
  }

  // 5) API globale (compat avec ton appel existant)
  window.__toggleTypeCTAs = function (selectedTypes) {
    window.__lastSelectedTypes = selectedTypes ? selectedTypes.slice() : [];
    // laisse à Webflow une frame si ça réinjecte
    requestAnimationFrame(function () {
      applyCTAFromSelectedTypes(window.__lastSelectedTypes);
    });
  };
  window.__ensureCTAObserver = ensureObserver;

  // Boot
  ensureCTACSS();
})();




    // 5. FILTRES --------------------------------------------------------------
    function buildFiltersStringFromJobsAndBooleans() {
      var parts = [];

      if (selectedJobTags.length > 0) {
        var jobParts = selectedJobTags.map(function (job) {
          var safe = job.replace(/"/g, '\\"');
          return '(mainjob:"' + safe + '" OR jobs:"' + safe + '")';
        });
        parts.push(jobParts.join(" AND "));
      }

      if (isNetworkSelected) {
        parts.push("is_elsee_network:true");
      }
      if (isRemoteSelected) {
        parts.push("is_remote:true");
      }
      if (isAtHomeSelected) {
        parts.push("is_at_home:true");
      }

      var finalStr = parts.join(" AND ");
      return finalStr.length ? finalStr : undefined;
    }

    // filtre de visibilité commun
function getVisibilityFilter(ignoreGeo) {
  var debugInfo = {
    where: "getVisibilityFilter",
    ignoreGeo: !!ignoreGeo,
    isNetworkSelected: isNetworkSelected,
    hasGeo: !!currentGeoFilter,
    currentGeoFilter: currentGeoFilter
  };

  // cas spécial : on veut voir tous les membres réseau
  if (isNetworkSelected) {
    console.log("[VISIBILITY]", Object.assign({}, debugInfo, {
      result: ""
    }));
    return "";
  }

  // si on n’ignore PAS la géoloc et qu’elle est active → règle spéciale show_home
  if (!ignoreGeo && currentGeoFilter) {
    console.log("[VISIBILITY]", Object.assign({}, debugInfo, {
      result: "NOT show_home:true"
    }));
    return "NOT show_home:true";
  }

  // sinon, règle standard
  console.log("[VISIBILITY]", Object.assign({}, debugInfo, {
    result: "NOT show_search:true (ou show_home:true selon ta version)"
  }));
  return "NOT show_search:true"; // ou `show_home:true` selon ce que tu as remis
}



    function composeFilters(userFilters) {
      var visibility = getVisibilityFilter();

      if (userFilters && userFilters.length && visibility) {
        return userFilters + " AND " + visibility;
      }
      if (userFilters && userFilters.length) {
        return userFilters;
      }
      return visibility;
    }

    function updateUrlFromState(state) {
      if (typeof window === "undefined") return;
      var params = new URLSearchParams(window.location.search);

      var query = state.query || "";
      if (query.trim() !== "") {
        params.set("q", query.trim());
      } else {
        params.delete("q");
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
      var prestaRef =
        (facetRef.prestations && facetRef.prestations.length
          ? facetRef.prestations
          : []) || [];
      var reimbRef =
        (disjRef.reimbursment_percentage &&
          disjRef.reimbursment_percentage.length
          ? disjRef.reimbursment_percentage
          : []) || [];

      if (typeRef.length > 0) params.set("type", typeRef.join(","));
      else params.delete("type");

      if (speRef.length > 0) params.set("specialities", speRef.join(","));
      else params.delete("specialities");

      if (prestaRef.length > 0) params.set("prestations", prestaRef.join(","));
      else params.delete("prestations");

      if (reimbRef.length > 0)
        params.set("reimbursment_percentage", reimbRef.join(","));
      else params.delete("reimbursment_percentage");

      if (selectedJobTags.length > 0)
        params.set("jobs", selectedJobTags.join(","));
      else params.delete("jobs");

      if (currentGeoFilter && currentGeoFilter.lat && currentGeoFilter.lng) {
        params.set("geo", currentGeoFilter.lat + "," + currentGeoFilter.lng);
        if (currentGeoFilter.label) {
          params.set("geolabel", encodeURIComponent(currentGeoFilter.label));
        } else {
          params.delete("geolabel");
        }
      } else {
        params.delete("geo");
        params.delete("geolabel");
      }

      if (isNetworkSelected) params.set("network", "true");
      else params.delete("network");

      if (isRemoteSelected) params.set("remote", "true");
      else params.delete("remote");

      if (isAtHomeSelected) params.set("athome", "true");
      else params.delete("athome");

      var newUrl =
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", newUrl);
    }

    // 6. WIDGET CUSTOM TAGS ---------------------------------------------------
    var dynamicSuggestionsWidget = {
      render: function (opts) {
        var results = opts.results;
        if (!results) return;

        var typeWrapper = document.getElementById("tags_autocomplete_type");
        var speWrapper = document.getElementById("tags_autocomplete_spe");
        var speFilterWrapper = document.getElementById("spe_filtre");
        var prestaFilterWrapper = document.getElementById("presta_filtre");
        var jobFilterWrapper = document.getElementById("job_filtre");
        var labelFilterWrapper = document.getElementById("label-filter");
        var remoteFilterWrapper = document.getElementById(
          "works-remotely-filter"
        );
        var atHomeFilterWrapper = document.getElementById(
          "works-at-home-filter"
        );
        var discountFilterWrapper = document.getElementById("discount-tags");

        if (!typeWrapper || !speWrapper) return;

        typeWrapper.classList.add("directory_suggestions_tags_wrapper");
        speWrapper.classList.add("directory_suggestions_tags_wrapper");

        // TYPES ----------------------------------------------------------------
        var typeFacetValues =
          results.getFacetValues("type", {
            sortBy: ["count:desc", "name:asc"]
          }) || [];
        if (!Array.isArray(typeFacetValues)) typeFacetValues = [];

        // quels types sont VRAIMENT sélectionnés ?
        var selectedTypes = Array.from(selectedFacetTags)
          .filter(function (k) {
            return k.indexOf("type:::") === 0;
          })
          .map(function (k) {
            return k.split(":::")[1] || "";
          });

        var noTypeSelected = selectedTypes.length === 0;
        var hasTheraSelected = selectedTypes.some(function (t) {
          var norm = (t || "").toLowerCase();
          return norm === "thérapeutes" || norm === "therapeutes";
        });




        // c'est cette règle qui commande l'affichage visio/domicile
        var shouldShowTheraOnlyFilters = noTypeSelected || hasTheraSelected;

        var typeHtml = typeFacetValues
          .filter(function (fv) {
            return fv && fv.name;
          })
          .map(function (fv) {
            var key = "type:::" + fv.name;
            var isSelected = selectedFacetTags.has(key);
            if (fv.count === 0 && !isSelected) return "";
            return (
              '<div class="directory_suggestions_tag is-type ' +
              (isSelected ? "is-selected" : "") +
              '" data-facet-name="type" data-facet-value="' +
              fv.name +
              '">' +
              fv.name +
              "</div>"
            );
          })
          .join("");
        typeWrapper.innerHTML = typeHtml;
var typesAltWrapper = document.getElementById("directory_types");
if (typesAltWrapper) {
  var hasTypeSelected = selectedTypes.length > 0;

  var altHtml =
    '<div class="directory_category_tag_wrapper ' +
    (hasTypeSelected ? "" : "is-selected") +
    '" data-facet-name="type" data-facet-value="__ALL_TYPES__">Toutes les catégories</div>';

  altHtml += typeFacetValues
    .filter(function (fv) { return fv && fv.name; })
    .map(function (fv) {
      var key = "type:::" + fv.name;
      var isSelected = selectedFacetTags.has(key);
      var label = "Les " + fv.name.toLowerCase();
      return (
        '<div class="directory_category_tag_wrapper ' +
        (isSelected ? "is-selected" : "") +
        '" data-facet-name="type" data-facet-value="' + fv.name + '">' +
        label +
        "</div>"
      );
    })
    .join("");

  typesAltWrapper.innerHTML = altHtml;

// === CTAs par type : visible uniquement si UN seul type est sélectionné ===
if (typeof window.__toggleTypeCTAs === "function") {
  window.__toggleTypeCTAs(selectedTypes);
  if (typeof window.__ensureCTAObserver === "function") {
    window.__ensureCTAObserver();
  }
}
}



        // SPÉCIALITÉS ---------------------------------------------------------
        var speFacetValues =
          results.getFacetValues("specialities", {
            sortBy: ["count:desc", "name:asc"]
          }) || [];
        if (!Array.isArray(speFacetValues)) speFacetValues = [];

        var speFacetValuesAlpha = speFacetValues.slice().sort(function (a, b) {
          return (a.name || "").localeCompare(b.name || "");
        });

        var speContainer = document.getElementById("speContainer");
        if (speContainer) {
          var hasSpe = speFacetValues.some(function (fv) {
            return fv && fv.count > 0;
          });
          speContainer.style.display = hasSpe ? "flex" : "none";
        }

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

        if (speFilterWrapper) {
          var maxToShow = speExpanded ? speFacetValuesAlpha.length : 6;
          var speListHtml = speFacetValuesAlpha
            .filter(function (fv) {
              return fv && fv.name;
            })
            .slice(0, maxToShow)
            .map(function (fv) {
              var key = "specialities:::" + fv.name;
              var isSelected = selectedFacetTags.has(key);
              return (
                '<div class="directory_category_tag_wrapper ' +
                (isSelected ? "is-selected" : "") +
                '" data-facet-name="specialities" data-facet-value="' +
                fv.name +
                '">' +
                fv.name +
                "</div>"
              );
            })
            .join("");

          speFilterWrapper.innerHTML = speListHtml;

          var moreSpeBtn = document.getElementById("more-spe");
          if (moreSpeBtn) {
            moreSpeBtn.textContent = speExpanded
              ? "En voir moins"
              : "Voir toutes les spécialités";
          }
        }
        // idem pour le header "lessSpe" (icône chevron)
          var lessSpeBtn = document.getElementById("lessSpe");
          if (lessSpeBtn) {
            var chevron = lessSpeBtn.querySelector(".directory_chevron_icon");
            if (chevron) {
              chevron.style.transition = "transform 0.2s ease";
              chevron.style.transform = speExpanded ? "rotate(180deg)" : "rotate(0deg)";
            }
          }


        // PRESTATIONS ---------------------------------------------------------
        if (prestaFilterWrapper) {
          var prestaFacetValues =
            results.getFacetValues("prestations", {
              sortBy: ["name:asc"]
            }) || [];

          if (!Array.isArray(prestaFacetValues)) prestaFacetValues = [];

          // debug léger pour vérifier qu’on a bien des valeurs
          console.log("[PRESTA] facets", prestaFacetValues);

          var serviceContainer = document.getElementById("serviceContainer");
          if (serviceContainer) {
            var hasPresta = prestaFacetValues.some(function (fv) {
              return fv && fv.count > 0;
            });
            serviceContainer.style.display = hasPresta ? "flex" : "none";
          }

          var maxToShowPresta = prestaExpanded ? prestaFacetValues.length : 6;

          var prestaListHtml = prestaFacetValues
            .filter(function (fv) {
              return fv && fv.name;
            })
            .slice(0, maxToShowPresta)
            .map(function (fv) {
              var key = "prestations:::" + fv.name;
              var isSelected = selectedFacetTags.has(key);
              return (
                '<div class="directory_category_tag_wrapper ' +
                (isSelected ? "is-selected" : "") +
                '" data-facet-name="prestations" data-facet-value="' +
                fv.name +
                '">' +
                fv.name +
                "</div>"
              );
            })
            .join("");

          prestaFilterWrapper.innerHTML = prestaListHtml;

          var morePrestaBtn = document.getElementById("more-presta");
          if (morePrestaBtn) {
            morePrestaBtn.textContent = prestaExpanded
              ? "En voir moins"
              : "Voir tous les services";
          }

          // header "lessPrest" (chevron dans le bloc mini)
          var lessPrestBtn = document.getElementById("lessPrest");
          if (lessPrestBtn) {
            var chevronPrest = lessPrestBtn.querySelector(".directory_chevron_icon");
            if (chevronPrest) {
              chevronPrest.style.transition = "transform 0.2s ease";
              chevronPrest.style.transform = prestaExpanded ? "rotate(180deg)" : "rotate(0deg)";
            }
          }
        } 
        
        // MÉTIERS --------------------------------------------------------------
        if (jobFilterWrapper) {

          var mainFacetValues =
            results.getFacetValues("mainjob", {
              sortBy: ["name:asc"]
            }) || [];
          var jobFacetValues =
            results.getFacetValues("jobs", {
              sortBy: ["name:asc"]
            }) || [];

          if (!Array.isArray(mainFacetValues)) mainFacetValues = [];
          if (!Array.isArray(jobFacetValues)) jobFacetValues = [];

          var merged = new Map();

          mainFacetValues.forEach(function (fv) {
            if (!fv || !fv.name) return;
            merged.set(fv.name, {
              name: fv.name,
              mainCount: fv.count || 0,
              jobCount: 0
            });
          });

          jobFacetValues.forEach(function (fv) {
            var nameRaw = fv && fv.name ? fv.name.trim() : "";
            if (!nameRaw) return;
            if (merged.has(nameRaw)) {
              var cur = merged.get(nameRaw);
              cur.jobCount = fv.count || 0;
            } else {
              merged.set(nameRaw, {
                name: nameRaw,
                mainCount: 0,
                jobCount: fv.count || 0
              });
            }
          });

          var mergedArr = Array.from(merged.values()).sort(function (a, b) {
            return (a.name || "").localeCompare(b.name || "");
          });

          var hasJobsFacet =
            mainFacetValues.some(function (fv) {
              return fv && fv.count > 0;
            }) ||
            jobFacetValues.some(function (fv) {
              return fv && fv.count > 0;
            });

          if (searchInstance && searchInstance.helper) {
            updateOnlyThpVisibility(searchInstance.helper.state, hasJobsFacet);
          }

          var maxToShowJob = jobExpanded ? mergedArr.length : 6;

          var jobListHtml = mergedArr
            .slice(0, maxToShowJob)
            .map(function (item) {
              var value = (item.name || "").trim();
              var key = "jobs:::" + value;
              var isSelected =
                selectedFacetTags.has(key) ||
                selectedJobTags.indexOf(value) !== -1;
              return (
                '<div class="directory_category_tag_wrapper ' +
                (isSelected ? "is-selected" : "") +
                '" data-facet-name="jobs" data-facet-value="' +
                value +
                '">' +
                value +
                "</div>"
              );
            })
            .join("");

          jobFilterWrapper.innerHTML = jobListHtml;

          var moreJobBtn = document.getElementById("more-job");
          if (moreJobBtn) {
            moreJobBtn.textContent = jobExpanded
              ? "En voir moins"
              : "Voir tous les métiers";
          }
          
          // header "lessJob" (chevron dans le bloc mini)
          var lessJobBtn = document.getElementById("lessJob");
          if (lessJobBtn) {
            var chevronJob = lessJobBtn.querySelector(".directory_chevron_icon");
            if (chevronJob) {
              chevronJob.style.transition = "transform 0.2s ease";
              chevronJob.style.transform = jobExpanded ? "rotate(180deg)" : "rotate(0deg)";
            }
          }

        }

        // BOOLÉENS -------------------------------------------------------------
        if (labelFilterWrapper) {
          labelFilterWrapper.innerHTML =
            '<div class="directory_category_tag_wrapper ' +
            (isNetworkSelected ? "is-selected" : "") +
            '" data-bool-filter="network">' +
            '<span class="directory_option_icon">' +
            '<svg width="auto" height="auto" viewBox="0 0 25 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23.984 17.5351L23.8018 17.3529C23.644 17.1937 23.3902 17.178 23.2152 17.32C21.8196 18.4516 20.2132 19.0167 18.393 19.0167C16.8483 19.0167 15.5201 18.509 14.41 17.4921C13.3973 16.567 12.6558 15.3435 12.1825 13.8231C12.1065 13.5778 12.2556 13.3197 12.5052 13.2594C14.4272 12.8062 16.091 12.34 17.498 11.8624C19.0155 11.3475 20.249 10.7853 21.1971 10.1757C22.1466 9.56609 22.8451 8.89483 23.2912 8.16333C23.7387 7.4304 23.9624 6.63149 23.9624 5.76517C23.9624 4.30074 23.3385 3.12891 22.0921 2.24824C20.8457 1.36758 19.2063 0.927246 17.1739 0.927246C15.7094 0.927246 14.354 1.17825 13.1076 1.67882C11.8612 2.18083 10.7912 2.87791 9.89618 3.77292C9.00261 4.66792 8.29693 5.72358 7.78345 6.94274C7.26853 8.16333 7.01035 9.4915 7.01035 10.9272V10.933C7.01035 11.2055 7.26136 11.4092 7.53101 11.3618C8.78459 11.1395 10.0511 10.9287 11.2344 10.6533C11.4381 10.606 11.5786 10.4195 11.5729 10.2101C11.5672 10.0451 11.5643 9.87733 11.5643 9.70809C11.5643 8.5965 11.6919 7.59391 11.9501 6.6989C12.2069 5.80533 12.5654 5.03224 13.0273 4.3825C13.4877 3.73132 14.0356 3.23075 14.6739 2.87791C15.3093 2.5265 16.0078 2.35008 16.7665 2.35008C17.716 2.35008 18.4604 2.62116 19.0026 3.16333C19.5448 3.7055 19.8159 4.42266 19.8159 5.31767C19.8159 7.31709 18.601 8.98089 16.1742 10.3091C16.1612 10.3162 16.1498 10.3248 16.1383 10.3334C15.8055 10.5715 15.1242 10.8986 13.9237 11.3432C13.8334 11.3762 13.7387 11.4063 13.6469 11.4393L13.6426 11.4422C13.5824 11.4637 13.5207 11.4823 13.4604 11.5024C13.4203 11.5167 13.3801 11.5297 13.34 11.5426C12.9613 11.6673 12.5812 11.7835 12.2011 11.8882C12.0448 11.9341 11.8884 11.98 11.7264 12.0245L11.7249 12.0159C6.89131 13.2451 2.14661 12.9338 0.111328 12.7072C1.45671 13.1705 5.65063 13.661 7.08494 13.8217C9.05711 17.3773 11.963 19.7755 13.1693 20.2359C15.6549 20.9272 19.8288 20.6633 21.0766 20.1341C22.1853 19.6651 23.1549 19.0067 23.9854 18.1605Z" fill="currentColor"></path></svg>' +
            "</span>" +
            "<span>Membres réseaux</span>" +
            "</div>";
        }

        // filtres visio / domicile → seulement si aucun type OU thérapeutes
        if (remoteFilterWrapper) {
          remoteFilterWrapper.style.display = shouldShowTheraOnlyFilters
            ? "flex"
            : "none";
          remoteFilterWrapper.innerHTML =
            '<div class="directory_category_tag_wrapper ' +
            (isRemoteSelected ? "is-selected" : "") +
            '" data-bool-filter="remote">' +
            '<span class="directory_option_icon">' +
            '<svg width="auto" height="auto" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M0 10.5697C0 4.73221 4.5667 0 10.2 0C15.8333 0 20.4 4.73222 20.4 10.5697V14.4485C20.4 14.9305 20.0229 15.3212 19.5578 15.3212C19.0927 15.3212 18.7156 14.9305 18.7156 14.4485V10.5697C18.7156 5.6962 14.903 1.74545 10.2 1.74545C5.49697 1.74545 1.6844 5.6962 1.6844 10.5697V14.4485C1.6844 14.9305 1.30734 15.3212 0.842202 15.3212C0.377067 15.3212 0 14.9305 0 14.4485V10.5697ZM2.80734 12.9939C2.80734 11.1731 4.23181 9.69697 5.98899 9.69697C7.74617 9.69697 9.17064 11.1731 9.17064 12.9939V15.903C9.17064 17.7239 7.74617 19.2 5.98899 19.2C4.23181 19.2 2.80734 17.7239 2.80734 15.903V12.9939ZM5.98899 11.4424C5.16208 11.4424 4.49174 12.1371 4.49174 12.9939V15.903C4.49174 16.7599 5.16208 17.4545 5.98899 17.4545C6.8159 17.4545 7.48624 16.7599 7.48624 15.903V12.9939C7.48624 12.1371 6.8159 11.4424 5.98899 11.4424ZM11.2294 12.9939C11.2294 11.1731 12.6538 9.69697 14.411 9.69697C16.1682 9.69697 17.5927 11.1731 17.5927 12.9939V15.903C17.5927 17.7239 16.1682 19.2 14.411 19.2C12.6538 19.2 11.2294 17.7239 11.2294 15.903V12.9939ZM14.411 11.4424C13.5841 11.4424 12.9138 12.1371 12.9138 12.9939V15.903C12.9138 16.7599 13.5841 17.4545 14.411 17.4545C15.2379 17.4545 15.9083 16.7599 15.9083 15.903V12.9939C15.9083 12.1371 15.2379 11.4424 14.411 11.4424Z" fill="currentColor"></path></svg>' +
            "</span>" +
            "<span>Travail en visio</span>" +
            "</div>";
        }

        if (atHomeFilterWrapper) {
          atHomeFilterWrapper.style.display = shouldShowTheraOnlyFilters
            ? "flex"
            : "none";
          atHomeFilterWrapper.innerHTML =
            '<div class="directory_category_tag_wrapper ' +
            (isAtHomeSelected ? "is-selected" : "") +
            '" data-bool-filter="athome">' +
            '<span class="directory_option_icon">' +
            '<svg width="auto" height="auto" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.72983 1.95795C9.655 1.90735 9.545 1.90735 9.47017 1.95795L1.98217 7.02182C1.9314 7.05615 1.92 7.09646 1.92 7.11941V16.5967C1.92 16.9292 2.21782 17.28 2.688 17.28H16.512C16.9822 17.28 17.28 16.9292 17.28 16.5967V7.11941C17.28 7.09646 17.2686 7.05615 17.2178 7.02182L9.72983 1.95795ZM8.39461 0.367496C9.11917 -0.1225 10.0808 -0.122498 10.8054 0.367497L18.2934 5.43136C18.8504 5.80805 19.2 6.43312 19.2 7.11941V16.5967C19.2 18.0793 17.9505 19.2 16.512 19.2H2.688C1.24948 19.2 0 18.0793 0 16.5967V7.11941C0 6.43312 0.349589 5.80805 0.906605 5.43136L8.39461 0.367496Z" fill="currentColor"></path></svg>' +
            "</span>" +
            "<span>Se déplace à domicile</span>" +
            "</div>";
        }

        // REMBOURSEMENT --------------------------------------------------------
        if (discountFilterWrapper) {
          var reimburseFacetValues =
            results.getFacetValues("reimbursment_percentage", {
              sortBy: ["name:asc"]
            }) || [];
          if (!Array.isArray(reimburseFacetValues)) {
            reimburseFacetValues = [];
          }

          // on nettoie / trie
          var filtered = reimburseFacetValues
            .filter(function (fv) {
              return fv && fv.name !== undefined && fv.name !== null;
            })
            .map(function (fv) {
              return {
                name: String(fv.name),
                count: fv.count || 0
              };
            })
            .filter(function (v) {
              return v.name !== "";
            })
            .sort(function (a, b) {
              return Number(a.name) - Number(b.name);
            });

          // on mémorise toutes les valeurs pour le click handler
          discountRawValues = filtered.map(function (item) {
            return item.name;
          });

          // au moins une valeur < 50 ?
          var hasBelow50 = filtered.some(function (item) {
            return Number(item.name) < 50;
          });

          var html = "";

          // tag virtuel <50%
          if (hasBelow50) {
            var virtualKey = "reimbursment_percentage:::lt50";
            var isSelectedVirtual = selectedFacetTags.has(virtualKey);
            html +=
              '<div class="directory_category_tag_wrapper ' +
              (isSelectedVirtual ? "is-selected" : "") +
              '" data-facet-name="reimbursment_percentage" data-facet-value="lt50">' +
              "<div>&lt;50%</div></div>";
          }

          // valeurs réelles mais seulement >= 50
          html += filtered
            .filter(function (item) {
              return Number(item.name) >= 50;
            })
            .map(function (item) {
              var key = "reimbursment_percentage:::" + item.name;
              var isSelected = selectedFacetTags.has(key);
              return (
                '<div class="directory_category_tag_wrapper ' +
                (isSelected ? "is-selected" : "") +
                '" data-facet-name="reimbursment_percentage" data-facet-value="' +
                item.name +
                '"><div>' +
                item.name +
                "%</div></div>"
              );
            })
            .join("");

          discountFilterWrapper.innerHTML = html;
        }
      }
    };

    // 7. WIDGETS ALGOLIA ------------------------------------------------------
    search.addWidgets([
      instantsearch.widgets.configure({
        facets: ["specialities", "prestations", "mainjob", "jobs"],
        disjunctiveFacets: ["type", "reimbursment_percentage"],
        hitsPerPage: 48,
  attributesToRetrieve: [
    "name",
    "url",
    "photo_url",
    "is_elsee_network",
    "is_remote",
    "is_at_home",
    "reimbursment_percentage",
    "city",
    "department_number",
    "mainjob",
    "jobs",
    "prestations",
    "specialities",
    "short_desc",
    "show_search",
    "show_home",
    "ranking",
    "type",
    "odoo_id" // <--- IMPORTANT
  ]
      }),
      instantsearch.widgets.searchBox({
        container: "#searchbox",
        placeholder: "Écrivez ici tout ce qui concerne vos besoins...",
        cssClasses: {
          root: "directory_search_field_container",
          input: "directory_search_text"
        }
      }),
      instantsearch.widgets.stats({
        container: "#search_count",
        templates: {
          text: function (data) {
            if (data.nbHits === 0) return "0 résultat";
            if (data.nbHits === 1) return "1 résultat";
            return data.nbHits + " résultats";
          }
        }
      }),
      instantsearch.widgets.infiniteHits({
        container: "#hits",
        hitsPerPage: 48,
        showMore: true,
        cssClasses: {
          loadMore: "directory_show_more_button"
        },
        transformItems: function (items) {
  var query = "";
  if (searchInstance && searchInstance.helper && searchInstance.helper.state) {
    query = (searchInstance.helper.state.query || "").trim().toLowerCase();
  }

  // === MAJ de l'ensemble des odoo_id du bloc principal ===
  mainHitOdooSet.clear();
  items.forEach(function (hit) {
    if (hit && hit.odoo_id != null) {
      mainHitOdooSet.add(String(hit.odoo_id));
    }
  });
  console.log("[DEDUPE] mainHitOdooSet (from transformItems) =", Array.from(mainHitOdooSet));

  // scoring local / tri
  items.forEach(function (hit) {
    var name = (hit.name || "").toLowerCase();
    var score = 0;

    if (query) {
      if (name === query) {
        score = 3;
      } else if (name.indexOf(query) === 0) {
        score = 2;
      } else if (name.indexOf(query) !== -1) {
        score = 1;
      }
    }

    var networkBonus = hit.is_elsee_network ? 1 : 0;

    hit.__localScore = score;
    hit.__networkBonus = networkBonus;
  });

  return items.slice().sort(function (a, b) {
    if ((b.__localScore || 0) !== (a.__localScore || 0)) {
      return (b.__localScore || 0) - (a.__localScore || 0);
    }
    if ((b.__networkBonus || 0) !== (a.__networkBonus || 0)) {
      return (b.__networkBonus || 0) - (a.__networkBonus || 0);
    }
    var rankA = typeof a.ranking === "number" ? a.ranking : parseFloat(a.ranking) || 0;
    var rankB = typeof b.ranking === "number" ? b.ranking : parseFloat(b.ranking) || 0;
    if (rankA !== rankB) return rankB - rankA;
    var nameA = (a.name || "").toLowerCase();
    var nameB = (b.name || "").toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
},


        templates: {
          item: function (hit) {
            var photoUrl = hit.photo_url || "";
            var isNetwork = !!hit.is_elsee_network; // vrai seulement si le record l’est
            var isRemote = !!hit.is_remote;
            var isAtHome = !!hit.is_at_home;
            var reimbursement =
              hit.reimbursment_percentage != null
                ? hit.reimbursment_percentage
                : "";
            var name = hit.name || "";
            var city = hit.city || "";
            var depNum = hit.department_number || "";
            var url = hit.url || "#";
            var showSearch = hit.show_search !== false;
            var showHome = !!hit.show_home;
            var Therapeutes = isTherapeutes(hit);

            var remoteSvg =
              (document.querySelector(".directory_remote_icon") || {})
                .innerHTML || "";
            var atHomeSvg =
              (document.querySelector(".directory_at_home_icon") || {})
                .innerHTML || "";
            var discountSvg =
              (document.querySelector(".directory_discount_icon") || {})
                .innerHTML || "";
            var locationSvg =
              (document.querySelector(".directory_card_location_icon") || {})
                .innerHTML || "";

            var containStyle =
              "background-position:50% 50%;background-size:contain;background-repeat:no-repeat;";
            var coverStyle =
              "background-position:50% 50%;background-size:cover;background-repeat:no-repeat;";

            var finalStyle;
            if (photoUrl) {
              if (Therapeutes) {
                finalStyle =
                  coverStyle + "background-image:url('" + photoUrl + "');";
              } else {
                finalStyle =
                  containStyle + "background-image:url('" + photoUrl + "');";
              }
            } else {
              if (Therapeutes) {
                finalStyle =
                  coverStyle +
                  "background-image:url('" +
                  THERAPIST_PLACEHOLDER_URL +
                  "');";
              } else {
                finalStyle =
                  coverStyle +
                  "background-image:url('" +
                  DEFAULT_PLACEHOLDER_URL +
                  "');";
              }
            }

            var photoClasses = "directory_card_photo";
if (isNetwork) {
  photoClasses += " is-label";
}
if (Therapeutes) {
  photoClasses += " is-cover";
} else {
  photoClasses += " is-contain";
}



            var photoDiv =
              '<div class="directory_card_photo_container">' +
              '<div class="directory_card_photo' +
              (isNetwork ? " is-label" : "") +
              '" style="' +
              finalStyle +
              '">' +
              '<div class="directory_card_label_tag" style="display:' +
              (isNetwork ? "flex" : "none") +
              ';">' +
              '<img src="https://cdn.prod.website-files.com/64708634ac0bc7337aa7acd8/65a65b49a0e66151845cad61_mob_menu_logo_dark_green.svg" loading="lazy" alt="" class="directory_card_label_tag_logo">' +
              "</div>" +
              "</div>" +
              "</div>";

            var remoteIcon =
              '<div class="directory_remote_icon" style="display:' +
              (isRemote ? "block" : "none") +
              ';">' +
              remoteSvg +
              '<div class="tooltip">Consultation en visio</div>' +
              "</div>";

            var atHomeIcon =
              '<div class="directory_at_home_icon" style="display:' +
              (isAtHome ? "block" : "none") +
              ';">' +
              atHomeSvg +
              '<div class="tooltip">Se déplace à votre domicile</div>' +
              "</div>";

            var showDiscount = !Therapeutes;
            var discountDiv =
              '<div class="directory_card_discount_tag" style="display:' +
              (showDiscount ? "flex" : "none") +
              ';">' +
              '<div class="directory_discount_icon">' +
              discountSvg +
              "</div>" +
              "<div>" +
              (reimbursement !== "" ? reimbursement + "%" : "") +
              "</div>" +
              "</div>";

            var titleDiv =
              '<div class="directory_card_title"><div>' +
              name +
              "</div></div>";

            var prestationsArr = toArray(hit.prestations);
            var specialitiesArr = toArray(hit.specialities);
            // bloc partenaire details 1
var partnerDetails1Html;

if (Therapeutes) {
  // cas thérapeutes : on garde le mainjob tel quel
  var mainJob = hit.mainjob || "";
  partnerDetails1Html =
    '<div class="directory_card_partner_details_1"><div>' +
    mainJob +
    "</div></div>";
} else {
  // on prend d'abord les prestations, sinon les spécialités
  var rawTop = toArray(hit.prestations);
  if (!rawTop.length) {
    rawTop = toArray(hit.specialities);
  }

  var maxTop = 3; // nombre qu’on affiche
  var visibleTop = rawTop.slice(0, maxTop);
  var extraTop = rawTop.length > maxTop ? rawTop.length - maxTop : 0;

  var topHtml = visibleTop.join(", ");

  if (extraTop > 0) {
    topHtml +=
      ', <span class="directory_card_more_specialities"><span class="directory_remote_icon">+' +
      extraTop +
      "</span></span>";
  }

  partnerDetails1Html =
    '<div class="directory_card_partner_details_1"><div>' +
    topHtml +
    "</div></div>";
}


            var partnerDetails2Html;
            if (Therapeutes) {
              var jobsArr = toArray(hit.jobs);
              var jobsTxt;
              if (jobsArr.length > 3) {
                var firstThree = jobsArr.slice(0, 3).join(", ");
                var extraCountJobs = jobsArr.length - 3;
                jobsTxt = firstThree + " +" + extraCountJobs;
              } else {
                jobsTxt = jobsArr.join(", ");
              }
              partnerDetails2Html =
                '<div class="directory_card_partner_details_2"><div>' +
                jobsTxt +
                "</div></div>";
            } else {
              var shortTxt = truncate(hit.short_desc || "", 70);
              partnerDetails2Html =
                '<div class="directory_card_partner_details_2"><div class="directory_card_partner_short_desc">' +
                shortTxt +
                "</div></div>";
            }

            var showLocation = true;
            if (!showSearch) showLocation = false;
            if (!city && !depNum) showLocation = false;

            var locationText =
              Therapeutes
                ? city + (depNum ? " (" + depNum + ")" : "")
                : city;

            var locationDiv =
              '<div class="directory_card_partner_location" style="display:' +
              (showLocation ? "flex" : "none") +
              ';">' +
              '<div class="directory_card_location_icon">' +
              locationSvg +
              "</div>" +
              '<div class="directory_card_location_text"><div>' +
              locationText +
              "</div></div>" +
              "</div>";

            var rawTags;
if (Therapeutes) {
  rawTags = toArray(hit.prestations);
} else {
  rawTags = toArray(hit.specialities);
}

var maxTags = 2;
var visibleTags = rawTags.slice(0, maxTags);
var extraCount = rawTags.length > maxTags ? rawTags.length - maxTags : 0;

var prestasHtml = visibleTags
  .map(function (p) {
    return (
      '<div class="directory_card_prestation_tag"><div>' +
      p +
      "</div></div>"
    );
  })
  .join("");

// si plus que la limite, on ajoute un tag "+X"
if (extraCount > 0) {
  prestasHtml +=
    '<div class="directory_card_prestation_tag"><div>+' +
    extraCount +
    "</div></div>";
}


            var prestationsDiv =
              '<div class="directory_card_prestations_container">' +
              prestasHtml +
              "</div>";

            return (
              '<li class="directory_card_container">' +
              '<a href="' +
              url +
              '" class="directory_card_body">' +
              '<div class="directory_card_upper_container">' +
              '<div class="directory_card_header">' +
              photoDiv +
              '<div class="directory_card_options_container">' +
              remoteIcon +
              atHomeIcon +
              discountDiv +
              "</div>" +
              "</div>" +
              titleDiv +
partnerDetails1Html +
partnerDetails2Html +

              "</div>" +
              locationDiv +
              prestationsDiv +
              "</a>" +
              "</li>"
            );
          },
          empty: "<div>Aucun résultat trouvé.</div>",
          showMoreText: "Afficher plus de résultat"
        }
      }),
      dynamicSuggestionsWidget
    ]);
// === Fabrique HTML d'une carte (même logique que le template principal) ===
function buildCardHTML(hit) {
  var photoUrl = hit.photo_url || "";
  var isNetwork = !!hit.is_elsee_network;
  var isRemote = !!hit.is_remote;
  var isAtHome = !!hit.is_at_home;
  var reimbursement = hit.reimbursment_percentage != null ? hit.reimbursment_percentage : "";
  var name = hit.name || "";
  var city = hit.city || "";
  var depNum = hit.department_number || "";
  var url = hit.url || "#";
  var showSearch = hit.show_search !== false;
  var Therapeutes = isTherapeutes(hit);

  var remoteSvg = (document.querySelector(".directory_remote_icon") || {}).innerHTML || "";
  var atHomeSvg  = (document.querySelector(".directory_at_home_icon") || {}).innerHTML || "";
  var discountSvg = (document.querySelector(".directory_discount_icon") || {}).innerHTML || "";
  var locationSvg = (document.querySelector(".directory_card_location_icon") || {}).innerHTML || "";

  var containStyle = "background-position:50% 50%;background-size:contain;background-repeat:no-repeat;";
  var coverStyle   = "background-position:50% 50%;background-size:cover;background-repeat:no-repeat;";

  var finalStyle;
  if (photoUrl) {
    finalStyle = (Therapeutes ? coverStyle : containStyle) + "background-image:url('" + photoUrl + "');";
  } else {
    finalStyle = coverStyle + "background-image:url('" + (Therapeutes ? THERAPIST_PLACEHOLDER_URL : DEFAULT_PLACEHOLDER_URL) + "');";
  }

  var photoClasses = "directory_card_photo";
  if (isNetwork) photoClasses += " is-label";
  photoClasses += Therapeutes ? " is-cover" : " is-contain";

  var photoDiv =
    '<div class="directory_card_photo_container">' +
      '<div class="' + photoClasses + '" style="' + finalStyle + '">' +
        '<div class="directory_card_label_tag" style="display:' + (isNetwork ? "flex" : "none") + ';">' +
          '<img src="https://cdn.prod.website-files.com/64708634ac0bc7337aa7acd8/65a65b49a0e66151845cad61_mob_menu_logo_dark_green.svg" loading="lazy" alt="" class="directory_card_label_tag_logo">' +
        "</div>" +
      "</div>" +
    "</div>";

  var remoteIcon =
    '<div class="directory_remote_icon" style="display:' + (isRemote ? "block" : "none") + ';">' +
      remoteSvg + '<div class="tooltip">Consultation en visio</div>' +
    "</div>";

  var atHomeIcon =
    '<div class="directory_at_home_icon" style="display:' + (isAtHome ? "block" : "none") + ';">' +
      atHomeSvg + '<div class="tooltip">Se déplace à votre domicile</div>' +
    "</div>";

  var showDiscount = !Therapeutes;
  var discountDiv =
    '<div class="directory_card_discount_tag" style="display:' + (showDiscount ? "flex" : "none") + ';">' +
      '<div class="directory_discount_icon">' + discountSvg + "</div>" +
      "<div>" + (reimbursement !== "" ? reimbursement + "%" : "") + "</div>" +
    "</div>";

  var titleDiv = '<div class="directory_card_title"><div>' + name + "</div></div>";

  // détails 1 & 2
  var partnerDetails1Html, partnerDetails2Html;

  if (Therapeutes) {
    var mainJob = hit.mainjob || "";
    partnerDetails1Html = '<div class="directory_card_partner_details_1"><div>' + mainJob + "</div></div>";

    var jobsArr = toArray(hit.jobs);
    var jobsTxt;
    if (jobsArr.length > 3) {
      jobsTxt = jobsArr.slice(0, 3).join(", ") + " +" + (jobsArr.length - 3);
    } else {
      jobsTxt = jobsArr.join(", ");
    }
    partnerDetails2Html = '<div class="directory_card_partner_details_2"><div>' + jobsTxt + "</div></div>";
  } else {
    var rawTop = toArray(hit.prestations);
    if (!rawTop.length) rawTop = toArray(hit.specialities);
    var maxTop = 3, visibleTop = rawTop.slice(0, maxTop), extraTop = rawTop.length > maxTop ? rawTop.length - maxTop : 0;
    var topHtml = visibleTop.join(", ");
    if (extraTop > 0) {
      topHtml += ', <span class="directory_card_more_specialities"><span class="directory_remote_icon">+' + extraTop + "</span></span>";
    }
    partnerDetails1Html = '<div class="directory_card_partner_details_1"><div>' + topHtml + "</div></div>";

    var shortTxt = truncate(hit.short_desc || "", 70);
    partnerDetails2Html = '<div class="directory_card_partner_details_2"><div class="directory_card_partner_short_desc">' + shortTxt + "</div></div>";
  }

  var showLocation = !!showSearch && (city || depNum);
  var locationText = Therapeutes ? (city + (depNum ? " (" + depNum + ")" : "")) : city;
  var locationDiv =
    '<div class="directory_card_partner_location" style="display:' + (showLocation ? "flex" : "none") + ';">' +
      '<div class="directory_card_location_icon">' + locationSvg + "</div>" +
      '<div class="directory_card_location_text"><div>' + (locationText || "") + "</div></div>" +
    "</div>";

  var rawTags = Therapeutes ? toArray(hit.prestations) : toArray(hit.specialities);
  var maxTags = 2, visibleTags = rawTags.slice(0, maxTags), extraCount = rawTags.length > maxTags ? rawTags.length - maxTags : 0;
  var prestasHtml = visibleTags.map(function (p) {
    return '<div class="directory_card_prestation_tag"><div>' + p + "</div></div>";
  }).join("");
  if (extraCount > 0) {
    prestasHtml += '<div class="directory_card_prestation_tag"><div>+' + extraCount + "</div></div>";
  }
  var prestationsDiv = '<div class="directory_card_prestations_container">' + prestasHtml + "</div>";

  return (
    '<a href="' + url + '" class="directory_card_body">' +
      '<div class="directory_card_upper_container">' +
        '<div class="directory_card_header">' +
          photoDiv +
          '<div class="directory_card_options_container">' + remoteIcon + atHomeIcon + discountDiv + '</div>' +
        '</div>' +
        titleDiv + partnerDetails1Html + partnerDetails2Html +
      '</div>' +
      locationDiv + prestationsDiv +
    '</a>'
  );
}



// === Tri identique à transformItems principal ===
function sortHitsLikeMain(items, query) {
  var q = (query || "").trim().toLowerCase();
  items.forEach(function (hit) {
    var name = (hit.name || "").toLowerCase();
    var score = 0;
    if (q) {
      if (name === q) score = 3;
      else if (name.indexOf(q) === 0) score = 2;
      else if (name.indexOf(q) !== -1) score = 1;
    }
    hit.__localScore = score;
    hit.__networkBonus = hit.is_elsee_network ? 1 : 0;
  });

  return items.slice().sort(function (a, b) {
    if ((b.__localScore || 0) !== (a.__localScore || 0)) {
      return (b.__localScore || 0) - (a.__localScore || 0);
    }
    if ((b.__networkBonus || 0) !== (a.__networkBonus || 0)) {
      return (b.__networkBonus || 0) - (a.__networkBonus || 0);
    }
    var rankA = typeof a.ranking === "number" ? a.ranking : parseFloat(a.ranking) || 0;
    var rankB = typeof b.ranking === "number" ? b.ranking : parseFloat(b.ranking) || 0;
    if (rankA !== rankB) return rankB - rankA;
    var nameA = (a.name || "").toLowerCase();
    var nameB = (b.name || "").toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
}

    // 8. START ---------------------------------------------------------------
    search.start();
// === Index direct (requêtes secondaires sans géoloc) ===
var rawIndex = null;
try { rawIndex = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY).initIndex(ALGOLIA_INDEX_NAME); } catch(e) {}

// Normalisation simple sans accents
function normTxt(s){
  return (s||"").toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Récupère tags sélectionnés
function getSelectedArray(prefix) {
  return Array.from(selectedFacetTags)
    .filter(function (k) { return k.indexOf(prefix + ":::") === 0; })
    .map(function (k) { return k.split(":::")[1]; });
}

function buildFacetFiltersForTherapeutes() {
  var arr = [];
  // type Thérapeutes (avec et sans accent pour robustesse)
  arr.push(["type:Thérapeutes", "type:therapeutes"]);

  // appliquer les sélections prestas / specialities si présentes
  var selectedPrestas = getSelectedArray("prestations");
  var selectedSpecs   = getSelectedArray("specialities");

  selectedPrestas.forEach(function (p) { arr.push("prestations:" + p); });
  selectedSpecs.forEach(function (s) { arr.push("specialities:" + s); });

  return arr;
}

function buildFacetFiltersFor(label) {
  var arr = [];

  // type ciblé
  arr.push(["type:" + label]);

  // on réutilise les mêmes helpers que pour les thérapeutes
  var selectedPrestas = getSelectedArray("prestations");
  var selectedSpecs   = getSelectedArray("specialities");

  selectedPrestas.forEach(function (p) {
    arr.push("prestations:" + p);
  });
  selectedSpecs.forEach(function (s) {
    arr.push("specialities:" + s);
  });

  return arr;
}


function makeFiltersString(extra, ignoreGeo) {
  // jobs + booléens (network / remote / athome)
  var userFilters = buildFiltersStringFromJobsAndBooleans();
  var visibility  = getVisibilityFilter(!!ignoreGeo);

  var parts = [];
  if (userFilters && userFilters.length) parts.push(userFilters);
  if (visibility && visibility.length)   parts.push(visibility);
  if (extra && extra.length)             parts.push(extra);

  return parts.join(" AND ");
}

// Construit l’URL "Voir plus de X" pour les hits secondaires
function buildMoreUrlForType(typeFacetValue) {
  if (!searchInstance || !searchInstance.helper) {
    return DIRECTORY_BASE_URL;
  }

  var helper = searchInstance.helper;
  var state  = helper.state;

  // --- Query ---------------------------------------------------
  var params = new URLSearchParams();
  var query = (state.query || "").trim();
  if (query) {
    params.set("q", query);
  }

  // --- Facets / disjunctiveFacets ------------------------------
  var facetRef = state.facetsRefinements || {};
  var disjRef  = state.disjunctiveFacetsRefinements || {};

  var typeRef =
    (disjRef.type && disjRef.type.length ? disjRef.type : facetRef.type) || [];

  var speRef =
    (disjRef.specialities && disjRef.specialities.length
      ? disjRef.specialities
      : facetRef.specialities) || [];

  var prestaRef =
    (facetRef.prestations && facetRef.prestations.length
      ? facetRef.prestations
      : []) || [];

  var reimbRef =
    (disjRef.reimbursment_percentage &&
      disjRef.reimbursment_percentage.length
      ? disjRef.reimbursment_percentage
      : []) || [];

  var hasSpeOrPresta =
    (speRef && speRef.length > 0) ||
    (prestaRef && prestaRef.length > 0);

  // --- Types ---------------------------------------------------
  var finalTypes;

  if (!hasSpeOrPresta) {
    // cas demandé : aucune presta/spe → on force le type du bloc
    finalTypes = typeFacetValue ? [typeFacetValue] : [];
  } else {
    // on garde les types déjà sélectionnés
    finalTypes = typeRef;
  }

  if (finalTypes && finalTypes.length) {
    params.set("type", finalTypes.join(","));
  } else {
    params.delete("type");
  }

  // --- Specialities / Prestations ------------------------------
  if (hasSpeOrPresta) {
    if (speRef && speRef.length) {
      params.set("specialities", speRef.join(","));
    } else {
      params.delete("specialities");
    }

    if (prestaRef && prestaRef.length) {
      params.set("prestations", prestaRef.join(","));
    } else {
      params.delete("prestations");
    }
  } else {
    // aucune presta/spe dans ce cas → rien dans l’URL
    params.delete("specialities");
    params.delete("prestations");
  }

  // --- Remboursement -------------------------------------------
  if (reimbRef && reimbRef.length) {
    params.set("reimbursment_percentage", reimbRef.join(","));
  } else {
    params.delete("reimbursment_percentage");
  }

  // --- Jobs (gardés dans tous les cas) -------------------------
  if (selectedJobTags && selectedJobTags.length > 0) {
    params.set("jobs", selectedJobTags.join(","));
  } else {
    params.delete("jobs");
  }

  // --- Booléens (network / remote / athome) --------------------
  if (isNetworkSelected) params.set("network", "true");
  else params.delete("network");

  if (isRemoteSelected) params.set("remote", "true");
  else params.delete("remote");

  if (isAtHomeSelected) params.set("athome", "true");
  else params.delete("athome");

  // --- Géoloc : JAMAIS dans l’URL des hits secondaires ---------
  params.delete("geo");
  params.delete("geolabel");

  var qs = params.toString();
  var finalUrl = DIRECTORY_BASE_URL + (qs ? "?" + qs : "");

  console.log("[MORE] buildMoreUrlForType", {
    typeFacetValue: typeFacetValue,
    hasSpeOrPresta: hasSpeOrPresta,
    finalTypes: finalTypes,
    speRef: speRef,
    prestaRef: prestaRef,
    reimbRef: reimbRef,
    jobs: (selectedJobTags || []).slice(),
    isNetworkSelected: isNetworkSelected,
    isRemoteSelected: isRemoteSelected,
    isAtHomeSelected: isAtHomeSelected,
    finalUrl: finalUrl
  });

  return finalUrl;
}



function renderInto(containerId, hits, opts) {
  var container = document.getElementById(containerId);
  if (!container) return;

  opts = opts || {};
  var typeFacetValue = opts.typeFacetValue || ""; // ex: "Thérapeutes", "Marques", "Applications & Programmes"
  var label = (opts.label || typeFacetValue || "").toLowerCase(); // pour le texte

  var query =
    (searchInstance &&
      searchInstance.helper &&
      searchInstance.helper.state &&
      searchInstance.helper.state.query) || "";

  // Retire les hits déjà présents dans le bloc principal (on compare href ET pathname)
    // Retire les hits déjà présents dans le bloc principal (on compare par odoo_id)
  var pruned = (hits || []).filter(function (hit) {
    if (!hit) return false;

    if (hit.odoo_id != null) {
      var key = String(hit.odoo_id);
      if (mainHitOdooSet.has(key)) {
        console.log("[DEDUPE] secondaire supprimé (odoo_id déjà vu)", key);
        return false;
      }
    }

    return true;
  });




  var sorted = sortHitsLikeMain(pruned, query);

  // on limite à 5
  var visible = sorted.slice(0, 5);

  // liste HTML : <ol> -> <li class="ais-InfiniteHits-item"><div class="directory_card_container">…</div></li>
  var itemsHtml = visible
    .map(function (hit) {
      return (
        '<li class="ais-InfiniteHits-item">' +
          '<div class="directory_card_container">' +
            buildCardHTML(hit) + // buildCardHTML doit retourner le <a class="directory_card_body">…</a> SEUL
          '</div>' +
        '</li>'
      );
    })
    .join("");

  // 6e : carte “voir plus”
  console.log("[MORE] renderInto() – containerId =", containerId,
            "typeFacetValue =", typeFacetValue,
            "label =", label,
            "visible.length =", visible.length);

  var moreUrl = buildMoreUrlForType(typeFacetValue);
  var moreItemHtml =
    '<li class="ais-InfiniteHits-item">' +
      '<div class="more-card">' +
        '<a href="' + moreUrl + '" class="directory_more_card_body">' +
          '<div class="directory_more_card_title"><div>voir plus de ' + (label || "résultats") + '</div></div>' +
        '</a>' +
      '</div>' +
    '</li>';

  var html =
    '<ol class="ais-InfiniteHits-list">' +
      itemsHtml +
      moreItemHtml +
    '</ol>';

  container.innerHTML = html;
}
// <-- ferme bien renderInto ici

function toggleWrapper(wrapperId, count) {
  var wrap = document.getElementById(wrapperId);
  if (!wrap) return;
  wrap.style.display = count > 0 ? "flex" : "none";
}

async function fetchAndRenderMoreBlocks() {
  var more = document.getElementById("more-results");
  if (!rawIndex || !more) return;

  // Afficher ces blocs SEULEMENT quand une recherche géoloc a été lancée
  var hasGeo = !!currentGeoFilter;
  if (!hasGeo) {
    more.style.display = "none";
    toggleWrapper("hits_therapeutes_wrapper", 0);
    toggleWrapper("hits_marques_wrapper", 0);
    toggleWrapper("hits_applications_programmes_wrapper", 0);
    return;
  }

  more.style.display = "flex";

  var hasJobFilter = (selectedJobTags && selectedJobTags.length > 0);
  var queryStr =
    (searchInstance &&
      searchInstance.helper &&
      searchInstance.helper.state &&
      searchInstance.helper.state.query) || "";

  // === THÉRAPEUTES SECONDAIRES : seulement visio, pas d'impact géoloc ===
  var thFacetFilters = buildFacetFiltersForTherapeutes();
  // on force ici is_remote:true et on ignore la géoloc dans la visibilité
  var thFilters = makeFiltersString("is_remote:true", true);

  var thRes = await rawIndex
    .search(queryStr, {
      hitsPerPage: 24,
      facetFilters: thFacetFilters,
      filters: thFilters
    })
    .catch(() => ({ hits: [] }));

  var thHits = (thRes && thRes.hits) || [];
  renderInto("hits_therapeutes", thHits, {
    typeFacetValue: "Thérapeutes",
    label: "thérapeutes en visio"
  });
  toggleWrapper("hits_therapeutes_wrapper", thHits.length);

  // === Marques + Applications seulement si pas de job ===
  if (!hasJobFilter) {
    // --- Marques ---
    var mqFacetFilters = buildFacetFiltersFor("Marques");
    var mqFilters = makeFiltersString("", true); // ignore géoloc

    var mqRes = await rawIndex
      .search(queryStr, {
        hitsPerPage: 24,
        facetFilters: mqFacetFilters,
        filters: mqFilters
      })
      .catch(() => ({ hits: [] }));

    var mqHits = (mqRes && mqRes.hits) || [];
    renderInto("hits_marques", mqHits, {
      typeFacetValue: "Marques",
      label: "marques"
    });
    toggleWrapper("hits_marques_wrapper", mqHits.length);

    // --- Applications et programmes ---
    var apFacetFilters = buildFacetFiltersFor("Applications et programmes");
    var apFilters = makeFiltersString("", true); // ignore géoloc

    var apRes = await rawIndex
      .search(queryStr, {
        hitsPerPage: 24,
        facetFilters: apFacetFilters,
        filters: apFilters
      })
      .catch(() => ({ hits: [] }));

    var apHits = (apRes && apRes.hits) || [];
    renderInto("hits_applications_programmes", apHits, {
      typeFacetValue: "Applications et programmes",
      label: "applications et programmes"
    });
    toggleWrapper("hits_applications_programmes_wrapper", apHits.length);
  } else {
    // job sélectionné → on masque Marques + Applications
    toggleWrapper("hits_marques_wrapper", 0);
    toggleWrapper("hits_applications_programmes_wrapper", 0);
  }
}

   
    // 9. RENDER GLOBAL --------------------------------------------------------
    search.on("render", function () {
      // 1) S’assurer que les params URL sont appliqués une fois que tout est prêt
  if (!urlParamsApplied && searchInstance && searchInstance.helper) {
    urlParamsApplied = true;
    applyUrlParamsToSearch();
    // on laisse applyUrlParamsToSearch déclencher son propre helper.search()
    // le prochain render utilisera déjà l’état construit depuis l’URL
    return;
  }

  // 2) Rendu normal
  renderClearButton();

  if (search.helper && search.helper.state) {
    updateUrlFromState(search.helper.state);
  }

    var perPage = 48;

  // cartes visibles
  var cards = Array.prototype.slice
    .call(document.querySelectorAll("#hits .directory_card_container"))
    .filter(function (el) {
      return el.offsetParent !== null;
    });

  // bouton lui-même
  var showMoreBtn = document.querySelector(".directory_show_more_button");

  // wrapper algolia autour du bouton
  var showMoreWrapper = document.querySelector(
    "#hits .ais-InfiniteHits-loadMore"
  );

  // état réel d'infiniteHits côté Algolia
  var infState =
    searchInstance &&
    searchInstance.renderState &&
    searchInstance.renderState[ALGOLIA_INDEX_NAME] &&
    searchInstance.renderState[ALGOLIA_INDEX_NAME].infiniteHits;

  var isLastPage = !!(infState && infState.isLastPage);

  // on masque si :
  // - on est sur la dernière page
  // - OU il y a moins que 48 cartes (donc une seule page)
  var mustHide = isLastPage || cards.length < perPage;

  if (mustHide) {
    if (showMoreBtn) {
      showMoreBtn.style.display = "none";
    }
    if (showMoreWrapper) {
      showMoreWrapper.style.display = "none";
    }
  } else {
    if (showMoreWrapper) {
      showMoreWrapper.style.display = "";
    }
    if (showMoreBtn) {
      showMoreBtn.style.display = "inline-flex";
    }
  }

  // Laisse finir le cycle de rendu puis lance les secondaires
  setTimeout(fetchAndRenderMoreBlocks, 0);
});




    // 10. CLIC GLOBAL SHOW MORE ----------------------------------------------
//    document.addEventListener("click", function (e) {
//  var btn = e.target.closest(".directory_show_more_button");
//  if (!btn) return;

//  console.log("[DEBUG SHOW MORE] click", {
//    renderState: searchInstance && searchInstance.renderState
//  });

//  var inf =
//    searchInstance &&
//    searchInstance.renderState &&
//    searchInstance.renderState[ALGOLIA_INDEX_NAME] &&
//    searchInstance.renderState[ALGOLIA_INDEX_NAME].infiniteHits;
//
//  if (inf && typeof inf.showMore === "function") {
//    e.preventDefault();
//    inf.showMore();
//  } else {
//    console.warn("[DEBUG SHOW MORE] infiniteHits introuvable");
//  }
// });

    document.addEventListener(
  "click",
  function (e) {
    var link = e.target.closest(
      ".directory_card_container.more-card a.directory_card_body"
    );
    if (!link) return;

    var href = link.getAttribute("href");
    console.log("[MORE FORCE NAV]", href, { target: e.target });

    // On stoppe tout ce que d'autres scripts pourraient faire
    e.preventDefault();
    e.stopPropagation();

    if (href) {
      window.location.href = href;
    }
  },
  true // <--- capture: on passe AVANT les autres listeners
);



    // 11. AUTRES LISTENERS ----------------------------------------------------
    setupSearchDropdown();
    setupSuggestionClicks();
    setupTypeBlockClicks();
    setupSpePrestaBlockClicks();
    setupJobBlockClicks();
    setupBooleanBlockClicks();
    setupDiscountBlockClicks();

    var mapsClearBtn = document.querySelector(".directory_search_clear");
    if (mapsClearBtn) {
      mapsClearBtn.addEventListener("click", function () {
        if (!searchInstance || !searchInstance.helper) return;
        var helper = searchInstance.helper;

        currentGeoFilter = null;
        helper.setQueryParameter("aroundLatLng", undefined);
        helper.setQueryParameter("aroundRadius", undefined);

        var mapsInput = document.getElementById("maps_input");
        var mapsBox = document.getElementById("maps_autocomplete");
        if (mapsInput) {
          mapsInput.value = "";
          mapsInput.classList.remove("is-selected");
        }
        if (mapsBox) {
          mapsBox.style.display = "none";
        }
        mapsClearBtn.style.display = "none";

        helper.search();
      });
    }

    var clearBtnMobile = document.getElementById("clear_button_mobile");
    if (clearBtnMobile) {
      clearBtnMobile.addEventListener("click", function () {
        if (!searchInstance || !searchInstance.helper) return;
        var helper = searchInstance.helper;

        selectedFacetTags.clear();
        selectedJobTags.length = 0;
        isNetworkSelected = false;
        isRemoteSelected = false;
        isAtHomeSelected = false;
        helper.setQuery("");
        helper.clearRefinements();
        helper.setQueryParameter("filters", undefined);
        helper.setQueryParameter("aroundLatLng", undefined);
        helper.setQueryParameter("aroundRadius", undefined);
        currentGeoFilter = null;
        hasUserLaunchedSearch = false;

        var mapsInput = document.getElementById("maps_input");
        var mapsBox = document.getElementById("maps_autocomplete");
        var mapsClear = document.querySelector(".directory_search_clear");
        if (mapsInput) {
          mapsInput.value = "";
          mapsInput.classList.remove("is-selected");
        }
        if (mapsBox) {
          mapsBox.style.display = "none";
        }
        if (mapsClear) {
          mapsClear.style.display = "none";
        }

        helper.search();
      });
    }

    // 12. FONCTIONS DE SETUP --------------------------------------------------
    function setupBooleanBlockClicks() {
      var labelFilterWrapper = document.getElementById("label-filter");
      var remoteFilterWrapper = document.getElementById(
        "works-remotely-filter"
      );
      var atHomeFilterWrapper = document.getElementById(
        "works-at-home-filter"
      );

      function toggleAndSearch(flagName) {
        if (!searchInstance || !searchInstance.helper) return;
        if (flagName === "network") {
          isNetworkSelected = !isNetworkSelected;
        }
        if (flagName === "remote") {
          isRemoteSelected = !isRemoteSelected;
        }
        if (flagName === "athome") {
          isAtHomeSelected = !isAtHomeSelected;
        }

        var helper = searchInstance.helper;
        var filtersStr = buildFiltersStringFromJobsAndBooleans();
        helper.setQueryParameter("filters", filtersStr);
        helper.search();
      }

      if (labelFilterWrapper) {
        labelFilterWrapper.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-bool-filter]");
          if (!btn) return;
          var flagName = btn.getAttribute("data-bool-filter");
          toggleAndSearch(flagName);
        });
      }
      if (remoteFilterWrapper) {
        remoteFilterWrapper.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-bool-filter]");
          if (!btn) return;
          var flagName = btn.getAttribute("data-bool-filter");
          toggleAndSearch(flagName);
        });
      }
      if (atHomeFilterWrapper) {
        atHomeFilterWrapper.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-bool-filter]");
          if (!btn) return;
          var flagName = btn.getAttribute("data-bool-filter");
          toggleAndSearch(flagName);
        });
      }
    }

    function setupDiscountBlockClicks() {
      var discountWrapper = document.getElementById("discount-tags");
      if (!discountWrapper) return;

      discountWrapper.addEventListener("click", function (e) {
        var tag = e.target.closest(".directory_category_tag_wrapper");
        if (!tag || !searchInstance || !searchInstance.helper) return;

        var facetName = tag.getAttribute("data-facet-name");
        var facetValue = tag.getAttribute("data-facet-value");
        var helper = searchInstance.helper;

        // cas spécial: tag virtuel "<50%"
        if (facetValue === "lt50") {
          var virtualKey = "reimbursment_percentage:::lt50";
          var isSelectedVirtual = selectedFacetTags.has(virtualKey);

          if (isSelectedVirtual) {
            selectedFacetTags.delete(virtualKey);
            discountRawValues.forEach(function (val) {
              if (Number(val) < 50) {
                helper.removeDisjunctiveFacetRefinement(
                  "reimbursment_percentage",
                  val
                );
              }
            });
          } else {
            selectedFacetTags.add(virtualKey);
            discountRawValues.forEach(function (val) {
              if (Number(val) < 50) {
                helper.addDisjunctiveFacetRefinement(
                  "reimbursment_percentage",
                  val
                );
              }
            });
          }

          helper.search();
          return;
        }

        // cas normal (valeur réelle >= 50)
        var key = facetName + ":::" + facetValue;
        var isSelected = selectedFacetTags.has(key);

        if (isSelected) {
          selectedFacetTags.delete(key);
          helper.removeDisjunctiveFacetRefinement(facetName, facetValue);
        } else {
          selectedFacetTags.add(key);
          helper.addDisjunctiveFacetRefinement(facetName, facetValue);
        }

        helper.search();
      });
    }

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

    function renderClearButton() {
      var clearBtn = document.getElementById("clear_button");
      if (!clearBtn) return;

      var hasQuery =
        searchInstance &&
        searchInstance.helper &&
        (searchInstance.helper.state.query || "").trim() !== "";
      var hasFacets = selectedFacetTags.size > 0;
      var hasGeo = !!currentGeoFilter;
      var hasJobs = selectedJobTags.length > 0;
      var hasBools =
        isNetworkSelected || isRemoteSelected || isAtHomeSelected;

      clearBtn.style.display =
        hasQuery || hasFacets || hasGeo || hasJobs || hasBools
          ? "flex"
          : "none";
    }

    var clearBtnInit = document.getElementById("clear_button");
    if (clearBtnInit) {
      clearBtnInit.addEventListener("click", function () {
        if (!searchInstance || !searchInstance.helper) return;
        var helper = searchInstance.helper;

        selectedFacetTags.clear();
        selectedJobTags.length = 0;
        isNetworkSelected = false;
        isRemoteSelected = false;
        isAtHomeSelected = false;
        helper.setQuery("");
        helper.clearRefinements();
        helper.setQueryParameter("filters", undefined);
        helper.setQueryParameter("aroundLatLng", undefined);
        helper.setQueryParameter("aroundRadius", undefined);
        currentGeoFilter = null;
        hasUserLaunchedSearch = false;

        var mapsInput = document.getElementById("maps_input");
        var mapsBox = document.getElementById("maps_autocomplete");
        var mapsClear = document.querySelector(".directory_search_clear");
        if (mapsInput) {
          mapsInput.value = "";
          mapsInput.classList.remove("is-selected");
        }
        if (mapsBox) {
          mapsBox.style.display = "none";
        }
        if (mapsClear) {
          mapsClear.style.display = "none";
        }

        helper.search();
      });
    }

    function setupSuggestionClicks() {
      var dropdown =
        document.getElementById("tags_autocomplete") ||
        document.querySelector(".directory_search_dropdown_wrapper");
      if (!dropdown) return;

      dropdown.addEventListener("click", function (e) {
        var tag = e.target.closest(".directory_suggestions_tag");
        if (!tag || !searchInstance) return;

        var facetName = tag.getAttribute("data-facet-name");
        var facetValue = tag.getAttribute("data-facet-value");
        if (!facetName || !facetValue) return;

        var helper = searchInstance.helper;
        var key = facetName + ":::" + facetValue;
        var isSelected = tag.classList.contains("is-selected");

        if (helper) {
          if (facetName === "type") {
            if (isSelected) {
              tag.classList.remove("is-selected");
              selectedFacetTags.delete(key);
              helper
                .removeDisjunctiveFacetRefinement(facetName, facetValue)
                .search();
            } else {
              tag.classList.add("is-selected");
              selectedFacetTags.add(key);
              helper
                .addDisjunctiveFacetRefinement(facetName, facetValue)
                .search();
            }
          } else {
            if (isSelected) {
              tag.classList.remove("is-selected");
              selectedFacetTags.delete(key);
              helper.removeFacetRefinement(facetName, facetValue).search();
            } else {
              tag.classList.add("is-selected");
              selectedFacetTags.add(key);
              helper.addFacetRefinement(facetName, facetValue).search();
            }
          }
        }

        dropdown.style.display = "flex";
      });
    }

    function setupTypeBlockClicks() {
      var typesAltWrapper = document.getElementById("directory_types");
      if (!typesAltWrapper) return;

      typesAltWrapper.addEventListener("click", function (e) {
        var tag = e.target.closest(".directory_category_tag_wrapper");
        if (!tag || !searchInstance || !searchInstance.helper) return;

        var facetName = tag.getAttribute("data-facet-name");
        var facetValue = (tag.getAttribute("data-facet-value") || "").trim();
        var helper = searchInstance.helper;

        if (facetValue === "__ALL_TYPES__") {
          helper.clearRefinements("type");
          Array.from(selectedFacetTags)
            .filter(function (k) {
              return k.indexOf("type:::") === 0;
            })
            .forEach(function (k) {
              selectedFacetTags.delete(k);
            });
          helper.search();
          return;
        }

        var key = facetName + ":::" + facetValue;
        var isSelected = selectedFacetTags.has(key);

        if (isSelected) {
          selectedFacetTags.delete(key);
          helper
            .removeDisjunctiveFacetRefinement(facetName, facetValue)
            .search();
        } else {
          selectedFacetTags.add(key);
          helper.addDisjunctiveFacetRefinement(facetName, facetValue).search();
        }
      });
    }

    function setupSpePrestaBlockClicks() {
  // ---------- SPÉCIALITÉS ----------
  var speWrapper = document.getElementById("spe_filtre");
  var moreSpe = document.getElementById("more-spe");
  var lessSpe = document.getElementById("lessSpe");

  if (speWrapper) {
    speWrapper.addEventListener("click", function (e) {
      var tag = e.target.closest(".directory_category_tag_wrapper");
      if (!tag || !searchInstance || !searchInstance.helper) return;
      var facetName = tag.getAttribute("data-facet-name");
      var facetValue = tag.getAttribute("data-facet-value");
      var key = facetName + ":::" + facetValue;
      var helper = searchInstance.helper;
      var isSelected = selectedFacetTags.has(key);
      if (isSelected) {
        selectedFacetTags.delete(key);
        helper.removeFacetRefinement(facetName, facetValue).search();
      } else {
        selectedFacetTags.add(key);
        helper.addFacetRefinement(facetName, facetValue).search();
      }
    });
  }

  function toggleSpeExpanded() {
    speExpanded = !speExpanded;
    if (searchInstance) searchInstance.refresh();
  }

  if (moreSpe) {
    moreSpe.addEventListener("click", toggleSpeExpanded);
  }
  if (lessSpe) {
    lessSpe.addEventListener("click", toggleSpeExpanded);
  }

  // ---------- PRESTATIONS ----------
  var prestaWrapper = document.getElementById("presta_filtre");
  var morePresta = document.getElementById("more-presta");
  var lessPrest = document.getElementById("lessPrest");

  if (prestaWrapper) {
    prestaWrapper.addEventListener("click", function (e) {
      var tag = e.target.closest(".directory_category_tag_wrapper");
      if (!tag || !searchInstance || !searchInstance.helper) return;
      var facetName = tag.getAttribute("data-facet-name");
      var facetValue = tag.getAttribute("data-facet-value");
      var key = facetName + ":::" + facetValue;
      var helper = searchInstance.helper;
      var isSelected = selectedFacetTags.has(key);
      if (isSelected) {
        selectedFacetTags.delete(key);
        helper.removeFacetRefinement(facetName, facetValue).search();
      } else {
        selectedFacetTags.add(key);
        helper.addFacetRefinement(facetName, facetValue).search();
      }
    });
  }

  function togglePrestaExpanded() {
    prestaExpanded = !prestaExpanded;
    if (searchInstance) searchInstance.refresh();
  }

  if (morePresta) {
    morePresta.addEventListener("click", togglePrestaExpanded);
  }
  if (lessPrest) {
    lessPrest.addEventListener("click", togglePrestaExpanded);
  }
}


    function setupJobBlockClicks() {
  var jobWrapper = document.getElementById("job_filtre");
  var moreJob = document.getElementById("more-job");
  var lessJob = document.getElementById("lessJob");

  if (jobWrapper) {
    jobWrapper.addEventListener("click", function (e) {
      var tag = e.target.closest(".directory_category_tag_wrapper");
      if (!tag || !searchInstance || !searchInstance.helper) return;
      var value = (tag.getAttribute("data-facet-value") || "").trim();
      var helper = searchInstance.helper;
      var key = "jobs:::" + value;
      var idx = selectedJobTags.indexOf(value);

      if (idx > -1) {
        selectedJobTags.splice(idx, 1);
        selectedFacetTags.delete(key);
      } else {
        selectedJobTags.push(value);
        selectedFacetTags.add(key);
      }

      var filtersStr = buildFiltersStringFromJobsAndBooleans();
      helper.setQueryParameter("filters", filtersStr);
      helper.search();
    });
  }

  function toggleJobExpanded() {
    jobExpanded = !jobExpanded;
    if (searchInstance) searchInstance.refresh();
  }

  if (moreJob) {
    moreJob.addEventListener("click", toggleJobExpanded);
  }
  if (lessJob) {
    lessJob.addEventListener("click", toggleJobExpanded);
  }
}


    // 13. PARAMS URL ----------------------------------------------------------
    function applyGeoFilterFromMaps(lat, lng, label) {
      if (label === undefined) label = "";
      currentGeoFilter = { lat: lat, lng: lng, label: label };
      if (searchInstance && searchInstance.helper) {
        var helper = searchInstance.helper;
        helper.setQueryParameter("aroundLatLng", lat + "," + lng);
        helper.setQueryParameter("aroundRadius", 100000);
        helper.search();
      }
      var mapsInput = document.getElementById("maps_input");
      var mapsClear = document.querySelector(".directory_search_clear");
      if (mapsInput) {
        mapsInput.value = label || "";
        mapsInput.classList.add("is-selected");
      }
      if (mapsClear) {
        mapsClear.style.display = "block";
      }
    }

    function applyUrlParamsToSearch() {
      if (typeof window === "undefined") return;
      var params = new URLSearchParams(window.location.search);
      var query = params.get("q") || "";
      var types = (params.get("type") || "").split(",").filter(Boolean);
      var spes = (params.get("specialities") || "").split(",").filter(Boolean);
      var geo = params.get("geo") || "";
      var prestas = (params.get("prestations") || "").split(",").filter(Boolean);
      var jobs = (params.get("jobs") || "").split(",").filter(Boolean);
      var reimb = (params.get("reimbursment_percentage") || "")
        .split(",")
        .filter(Boolean);
      var geolabel = params.get("geolabel") || "";
      var urlNetwork = params.get("network") === "true";
      var urlRemote = params.get("remote") === "true";
      var urlAtHome = params.get("athome") === "true";

      if (!searchInstance || !searchInstance.helper) return;
      var helper = searchInstance.helper;

      if (query) {
        helper.setQuery(query);
      }

      helper.clearRefinements("type");
      helper.clearRefinements("specialities");
      helper.clearRefinements("prestations");
      helper.clearRefinements("jobs");
      helper.clearRefinements("reimbursment_percentage");

      types.forEach(function (t) {
        helper.addDisjunctiveFacetRefinement("type", t);
      });
      spes.forEach(function (s) {
        helper.addFacetRefinement("specialities", s);
      });
      prestas.forEach(function (p) {
        helper.addFacetRefinement("prestations", p);
      });
      reimb.forEach(function (r) {
        helper.addDisjunctiveFacetRefinement("reimbursment_percentage", r);
      });

      types.forEach(function (t) {
        selectedFacetTags.add("type:::" + t);
      });
      spes.forEach(function (s) {
        selectedFacetTags.add("specialities:::" + s);
      });
      prestas.forEach(function (p) {
        selectedFacetTags.add("prestations:::" + p);
      });
      reimb.forEach(function (r) {
        selectedFacetTags.add("reimbursment_percentage:::" + r);
      });

      jobs.forEach(function (j) {
        var cleanJob = j.trim();
        if (!cleanJob) return;
        if (selectedJobTags.indexOf(cleanJob) === -1) {
          selectedJobTags.push(cleanJob);
        }
      });

      isNetworkSelected = urlNetwork;
      isRemoteSelected = urlRemote;
      isAtHomeSelected = urlAtHome;

      var filtersStr = buildFiltersStringFromJobsAndBooleans();
      helper.setQueryParameter("filters", filtersStr);

      if (geo) {
        var parts = geo.split(",");
        var lat = parseFloat(parts[0]);
        var lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          currentGeoFilter = {
            lat: lat,
            lng: lng,
            label: geolabel ? decodeURIComponent(geolabel) : ""
          };
          helper.setQueryParameter("aroundLatLng", lat + "," + lng);
          helper.setQueryParameter("aroundRadius", 50000);

          var mapsInput = document.getElementById("maps_input");
          var mapsClear = document.querySelector(".directory_search_clear");
          if (mapsInput) {
            if (geolabel) {
              mapsInput.value = decodeURIComponent(geolabel);
              mapsInput.classList.add("is-selected");
            } else {
              mapsInput.value = "";
              mapsInput.classList.remove("is-selected");
            }
          }
          if (mapsClear) {
            mapsClear.style.display = "block";
          }
        }
      }

      helper.search();
    }

    window.applyGeoFilterFromMaps = applyGeoFilterFromMaps;
  }

  initAlgolia();
});
