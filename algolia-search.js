// ============================================================================
// algolia-search.js
// ============================================================================
window.addEventListener("DOMContentLoaded", function () {
  // 1. CONSTANTES ------------------------------------------------------------
  const ALGOLIA_APP_ID = "DRTSPIHOUM";
  const ALGOLIA_SEARCH_KEY = "137b70e88a3288926c97a689cdcf4048";
  const ALGOLIA_INDEX_NAME = "elsee_index";

  // placeholders
  const THERAPIST_PLACEHOLDER_URL =
    "https://cdn.prod.website-files.com/64708634ac0bc7337aa7acd8/690dd36e1367cf7f0391812d_Fichier%20Convertio%20(3).webp";
  const DEFAULT_PLACEHOLDER_URL =
    "https://cdn.prod.website-files.com/64708634ac0bc7337aa7acd8/690dd373de251816ebaa511c_Placeholder%20de%20marque.webp";

  // 2. ÉTAT GLOBAL -----------------------------------------------------------
  let selectedFacetTags = new Set();
  let selectedJobTags = [];
  let isNetworkSelected = false;
  let isRemoteSelected = false;
  let isAtHomeSelected = false;
  let speExpanded = false;
  let prestaExpanded = false;
  let jobExpanded = false;
  let currentGeoFilter = null; // {lat,lng,label}
  let searchInstance = null;
  let hasUserLaunchedSearch = false;
  let discountRawValues = []; // valeurs de remboursement renvoyées par Algolia
  const DIRECTORY_BASE_URL = "https://www.elsee.care/lannuaire-des-partenaires-elsee";
  let mainHitHrefSet = new Set();
  let mainHitPathSet = new Set();
  let mainHitOdooSet = new Set();
  let urlParamsApplied = false;

  // 3. INIT ------------------------------------------------------------------
  function initAlgolia() {
    if (
      typeof algoliasearch === "undefined" ||
      typeof instantsearch === "undefined"
    ) {
      setTimeout(initAlgolia, 200);
      return;
    }

    const searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);

    // 3.1 instance instantsearch
    const search = instantsearch({
      indexName: ALGOLIA_INDEX_NAME,
      searchClient: searchClient,
      searchFunction: function (helper) {
        const query = (helper.state.query || "").trim();

        const userHasFilters =
          selectedFacetTags.size > 0 ||
          selectedJobTags.length > 0 ||
          isNetworkSelected ||
          isRemoteSelected ||
          isAtHomeSelected ||
          currentGeoFilter;

        if (query !== "" || userHasFilters) {
          hasUserLaunchedSearch = true;
        }

        const userFilters = buildFiltersStringFromJobsAndBooleans();
        const finalFilters = composeFilters(userFilters);

        const prevFilters = helper.state.filters || undefined;
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
      const t = (hit.type || "").trim().toLowerCase();
      return t === "thérapeutes" || t === "therapeutes";
    }

    function updateOnlyThpVisibility(helperState, hasJobsFacet) {
      const el = document.getElementById("onlythp");
      if (!el) return;

      const disj = helperState.disjunctiveFacetsRefinements || {};
      const facets = helperState.facetsRefinements || {};

      const types =
        (disj.type && disj.type.length ? disj.type : facets.type) || [];

      const noTypeSelected = types.length === 0;

      const hasThera = types.some(function (t) {
        const tt = t.toLowerCase().trim();
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
        const css = `
          .directory_sidebar_ctas_container .directory_sidebar_cta_wrapper { display: none !important; }

          body[data-cta="wellness"]    #adWellness-cta  { display: flex !important; }
          body[data-cta="therapeutes"] #adTherapist-cta { display: flex !important; }
          body[data-cta="marques"]     #adBrand-cta     { display: flex !important; }
          body[data-cta="programmes"]  #adProgram-cta   { display: flex !important; }
          body[data-cta="sports"]      #adSport-cta     { display: flex !important; }
        `;
        const style = document.createElement("style");
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
        const n = norm(label);
        if (n.includes("salons esthetiques") || n.includes("centres bien-etre")) return "wellness";
        if (n.includes("therapeutes")) return "therapeutes";
        if (n.includes("marques")) return "marques";
        if (n.includes("applications") || n.includes("programmes")) return "programmes";
        if (n.includes("sports")) return "sports";
        return ""; // rien
      }

      // 3) Applique en posant/unset l’attribut sur <body>
      function applyCTAFromSelectedTypes(selectedTypes) {
        const list = Array.isArray(selectedTypes) ? selectedTypes : [];

        // un seul type → on mappe; sinon on enlève l’attribut
        const key = (list.length === 1) ? mapLabelToKey(list[0]) : "";
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

        const container = document.querySelector(".directory_sidebar_ctas_container") || document.body;
        const obs = new MutationObserver(function () {
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
      const parts = [];

      if (selectedJobTags.length > 0) {
        const jobParts = selectedJobTags.map(function (job) {
          const safe = job.replace(/"/g, '\\"');
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

      const finalStr = parts.join(" AND ");
      return finalStr.length ? finalStr : undefined;
    }

    // filtre de visibilité commun
    function getVisibilityFilter(ignoreGeo) {
      const debugInfo = {
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
      const visibility = getVisibilityFilter();

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
      const params = new URLSearchParams(window.location.search);

      const query = state.query || "";
      if (query.trim() !== "") {
        params.set("q", query.trim());
      } else {
        params.delete("q");
      }

      const facetRef = state.facetsRefinements || {};
      const disjRef = state.disjunctiveFacetsRefinements || {};

      const typeRef =
        (disjRef.type && disjRef.type.length ? disjRef.type : facetRef.type) ||
        [];
      const speRef =
        (disjRef.specialities && disjRef.specialities.length
          ? disjRef.specialities
          : facetRef.specialities) || [];
      const prestaRef =
        (facetRef.prestations && facetRef.prestations.length
          ? facetRef.prestations
          : []) || [];
      const reimbRef =
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

      const newUrl =
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", newUrl);
    }

    // 6. WIDGET CUSTOM TAGS ---------------------------------------------------
    const dynamicSuggestionsWidget = {
      render: function (opts) {
        const results = opts.results;
        if (!results) return;

        const typeWrapper = document.getElementById("tags_autocomplete_type");
        const speWrapper = document.getElementById("tags_autocomplete_spe");
        const speFilterWrapper = document.getElementById("spe_filtre");
        const prestaFilterWrapper = document.getElementById("presta_filtre");
        const jobFilterWrapper = document.getElementById("job_filtre");
        const labelFilterWrapper = document.getElementById("label-filter");
        const remoteFilterWrapper = document.getElementById(
          "works-remotely-filter"
        );
        const atHomeFilterWrapper = document.getElementById(
          "works-at-home-filter"
        );
        const discountFilterWrapper = document.getElementById("discount-tags");

        if (!typeWrapper || !speWrapper) return;

        typeWrapper.classList.add("directory_suggestions_tags_wrapper");
        speWrapper.classList.add("directory_suggestions_tags_wrapper");

        // TYPES ----------------------------------------------------------------
        let typeFacetValues =
          results.getFacetValues("type", {
            sortBy: ["count:desc", "name:asc"]
          }) || [];
        if (!Array.isArray(typeFacetValues)) typeFacetValues = [];

        // quels types sont VRAIMENT sélectionnés ?
        const selectedTypes = Array.from(selectedFacetTags)
          .filter(function (k) {
            return k.indexOf("type:::") === 0;
          })
          .map(function (k) {
            return k.split(":::")[1] || "";
          });

        const noTypeSelected = selectedTypes.length === 0;
        const hasTheraSelected = selectedTypes.some(function (t) {
          const norm = (t || "").toLowerCase();
          return norm === "thérapeutes" || norm === "therapeutes";
        });

        // c'est cette règle qui commande l'affichage visio/domicile
        const shouldShowTheraOnlyFilters = noTypeSelected || hasTheraSelected;

        const typeHtml = typeFacetValues
          .filter(function (fv) {
            return fv && fv.name;
          })
          .map(function (fv) {
            const key = "type:::" + fv.name;
            const isSelected = selectedFacetTags.has(key);
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

        const typesAltWrapper = document.getElementById("directory_types");
        if (typesAltWrapper) {
          const hasTypeSelected = selectedTypes.length > 0;

          let altHtml =
            '<div class="directory_category_tag_wrapper ' +
            (hasTypeSelected ? "" : "is-selected") +
            '" data-facet-name="type" data-facet-value="__ALL_TYPES__">Toutes les catégories</div>';

          altHtml += typeFacetValues
            .filter(function (fv) { return fv && fv.name; })
            .map(function (fv) {
              const key = "type:::" + fv.name;
              const isSelected = selectedFacetTags.has(key);
              const label = "Les " + fv.name.toLowerCase();
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
        let speFacetValues =
          results.getFacetValues("specialities", {
            sortBy: ["count:desc", "name:asc"]
          }) || [];
        if (!Array.isArray(speFacetValues)) speFacetValues = [];

        const speFacetValuesAlpha = speFacetValues.slice().sort(function (a, b) {
          return (a.name || "").localeCompare(b.name || "");
        });

        const speContainer = document.getElementById("speContainer");
        if (speContainer) {
          const hasSpe = speFacetValues.some(function (fv) {
            return fv && fv.count > 0;
          });
          speContainer.style.display = hasSpe ? "flex" : "none";
        }

        const selectedSpe = Array.from(selectedFacetTags)
          .filter(function (k) {
            return k.indexOf("specialities:::") === 0;
          })
          .map(function (k) {
            return k.split(":::")[1];
          });

        const seen = new Set();
        const speBlocks = [];

        selectedSpe.forEach(function (value) {
          seen.add(value);
          speBlocks.push({ name: value, count: null });
        });

        for (let i = 0; i < speFacetValues.length; i++) {
          const fv = speFacetValues[i];
          if (!fv || !fv.name) continue;
          if (seen.has(fv.name)) continue;
          if (speBlocks.length >= 10) break;
          if (fv.count === 0) continue;
          speBlocks.push({ name: fv.name, count: fv.count });
          seen.add(fv.name);
        }

        const speHtml = speBlocks
          .map(function (item) {
            const key = "specialities:::" + item.name;
            const isSelected = selectedFacetTags.has(key);
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
          const maxToShow = speExpanded ? speFacetValuesAlpha.length : 6;
          const speListHtml = speFacetValuesAlpha
            .filter(function (fv) {
              return fv && fv.name;
            })
            .slice(0, maxToShow)
            .map(function (fv) {
              const key = "specialities:::" + fv.name;
              const isSelected = selectedFacetTags.has(key);
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

          const moreSpeBtn = document.getElementById("more-spe");
          if (moreSpeBtn) {
            moreSpeBtn.textContent = speExpanded
              ? "En voir moins"
              : "Voir toutes les spécialités";
          }
          // idem pour le header "lessSpe" (icône chevron)
          const lessSpeBtn = document.getElementById("lessSpe");
          if (lessSpeBtn) {
            const chevron = lessSpeBtn.querySelector(".directory_chevron_icon");
            if (chevron) {
              chevron.style.transition = "transform 0.2s ease";
              chevron.style.transform = speExpanded ? "rotate(180deg)" : "rotate(0deg)";
            }
          }
        }

        // PRESTATIONS ---------------------------------------------------------
        if (prestaFilterWrapper) {
          let prestaFacetValues =
            results.getFacetValues("prestations", {
              sortBy: ["name:asc"]
            }) || [];
          if (!Array.isArray(prestaFacetValues)) prestaFacetValues = [];

          const serviceContainer = document.getElementById("serviceContainer");
          if (serviceContainer) {
            const hasPresta = prestaFacetValues.some(function (fv) {
              return fv && fv.count > 0;
            });
            serviceContainer.style.display = hasPresta ? "flex" : "none";
          }

          const maxToShowPresta = prestaExpanded ? prestaFacetValues.length : 6;

          const prestaListHtml = prestaFacetValues
            .filter(function (fv) {
              return fv && fv.name;
            })
            .slice(0, maxToShowPresta)
            .map(function (fv) {
              const key = "prestations:::" + fv.name;
              const isSelected = selectedFacetTags.has(key);
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
          const morePrestaBtn = document.getElementById("more-presta");
          if (morePrestaBtn) {
            morePrestaBtn.textContent = prestaExpanded
              ? "En voir moins"
              : "Voir tous les services";
          }

          const lessPrestBtn = document.getElementById("lessPrest");
          if (lessPrestBtn) {
            const chevronPresta = lessPrestBtn.querySelector(".directory_chevron_icon");
            if (chevronPresta) {
              chevronPresta.style.transition = "transform 0.2s ease";
              chevronPresta.style.transform = prestaExpanded ? "rotate(180deg)" : "rotate(0deg)";
            }
          }
        }


        // MÉTIERS --------------------------------------------------------------
        if (jobFilterWrapper) {
          let mainFacetValues =
            results.getFacetValues("mainjob", {
              sortBy: ["name:asc"]
            }) || [];
          let jobFacetValues =
            results.getFacetValues("jobs", {
              sortBy: ["name:asc"]
            }) || [];

          if (!Array.isArray(mainFacetValues)) mainFacetValues = [];
          if (!Array.isArray(jobFacetValues)) jobFacetValues = [];

          const merged = new Map();

          mainFacetValues.forEach(function (fv) {
            if (!fv || !fv.name) return;
            merged.set(fv.name, {
              name: fv.name,
              mainCount: fv.count || 0,
              jobCount: 0
            });
          });

          jobFacetValues.forEach(function (fv) {
            const nameRaw = fv && fv.name ? fv.name.trim() : "";
            if (!nameRaw) return;
            if (merged.has(nameRaw)) {
              const cur = merged.get(nameRaw);
              cur.jobCount = fv.count || 0;
            } else {
              merged.set(nameRaw, {
                name: nameRaw,
                mainCount: 0,
                jobCount: fv.count || 0
              });
            }
          });

          const mergedArr = Array.from(merged.values()).sort(function (a, b) {
            return (a.name || "").localeCompare(b.name || "");
          });

          const hasJobsFacet =
            mainFacetValues.some(function (fv) {
              return fv && fv.count > 0;
            }) ||
            jobFacetValues.some(function (fv) {
              return fv && fv.count > 0;
            });

          if (searchInstance && searchInstance.helper) {
            updateOnlyThpVisibility(searchInstance.helper.state, hasJobsFacet);
          }

          const maxToShowJob = jobExpanded ? mergedArr.length : 6;

          const jobListHtml = mergedArr
            .slice(0, maxToShowJob)
            .map(function (item) {
              const value = (item.name || "").trim();
              const key = "jobs:::" + value;
              const isSelected =
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
          const moreJobBtn = document.getElementById("more-job");
          if (moreJobBtn) {
            moreJobBtn.textContent = jobExpanded
              ? "En voir moins"
              : "Voir tous les métiers";
          }

          const lessJobBtn = document.getElementById("lessJob");
          if (lessJobBtn) {
            const chevronJob = lessJobBtn.querySelector(".directory_chevron_icon");
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
          let reimburseFacetValues =
            results.getFacetValues("reimbursment_percentage", {
              sortBy: ["name:asc"]
            }) || [];
          if (!Array.isArray(reimburseFacetValues)) {
            reimburseFacetValues = [];
          }

          // on nettoie / trie
          const filtered = reimburseFacetValues
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
          const hasBelow50 = filtered.some(function (item) {
            return Number(item.name) < 50;
          });

          let html = "";

          // tag virtuel <50%
          if (hasBelow50) {
            const virtualKey = "reimbursment_percentage:::lt50";
            const isSelectedVirtual = selectedFacetTags.has(virtualKey);
            html +=
              '<div class="directory_category_tag_wrapper ' +
              (isSelectedVirtual ? "is-selected" : "") +
              '" data-facet-name="reimbursment_percentage" data-facet-value="lt50">' +
              "Moins de 50%" +
              "</div>";
          }
          // Suite de votre code original
          const fiftyPlus = filtered.some(function (item) {
            return Number(item.name) >= 50 && Number(item.name) < 100;
          });

          if (fiftyPlus) {
            const virtualKey = "reimbursment_percentage:::50-99";
            const isSelectedVirtual = selectedFacetTags.has(virtualKey);
            html +=
              '<div class="directory_category_tag_wrapper ' +
              (isSelectedVirtual ? "is-selected" : "") +
              '" data-facet-name="reimbursment_percentage" data-facet-value="50-99">' +
              "De 50 à 99%" +
              "</div>";
          }

          const isFull = filtered.some(function (item) {
            return Number(item.name) === 100;
          });

          if (isFull) {
            const virtualKey = "reimbursment_percentage:::100";
            const isSelectedVirtual = selectedFacetTags.has(virtualKey);
            html +=
              '<div class="directory_category_tag_wrapper ' +
              (isSelectedVirtual ? "is-selected" : "") +
              '" data-facet-name="reimbursment_percentage" data-facet-value="100">' +
              "100%" +
              "</div>";
          }

          discountFilterWrapper.innerHTML = html;
        }

        // --------------------------------------------------------------------
      }
    };

    // 7. WIDGET DE RÉSULTATS ---------------------------------------------------
    const hitsWidget = instantsearch.connectors.connectHits(function (opts) {
      const { hits, results, instantSearchInstance } = opts;
      if (!instantSearchInstance) return;

      const hitsContainer = document.getElementById("algolia-hits");
      const noResultsContainer = document.getElementById("algolia-no-results");
      const hitsCountContainer = document.getElementById("algolia-hits-count");

      if (!hitsContainer || !noResultsContainer || !hitsCountContainer) return;

      if (results && results.nbHits > 0) {
        hitsContainer.style.display = "grid";
        noResultsContainer.style.display = "none";
        hitsCountContainer.textContent =
          results.nbHits.toLocaleString("fr-FR") +
          (results.nbHits > 1 ? " résultats" : " résultat");
      } else if (hasUserLaunchedSearch) {
        hitsContainer.style.display = "none";
        noResultsContainer.style.display = "flex";
        hitsCountContainer.textContent = "0 résultat";
      } else {
        // État initial (pas de recherche lancée)
        hitsContainer.style.display = "none";
        noResultsContainer.style.display = "none";
        hitsCountContainer.textContent = "";
      }

      mainHitHrefSet.clear();
      mainHitPathSet.clear();
      mainHitOdooSet.clear();

      hitsContainer.innerHTML = hits
        .map(function (hit) {
          const isThp = isTherapeutes(hit);
          const path = (hit.path || "").trim();
          const odooId = (hit.odoo_id || "").trim();

          // Dédoublonnage
          if (path) {
            if (mainHitPathSet.has(path)) return "";
            mainHitPathSet.add(path);
          } else if (odooId) {
            if (mainHitOdooSet.has(odooId)) return "";
            mainHitOdooSet.add(odooId);
          } else if (hit.href) {
            if (mainHitHrefSet.has(hit.href)) return "";
            mainHitHrefSet.add(hit.href);
          } else {
            return ""; // ni path, ni odoo, ni href : on zappe
          }

          const href = hit.href || DIRECTORY_BASE_URL + "/?odoo_id=" + odooId;
          const image =
            hit.image_url || (isThp ? THERAPIST_PLACEHOLDER_URL : DEFAULT_PLACEHOLDER_URL);

          const speList = toArray(hit.specialities || []).join(", ");
          const jobList = toArray(hit.mainjob || hit.jobs || []).join(", ");
          const location =
            (hit.city || "") +
            (hit.city && hit.zip_code ? " - " : "") +
            (hit.zip_code || "");

          return (
            '<a href="' +
            href +
            '" class="directory_hit_card w-inline-block">' +
            '<div class="directory_hit_card_image_wrapper">' +
            '<img src="' +
            image +
            '" loading="lazy" alt="' +
            hit.title +
            '" class="directory_hit_card_image" />' +
            "</div>" +
            '<div class="directory_hit_card_content">' +
            '<h4 class="directory_hit_card_title">' +
            truncate(hit.title, 50) +
            "</h4>" +
            '<div class="directory_hit_card_subtitle">' +
            (isThp ? truncate(jobList, 50) : truncate(hit.type || "", 50)) +
            "</div>" +
            (location
              ? '<div class="directory_hit_card_location_wrapper">' +
              '<div class="directory_hit_card_icon">📍</div>' +
              '<div class="directory_hit_card_location_text">' +
              truncate(location, 50) +
              "</div>" +
              "</div>"
              : "") +
            (speList && isThp
              ? '<div class="directory_hit_card_spe_wrapper">' +
              '<div class="directory_hit_card_icon">✨</div>' +
              '<div class="directory_hit_card_spe_text">' +
              truncate(speList, 50) +
              "</div>" +
              "</div>"
              : "") +
            "</div>" +
            "</a>"
          );
        })
        .join("");
    });

    // 8. WIDGET DE GÉOLOCALISATION ----------------------------------------------
    const currentGeoWidget = {
      render: function (opts) {
        const { instantSearchInstance } = opts;
        if (!instantSearchInstance) return;

        const container = document.getElementById("geo-filter-tag-wrapper");
        const clearBtn = document.getElementById("clear-geo-filter");
        const geoInput = document.getElementById("geo-autocomplete-input");

        if (!container || !clearBtn || !geoInput) return;

        // Mise à jour de l'affichage
        if (currentGeoFilter) {
          container.style.display = "flex";
          container.querySelector(".directory_geo_tag_text").textContent =
            currentGeoFilter.label || "Filtre géographique actif";
        } else {
          container.style.display = "none";
          container.querySelector(".directory_geo_tag_text").textContent = "";
        }

        // Mettre à jour l'input de l'autocomplétion
        if (geoInput.value !== (currentGeoFilter?.label || "")) {
          geoInput.value = currentGeoFilter?.label || "";
        }

        // Gérer l'état du bouton "Effacer"
        clearBtn.style.display = currentGeoFilter ? "flex" : "none";

        // Gérer le click du bouton "Effacer"
        if (!window.__geoClearListener) {
          window.__geoClearListener = true;
          clearBtn.addEventListener("click", function (e) {
            e.preventDefault();
            currentGeoFilter = null;
            geoInput.value = "";
            instantSearchInstance.helper.setQueryParameter("aroundLatLng", undefined);
            instantSearchInstance.helper.setQueryParameter("aroundRadius", undefined);
            instantSearchInstance.helper.setQueryParameter("filters", composeFilters(buildFiltersStringFromJobsAndBooleans()));
            instantSearchInstance.helper.search();
            updateUrlFromState(instantSearchInstance.helper.state);
          });
        }
      }
    };

    // 9. WIDGET D'AUTOSUGGESTION DE GÉOLOC ---------------------------------------
    // Ce widget est purement déclaratif pour éviter d'interférer avec le comportement
    // de l'autocomplétion Google Maps/Algolia déjà en place dans Webflow.
    const geoAutocompleteWidget = {
      render: function (opts) {
        const { instantSearchInstance } = opts;
        if (!instantSearchInstance) return;

        // Si l'URL a déjà des paramètres, Algolia a déjà mis à jour son état (si possible)
        // et on ne fait rien de plus ici, on se fie au `currentGeoFilter` pour l'état.
      }
    };

    // 10. WIDGET DE GESTION DES EXPANSIONS ---------------------------------------
    const expandWidget = {
      render: function (opts) {
        const speExpand = document.getElementById("spe_expand");
        const prestaExpand = document.getElementById("presta_expand");
        const jobExpand = document.getElementById("job_expand");

        function setupToggle(elementId, stateVar, updateFunc) {
          const el = document.getElementById(elementId);
          if (el && !el.__listenerAttached) {
            el.__listenerAttached = true;
            el.addEventListener("click", function () {
              // eslint-disable-next-line no-eval
              eval(stateVar + " = !" + stateVar); // Met à jour l'état (speExpanded, etc.)
              updateFunc();
              opts.instantSearchInstance.helper.search(); // Déclenche un re-render
            });
          }
        }

        function updateSpe() {
          const chevron = document.querySelector("#lessSpe .directory_chevron_icon");
          if (chevron) {
            chevron.style.transform = speExpanded ? "rotate(180deg)" : "rotate(0deg)";
          }
          const btn = document.getElementById("more-spe");
          if (btn) {
            btn.textContent = speExpanded ? "En voir moins" : "Voir toutes les spécialités";
          }
        }

        function updatePresta() {
          const chevron = document.querySelector("#lessPrest .directory_chevron_icon");
          if (chevron) {
            chevron.style.transform = prestaExpanded ? "rotate(180deg)" : "rotate(0deg)";
          }
          const btn = document.getElementById("more-presta");
          if (btn) {
            btn.textContent = prestaExpanded ? "En voir moins" : "Voir tous les services";
          }
        }

        function updateJob() {
          const chevron = document.querySelector("#lessJob .directory_chevron_icon");
          if (chevron) {
            chevron.style.transform = jobExpanded ? "rotate(180deg)" : "rotate(0deg)";
          }
          const btn = document.getElementById("more-job");
          if (btn) {
            btn.textContent = jobExpanded ? "En voir moins" : "Voir tous les métiers";
          }
        }

        if (speExpand) setupToggle("spe_expand", "speExpanded", updateSpe);
        if (prestaExpand) setupToggle("presta_expand", "prestaExpanded", updatePresta);
        if (jobExpand) setupToggle("job_expand", "jobExpanded", updateJob);

        updateSpe();
        updatePresta();
        updateJob();
      }
    };

    // 11. WIDGET DE GESTION DES URLS -------------------------------------------
    const urlSyncWidget = {
      init: function (opts) {
        // Appliquer les paramètres de l'URL à l'état initial
        if (!urlParamsApplied) {
          const params = new URLSearchParams(window.location.search);
          const helper = opts.helper;

          const q = params.get("q");
          if (q) helper.setQuery(q);

          const geo = params.get("geo");
          const geolabel = decodeURIComponent(params.get("geolabel") || "");
          if (geo) {
            const [lat, lng] = geo.split(",");
            currentGeoFilter = { lat: parseFloat(lat), lng: parseFloat(lng), label: geolabel };
            helper.setQueryParameter("aroundLatLng", lat + "," + lng);
            helper.setQueryParameter("aroundRadius", 50000); // 50km
          }

          const network = params.get("network");
          if (network === "true") isNetworkSelected = true;

          const remote = params.get("remote");
          if (remote === "true") isRemoteSelected = true;

          const athome = params.get("athome");
          if (athome === "true") isAtHomeSelected = true;

          const jobs = params.get("jobs");
          if (jobs) {
            selectedJobTags = jobs.split(",");
          }

          const type = params.get("type");
          if (type) {
            type.split(",").forEach(function (v) {
              helper.toggleFacetRefinement("type", v);
              selectedFacetTags.add("type:::" + v);
            });
          }

          const spe = params.get("specialities");
          if (spe) {
            spe.split(",").forEach(function (v) {
              helper.toggleFacetRefinement("specialities", v);
              selectedFacetTags.add("specialities:::" + v);
            });
          }

          const presta = params.get("prestations");
          if (presta) {
            presta.split(",").forEach(function (v) {
              helper.toggleFacetRefinement("prestations", v);
              selectedFacetTags.add("prestations:::" + v);
            });
          }

          const reimb = params.get("reimbursment_percentage");
          if (reimb) {
            reimb.split(",").forEach(function (v) {
              const facetName = "reimbursment_percentage";
              let filterStr = "";

              if (v === "lt50") {
                filterStr = "reimbursment_percentage < 50";
              } else if (v === "50-99") {
                filterStr = "reimbursment_percentage >= 50 AND reimbursment_percentage < 100";
              } else if (v === "100") {
                filterStr = "reimbursment_percentage = 100";
              }

              if (filterStr) {
                helper.toggleFacetRefinement(facetName, v);
                selectedFacetTags.add(facetName + ":::" + v);
              }
            });
          }

          // Force la première recherche pour appliquer les filtres booléens et visibilité
          if (params.toString() !== "") {
            helper.setQueryParameter("filters", composeFilters(buildFiltersStringFromJobsAndBooleans()));
            helper.search();
          }

          urlParamsApplied = true;
        }
      },
      render: function (opts) {
        updateUrlFromState(opts.instantSearchInstance.helper.state);
      }
    };

    // 12. DÉMARRAGE DES WIDGETS ET DE LA RECHERCHE ------------------------------
    search.addWidgets([
      instantsearch.widgets.searchBox({
        container: "#algolia-search-input",
        placeholder: "Recherchez un prestataire, une spécialité, un métier...",
        showReset: false,
        showSubmit: false,
        poweredBy: false,
        autofocus: false,
        cssClasses: {
          input: "directory_search_input"
        }
      }),
      instantsearch.widgets.pagination({
        container: "#algolia-pagination",
        scrollTo: "#algolia-search-input",
        showFirst: false,
        showLast: false,
        padding: 5,
        cssClasses: {
          root: "directory_pagination_wrapper",
          list: "directory_pagination_list",
          item: "directory_pagination_item",
          selectedItem: "is-selected",
          link: "directory_pagination_link"
        }
      }),
      instantsearch.widgets.clearRefinements({
        container: "#algolia-clear-filters",
        cssClasses: {
          button: "directory_clear_filters_btn"
        },
        // Maintient la géolocalisation et les booléens de localisation
        transformItems: function (items) {
          const facetsToKeep = [
            "aroundLatLng",
            "aroundRadius",
            "is_remote",
            "is_at_home",
            "is_elsee_network",
            "mainjob",
            "jobs"
          ];
          return items.filter(function (item) {
            return !facetsToKeep.includes(item.attribute);
          });
        },
        // Réinitialisation manuelle des booléens et de l'état local
        containerRef: {
          create: function () {
            return {
              addEventListener: function (type, handler) {
                if (type === "click") {
                  document.getElementById("algolia-clear-filters").addEventListener("click", function (e) {
                    e.preventDefault();
                    selectedFacetTags.clear();
                    isNetworkSelected = false;
                    isRemoteSelected = false;
                    isAtHomeSelected = false;
                    selectedJobTags = [];
                    // currentGeoFilter n'est pas réinitialisé ici, il faut le faire manuellement via son bouton
                    // pour éviter une désactivation accidentelle
                    handler();

                    // Correction du problème où clearRefinements ne met pas à jour le filtre booléen dans l'URL/état
                    const helper = search.helper;
                    helper.setQueryParameter("filters", composeFilters(buildFiltersStringFromJobsAndBooleans()));
                    helper.search(); // Nouvelle recherche avec les filtres mis à jour
                  });
                }
              }
            };
          },
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          dispose: function () { }
        },
        templates: {
          resetLabel: "Effacer tous les filtres"
        }
      }),
      instantsearch.widgets.panel({
        templates: {
          header: "Catégories",
        },
        hidden: function (opts) {
          // Masque la catégorie si pas de résultats
          return !opts.results.getFacetValues("type").some(function (v) {
            return v.count > 0;
          });
        }
      })(dynamicSuggestionsWidget), // Remplace les widgets de facettes par le custom
      hitsWidget, // Widget de rendu des résultats
      currentGeoWidget, // Widget de gestion de l'affichage du filtre geo
      geoAutocompleteWidget, // Widget de gestion de l'autocomplétion
      urlSyncWidget, // Synchronisation de l'URL
      expandWidget, // Gestion des expansions
    ]);

    // 13. ÉVÉNEMENTS -------------------------------------------------------------
    document.addEventListener("click", function (e) {
      const tag = e.target.closest(
        ".directory_suggestions_tag, .directory_category_tag_wrapper"
      );
      if (!tag) return;

      e.preventDefault();
      const facetName = tag.getAttribute("data-facet-name");
      const facetValue = tag.getAttribute("data-facet-value");
      const boolFilter = tag.getAttribute("data-bool-filter");
      const key = facetName ? facetName + ":::" + facetValue : "";

      if (boolFilter) {
        // Logique pour les booléens (Network, Remote, At Home)
        if (boolFilter === "network") {
          isNetworkSelected = !isNetworkSelected;
        } else if (boolFilter === "remote") {
          isRemoteSelected = !isRemoteSelected;
        } else if (boolFilter === "athome") {
          isAtHomeSelected = !isAtHomeSelected;
        }
        search.helper.setQueryParameter("filters", composeFilters(buildFiltersStringFromJobsAndBooleans()));
        search.helper.search();
        return;
      }

      if (facetName && facetValue) {
        if (facetName === "jobs") {
          // Logique pour les métiers (Jobs) : sélection unique
          const index = selectedJobTags.indexOf(facetValue);
          if (index === -1) {
            selectedJobTags = [facetValue];
          } else {
            selectedJobTags = [];
          }

          // Nettoyage de l'état `selectedFacetTags` pour les métiers
          Array.from(selectedFacetTags).forEach(function (k) {
            if (k.indexOf("jobs:::") === 0) {
              selectedFacetTags.delete(k);
            }
          });

          if (selectedJobTags.length > 0) {
            selectedFacetTags.add(key);
          }

          search.helper.setQueryParameter("filters", composeFilters(buildFiltersStringFromJobsAndBooleans()));
          search.helper.search();
          return;
        }

        if (facetName === "reimbursment_percentage") {
          // Logique pour le remboursement (Reimbursment) : sélection unique virtuelle
          const isSelected = selectedFacetTags.has(key);

          // Si déjà sélectionné, on le désélectionne et on enlève les filtres
          if (isSelected) {
            selectedFacetTags.delete(key);
            search.helper.removeDisjunctiveFacetRefinement(facetName, "lt50");
            search.helper.removeDisjunctiveFacetRefinement(facetName, "50-99");
            search.helper.removeDisjunctiveFacetRefinement(facetName, "100");
          } else {
            // Désélectionne tous les autres filtres de remboursement virtuels
            Array.from(selectedFacetTags).forEach(function (k) {
              if (k.indexOf("reimbursment_percentage:::") === 0) {
                selectedFacetTags.delete(k);
              }
            });

            // Applique le nouveau filtre virtuel
            selectedFacetTags.add(key);
            search.helper.removeDisjunctiveFacetRefinement(facetName, "lt50");
            search.helper.removeDisjunctiveFacetRefinement(facetName, "50-99");
            search.helper.removeDisjunctiveFacetRefinement(facetName, "100");

            if (facetValue === "lt50") {
              // Applique la clause OR pour les valeurs < 50
              discountRawValues
                .filter(function (v) { return Number(v) < 50; })
                .forEach(function (v) {
                  search.helper.addDisjunctiveFacetRefinement(facetName, v);
                });
            } else if (facetValue === "50-99") {
              // Applique la clause OR pour les valeurs entre 50 et 99
              discountRawValues
                .filter(function (v) { return Number(v) >= 50 && Number(v) < 100; })
                .forEach(function (v) {
                  search.helper.addDisjunctiveFacetRefinement(facetName, v);
                });
            } else if (facetValue === "100") {
              search.helper.addDisjunctiveFacetRefinement(facetName, "100");
            }
          }
          search.helper.search();
          return;
        }

        if (facetValue === "__ALL_TYPES__") {
          // Logique pour "Toutes les catégories"
          search.helper.clearRefinements("type");
          // Nettoyage de l'état local
          Array.from(selectedFacetTags).forEach(function (k) {
            if (k.indexOf("type:::") === 0) {
              selectedFacetTags.delete(k);
            }
          });
          search.helper.search();
          return;
        }


        // Logique générale pour les autres facettes (type, specialities, prestations)
        const isSelected = selectedFacetTags.has(key);

        if (isSelected) {
          selectedFacetTags.delete(key);
          search.helper.removeDisjunctiveFacetRefinement(facetName, facetValue);
          search.helper.removeFacetRefinement(facetName, facetValue);
        } else {
          // Pour les types, on utilise un comportement de `disjunctiveFacet`
          if (facetName === "type" || facetName === "specialities" || facetName === "reimbursment_percentage") {
            search.helper.addDisjunctiveFacetRefinement(facetName, facetValue);
          } else {
            search.helper.addFacetRefinement(facetName, facetValue);
          }
          selectedFacetTags.add(key);
        }

        search.helper.search();
      }
    });

    // Événement personnalisé pour la géolocalisation
    window.addEventListener("updateGeoFilter", function (e) {
      const { lat, lng, label } = e.detail;

      currentGeoFilter = { lat, lng, label };

      // Appliquer les filtres de géolocalisation
      search.helper.setQueryParameter("aroundLatLng", `${lat},${lng}`);
      search.helper.setQueryParameter("aroundRadius", 50000); // 50km

      // Important : Réapplique le filtre de visibilité après avoir setté la géoloc
      search.helper.setQueryParameter("filters", composeFilters(buildFiltersStringFromJobsAndBooleans()));
      search.helper.search();
    });

    // 14. DÉMARRAGE DE LA RECHERCHE INSTANTANÉE ----------------------------------
    search.start();
  }

  // Démarre l'initialisation Algolia
  initAlgolia();
});
