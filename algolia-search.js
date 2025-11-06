window.addEventListener("DOMContentLoaded", () => {
  const ALGOLIA_APP_ID = "DRTSPIHOUM";
  const ALGOLIA_SEARCH_KEY = "137b70e88a3288926c97a689cdcf4048";
  const ALGOLIA_INDEX_NAME = "elsee_index";

  // état front
  const selectedFacetTags = new Set();
  const selectedJobTags = [];
  let isNetworkSelected = false;
  let isRemoteSelected = false;
  let isAtHomeSelected = false;
  let speExpanded = false;
  let prestaExpanded = false;
  let jobExpanded = false;
  let currentGeoFilter = null;
  let searchInstance = null;
  let hasUserLaunchedSearch = false; // <- AJOUT


  function initAlgolia() {
    if (typeof algoliasearch === "undefined" || typeof instantsearch === "undefined") {
      setTimeout(initAlgolia, 200);
      return;
    }

    const searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);

        const search = instantsearch({
      indexName: ALGOLIA_INDEX_NAME,
      searchClient,
      searchFunction(helper) {
        const query = (helper.state.query || "").trim();

        // est-ce qu'il y a déjà une action utilisateur ?
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

        // on reconstruit les filtres métier existants
        const userFilters = buildFiltersStringFromJobsAndBooleans();
        const finalFilters = composeFilters(userFilters);

        helper.setQueryParameter("filters", finalFilters);
        helper.search();
      },
    });


    searchInstance = search;

    // utils
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
      return t === "Thérapeutes" || t === "therapeutes";
    }
function updateOnlyThpVisibility(helperState, hasJobsFacet) {
  const el = document.getElementById("onlythp");
  if (!el) return;

  const disj = helperState.disjunctiveFacetsRefinements || {};
  const facets = helperState.facetsRefinements || {};

  const types =
    (disj.type && disj.type.length ? disj.type : facets.type) || [];

  const noTypeSelected = types.length === 0;

  const hasThera = types.some((t) => {
    const tt = t.toLowerCase().trim();
    return tt === "Thérapeutes" || tt === "therapeutes";
  });

  // on n'affiche que si (jobs > 0) ET (pas de type ou Thérapeutes)
  if (hasJobsFacet && (noTypeSelected || hasThera)) {
    el.style.display = "flex";
  } else {
    el.style.display = "none";
  }
}


    // jobs + booléens → filters
    function buildFiltersStringFromJobsAndBooleans() {
      const parts = [];

      if (selectedJobTags.length > 0) {
        const jobParts = selectedJobTags.map((job) => {
          const safe = job.replace(/"/g, '\\"');
          return `(mainjob:"${safe}" OR jobs:"${safe}")`;
        });
        // AND entre métiers
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
    // filtre d'affichage de base selon l'état de la recherche
    function getVisibilityFilter() {
      // avant recherche → on exclut ceux qui sont "réservés à l'après-recherche"
      if (!hasUserLaunchedSearch) {
        return "NOT show_search:true";
      }
      // après recherche → on exclut ceux qui sont "home"
      return "NOT show_home:true";
    }

    // combine les filtres métier (jobs/booléens) avec le filtre de visibilité
    function composeFilters(userFilters) {
      const visibility = getVisibilityFilter();
      if (userFilters && userFilters.length) {
        return userFilters + " AND " + visibility;
      }
      return visibility;
    }

    // met l'état dans l’URL
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

      if (typeRef.length > 0) {
        params.set("type", typeRef.join(","));
      } else {
        params.delete("type");
      }

      if (speRef.length > 0) {
        params.set("specialities", speRef.join(","));
      } else {
        params.delete("specialities");
      }

      if (prestaRef.length > 0) {
        params.set("prestations", prestaRef.join(","));
      } else {
        params.delete("prestations");
      }

      if (reimbRef.length > 0) {
        params.set("reimbursment_percentage", reimbRef.join(","));
      } else {
        params.delete("reimbursment_percentage");
      }

      if (selectedJobTags.length > 0) {
        params.set("jobs", selectedJobTags.join(","));
      } else {
        params.delete("jobs");
      }

      if (currentGeoFilter && currentGeoFilter.lat && currentGeoFilter.lng) {
        params.set("geo", `${currentGeoFilter.lat},${currentGeoFilter.lng}`);
        if (currentGeoFilter.label) {
          params.set("geolabel", encodeURIComponent(currentGeoFilter.label));
        } else {
          params.delete("geolabel");
        }
      } else {
        params.delete("geo");
        params.delete("geolabel");
      }

      if (isNetworkSelected) {
        params.set("network", "true");
      } else {
        params.delete("network");
      }
      if (isRemoteSelected) {
        params.set("remote", "true");
      } else {
        params.delete("remote");
      }
      if (isAtHomeSelected) {
        params.set("athome", "true");
      } else {
        params.delete("athome");
      }

      const newUrl = `${window.location.pathname}${
        params.toString() ? "?" + params.toString() : ""
      }`;
      window.history.replaceState({}, "", newUrl);
    }

    // widget custom pour tous nos tags
    const dynamicSuggestionsWidget = {
      render({ results }) {
        if (!results) return;

        const typeWrapper = document.getElementById("tags_autocomplete_type");
        const speWrapper = document.getElementById("tags_autocomplete_spe");
        const speFilterWrapper = document.getElementById("spe_filtre");
        const prestaFilterWrapper = document.getElementById("presta_filtre");
        const jobFilterWrapper = document.getElementById("job_filtre");
        const labelFilterWrapper = document.getElementById("label-filter");
        const remoteFilterWrapper = document.getElementById("works-remotely-filter");
        const atHomeFilterWrapper = document.getElementById("works-at-home-filter");
        const discountFilterWrapper = document.getElementById("discount-tags");

        if (!typeWrapper || !speWrapper) return;

        typeWrapper.classList.add("directory_suggestions_tags_wrapper");
        speWrapper.classList.add("directory_suggestions_tags_wrapper");

        // 1. TYPES
        let typeFacetValues = results.getFacetValues("type", {
          sortBy: ["count:desc", "name:asc"],
        });
        if (!Array.isArray(typeFacetValues)) typeFacetValues = [];

        const typeHtml = typeFacetValues
          .filter((fv) => fv && fv.name)
          .map((fv) => {
            const key = `type:::${fv.name}`;
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
          const hasTypeSelected = Array.from(selectedFacetTags).some((k) =>
            k.startsWith("type:::")
          );
          let altHtml =
            '<div class="directory_category_tag_wrapper ' +
            (hasTypeSelected ? "" : "is-selected") +
            '" data-facet-name="type" data-facet-value="__ALL_TYPES__">Toutes les catégories</div>';

          altHtml += typeFacetValues
            .filter((fv) => fv && fv.name)
            .map((fv) => {
              const key = `type:::${fv.name}`;
              const isSelected = selectedFacetTags.has(key);
              const label = `Les ${fv.name.toLowerCase()}`;
              return (
                '<div class="directory_category_tag_wrapper ' +
                (isSelected ? "is-selected" : "") +
                '" data-facet-name="type" data-facet-value="' +
                fv.name +
                '">' +
                label +
                "</div>"
              );
            })
            .join("");

          typesAltWrapper.innerHTML = altHtml;
        }

        // 2. SPECIALITIES
        let speFacetValues = results.getFacetValues("specialities", {
          sortBy: ["count:desc", "name:asc"],
        });
        if (!Array.isArray(speFacetValues)) speFacetValues = [];
// version triée A→Z pour le bloc de filtres
const speFacetValuesAlpha = [...speFacetValues].sort((a, b) =>
  (a.name || "").localeCompare(b.name || "")
);

        const speContainer = document.getElementById("speContainer");
if (speContainer) {
  const hasSpe = speFacetValues.some((fv) => fv && fv.count > 0);
  speContainer.style.display = hasSpe ? "flex" : "none";
};
        const selectedSpe = Array.from(selectedFacetTags)
          .filter((k) => k.startsWith("specialities:::"))
          .map((k) => k.split(":::")[1]);

        const seen = new Set();
        const speBlocks = [];

        selectedSpe.forEach((value) => {
          seen.add(value);
          speBlocks.push({ name: value, count: null });
        });

        for (const fv of speFacetValues) {
          if (!fv || !fv.name) continue;
          if (seen.has(fv.name)) continue;
          if (speBlocks.length >= 10) break;
          if (fv.count === 0) continue;
          speBlocks.push({ name: fv.name, count: fv.count });
          seen.add(fv.name);
        }

        const speHtml = speBlocks
          .map((item) => {
            const key = `specialities:::${item.name}`;
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
    .filter((fv) => fv && fv.name)
    .slice(0, maxToShow)
    .map((fv) => {
      const key = `specialities:::${fv.name}`;
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
        }

        // 3. PRESTATIONS
        if (prestaFilterWrapper) {
          let prestaFacetValues = results.getFacetValues("prestations", {
            sortBy: ["name:asc"],
          });
          if (!Array.isArray(prestaFacetValues)) prestaFacetValues = [];
          const serviceContainer = document.getElementById("serviceContainer");
  if (serviceContainer) {
    const hasPresta = prestaFacetValues.some((fv) => fv && fv.count > 0);
    serviceContainer.style.display = hasPresta ? "flex" : "none";
  };
          const maxToShowPresta = prestaExpanded
            ? prestaFacetValues.length
            : 6;
          const prestaListHtml = prestaFacetValues
            .filter((fv) => fv && fv.name)
            .slice(0, maxToShowPresta)
            .map((fv) => {
              const key = `prestations:::${fv.name}`;
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
        }

        // 4. MÉTIERS (mainjob + jobs)
if (jobFilterWrapper) {
  let mainFacetValues = results.getFacetValues("mainjob", {
    sortBy: ["name:asc"],
  });
  let jobFacetValues = results.getFacetValues("jobs", {
    sortBy: ["name:asc"],
  });

  if (!Array.isArray(mainFacetValues)) mainFacetValues = [];
  if (!Array.isArray(jobFacetValues)) jobFacetValues = [];

  // LOG 1 : ce qu’Algolia nous renvoie vraiment
  console.log("[ALGOLIA] mainjob facetValues =", mainFacetValues);
  console.log("[ALGOLIA] jobs facetValues =", jobFacetValues);

  const merged = new Map();

  mainFacetValues.forEach((fv) => {
    if (!fv || !fv.name) return;
    merged.set(fv.name, {
      name: fv.name,
      mainCount: fv.count || 0,
      jobCount: 0,
    });
  });

  jobFacetValues.forEach((fv) => {
    const nameRaw = fv && fv.name ? fv.name.trim() : "";
    if (!nameRaw) return;
    if (merged.has(nameRaw)) {
      const cur = merged.get(nameRaw);
      cur.jobCount = fv.count || 0;
    } else {
      merged.set(nameRaw, {
        name: nameRaw,
        mainCount: 0,
        jobCount: fv.count || 0,
      });
    }
  });

  const mergedArr = Array.from(merged.values()).sort((a, b) =>
  (a.name || "").localeCompare(b.name || "")
);


  // est-ce qu’on a au moins 1 job ?
  const hasJobsFacet =
    mainFacetValues.some((fv) => fv && fv.count > 0) ||
    jobFacetValues.some((fv) => fv && fv.count > 0);

  console.log("[DIR] hasJobsFacet =", hasJobsFacet);

  // on check aussi le state pour voir les types sélectionnés
  if (searchInstance && searchInstance.helper) {
    console.log(
      "[DIR] helper state types =",
      (searchInstance.helper.state.disjunctiveFacetsRefinements?.type ||
        searchInstance.helper.state.facetsRefinements?.type ||
        [])
    );
    updateOnlyThpVisibility(searchInstance.helper.state, hasJobsFacet);
  } else {
    console.log("[DIR] pas de searchInstance/helper dispo");
  }

  const maxToShowJob = jobExpanded ? mergedArr.length : 6;

  const jobListHtml = mergedArr
    .slice(0, maxToShowJob)
    .map((item) => {
      const value = (item.name || "").trim();
      const key = `jobs:::${value}`;
      const isSelected =
        selectedFacetTags.has(key) || selectedJobTags.includes(value);
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
}

        // 5. BOOLÉENS
        if (labelFilterWrapper) {
          labelFilterWrapper.innerHTML =
            '<div class="directory_category_tag_wrapper ' +
            (isNetworkSelected ? "is-selected" : "") +
            '" data-bool-filter="network">' +
            '<span class="directory_option_icon">' +
            '<svg width="auto" height="auto" viewBox="0 0 25 21" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M23.984 17.5351L23.8018 17.3529C23.644 17.1937 23.3902 17.178 23.2152 17.32C21.8196 18.4516 20.2132 19.0167 18.393 19.0167C16.8483 19.0167 15.5201 18.509 14.41 17.4921C13.3973 16.567 12.6558 15.3435 12.1825 13.8231C12.1065 13.5778 12.2556 13.3197 12.5052 13.2594C14.4272 12.8062 16.091 12.34 17.498 11.8624C19.0155 11.3475 20.249 10.7853 21.1971 10.1757C22.1466 9.56609 22.8451 8.89483 23.2912 8.16333C23.7387 7.4304 23.9624 6.63149 23.9624 5.76517C23.9624 4.30074 23.3385 3.12891 22.0921 2.24824C20.8457 1.36758 19.2063 0.927246 17.1739 0.927246C15.7094 0.927246 14.354 1.17825 13.1076 1.67882C11.8612 2.18083 10.7912 2.87791 9.89618 3.77292C9.00261 4.66792 8.29693 5.72358 7.78345 6.94274C7.26853 8.16333 7.01035 9.4915 7.01035 10.9272V10.933C7.01035 11.2055 7.26136 11.4092 7.53101 11.3618C8.78459 11.1395 10.0511 10.9287 11.2344 10.6533C11.4381 10.606 11.5786 10.4195 11.5729 10.2101C11.5672 10.0451 11.5643 9.87733 11.5643 9.70809C11.5643 8.5965 11.6919 7.59391 11.9501 6.6989C12.2069 5.80533 12.5654 5.03224 13.0273 4.3825C13.4877 3.73132 14.0356 3.23075 14.6739 2.87791C15.3093 2.5265 16.0078 2.35008 16.7665 2.35008C17.716 2.35008 18.4604 2.62116 19.0026 3.16333C19.5448 3.7055 19.8159 4.42266 19.8159 5.31767C19.8159 7.31709 18.601 8.98089 16.1742 10.3091C16.1612 10.3162 16.1498 10.3248 16.1383 10.3334C15.8055 10.5715 15.1242 10.8986 13.9237 11.3432C13.8334 11.3762 13.7387 11.4063 13.6469 11.4393L13.6426 11.4422C13.5824 11.4637 13.5207 11.4823 13.4604 11.5024C13.4203 11.5167 13.3801 11.5297 13.34 11.5426C12.9613 11.6673 12.5812 11.7835 12.2011 11.8882C12.0448 11.9341 11.8884 11.98 11.7264 12.0245L11.7249 12.0159C6.89131 13.2451 2.14661 12.9338 0.111328 12.7072C1.45671 13.1705 5.65063 13.661 7.08494 13.8217C9.05711 17.3773 11.963 19.7755 13.1693 20.2359C15.6549 20.9272 19.8288 20.6633 21.0766 20.1341C22.1853 19.6651 23.1549 19.0067 23.9854 18.1605Z" fill="currentColor"></path>' +
            "</svg>" +
            "</span>" +
            "<span>Membres réseaux</span>" +
            "</div>";
        }

        if (remoteFilterWrapper) {
          remoteFilterWrapper.innerHTML =
            '<div class="directory_category_tag_wrapper ' +
            (isRemoteSelected ? "is-selected" : "") +
            '" data-bool-filter="remote">' +
            '<span class="directory_option_icon">' +
            '<svg width="auto" height="auto" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path fill-rule="evenodd" clip-rule="evenodd" d="M0 10.5697C0 4.73221 4.5667 0 10.2 0C15.8333 0 20.4 4.73222 20.4 10.5697V14.4485C20.4 14.9305 20.0229 15.3212 19.5578 15.3212C19.0927 15.3212 18.7156 14.9305 18.7156 14.4485V10.5697C18.7156 5.6962 14.903 1.74545 10.2 1.74545C5.49697 1.74545 1.6844 5.6962 1.6844 10.5697V14.4485C1.6844 14.9305 1.30734 15.3212 0.842202 15.3212C0.377067 15.3212 0 14.9305 0 14.4485V10.5697ZM2.80734 12.9939C2.80734 11.1731 4.23181 9.69697 5.98899 9.69697C7.74617 9.69697 9.17064 11.1731 9.17064 12.9939V15.903C9.17064 17.7239 7.74617 19.2 5.98899 19.2C4.23181 19.2 2.80734 17.7239 2.80734 15.903V12.9939ZM5.98899 11.4424C5.16208 11.4424 4.49174 12.1371 4.49174 12.9939V15.903C4.49174 16.7599 5.16208 17.4545 5.98899 17.4545C6.8159 17.4545 7.48624 16.7599 7.48624 15.903V12.9939C7.48624 12.1371 6.8159 11.4424 5.98899 11.4424ZM11.2294 12.9939C11.2294 11.1731 12.6538 9.69697 14.411 9.69697C16.1682 9.69697 17.5927 11.1731 17.5927 12.9939V15.903C17.5927 17.7239 16.1682 19.2 14.411 19.2C12.6538 19.2 11.2294 17.7239 11.2294 15.903V12.9939ZM14.411 11.4424C13.5841 11.4424 12.9138 12.1371 12.9138 12.9939V15.903C12.9138 16.7599 13.5841 17.4545 14.411 17.4545C15.2379 17.4545 15.9083 16.7599 15.9083 15.903V12.9939C15.9083 12.1371 15.2379 11.4424 14.411 11.4424Z" fill="currentColor"></path>' +
            "</svg>" +
            "</span>" +
            "<span>Travail en visio</span>" +
            "</div>";
        }

        if (atHomeFilterWrapper) {
          atHomeFilterWrapper.innerHTML =
            '<div class="directory_category_tag_wrapper ' +
            (isAtHomeSelected ? "is-selected" : "") +
            '" data-bool-filter="athome">' +
            '<span class="directory_option_icon">' +
            '<svg width="auto" height="auto" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path fill-rule="evenodd" clip-rule="evenodd" d="M9.72983 1.95795C9.655 1.90735 9.545 1.90735 9.47017 1.95795L1.98217 7.02182C1.9314 7.05615 1.92 7.09646 1.92 7.11941V16.5967C1.92 16.9292 2.21782 17.28 2.688 17.28H16.512C16.9822 17.28 17.28 16.9292 17.28 16.5967V7.11941C17.28 7.09646 17.2686 7.05615 17.2178 7.02182L9.72983 1.95795ZM8.39461 0.367496C9.11917 -0.1225 10.0808 -0.122498 10.8054 0.367497L18.2934 5.43136C18.8504 5.80805 19.2 6.43312 19.2 7.11941V16.5967C19.2 18.0793 17.9505 19.2 16.512 19.2H2.688C1.24948 19.2 0 18.0793 0 16.5967V7.11941C0 6.43312 0.349589 5.80805 0.906605 5.43136L8.39461 0.367496Z" fill="currentColor"></path>' +
            "</svg>" +
            "</span>" +
            "<span>Se déplace à domicile</span>" +
            "</div>";
        }

        // 6. REMBOURSEMENT (disjunctif)
        if (discountFilterWrapper) {
          let reimburseFacetValues = results.getFacetValues(
            "reimbursment_percentage",
            {
              sortBy: ["name:asc"],
            }
          );

          if (!Array.isArray(reimburseFacetValues)) {
            reimburseFacetValues = [];
          }

          const filtered = reimburseFacetValues
            .filter((fv) => fv && fv.name !== undefined && fv.name !== null)
            .map((fv) => ({
              name: String(fv.name),
              count: fv.count || 0,
            }))
            .filter((v) => v.name !== "")
            .sort((a, b) => Number(a.name) - Number(b.name));

          const html = filtered
            .map((item) => {
              const key = `reimbursment_percentage:::${item.name}`;
              const isSelected = selectedFacetTags.has(key);
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
      },
    };

    // widgets algolia
    search.addWidgets([
      instantsearch.widgets.configure({
        facets: [
          "specialities",
          "prestations",
          "mainjob",
          "jobs"
        ],
        disjunctiveFacets: ["type", "reimbursment_percentage"],
        hitsPerPage: 48,
      }),

      instantsearch.widgets.searchBox({
        container: "#searchbox",
        placeholder:
          "Écrivez ici tout ce qui concerne vos besoins...",
        cssClasses: {
          root: "directory_search_field_container",
          input: "directory_search_text",
        },
      }),

      instantsearch.widgets.stats({
        container: "#search_count",
        templates: {
          text(data) {
            if (data.nbHits === 0) return "0 résultat";
            if (data.nbHits === 1) return "1 résultat";
            return data.nbHits + " résultats";
          },
        },
      }),

      instantsearch.widgets.infiniteHits({
        container: "#hits",
        hitsPerPage: 48,
        showMore: true,
        cssClasses: {
          loadMore: "directory_show_more_button",
        },
        transformItems(items) {
          // réseau en premier
          return items
            .slice()
            .sort((a, b) => {
              const aNet = a.is_elsee_network ? 1 : 0;
              const bNet = b.is_elsee_network ? 1 : 0;
              if (aNet !== bNet) return bNet - aNet;
              return 0;
            });
        },
        templates: {
          item(hit) {
            const photoUrl = hit.photo_url || "";
            const isNetwork = !!hit.is_elsee_network;
            const isRemote = !!hit.is_remote;
            const isAtHome = !!hit.is_at_home;
            const reimbursement = hit.reimbursment_percentage ?? "";
            const name = hit.name || "";
            const city = hit.city || "";
            const depNum = hit.department_number || "";
            const url = hit.url || "#";
            const showSearch = hit.show_search !== false;
            const showHome = !!hit.show_home;
            const source = hit.source_collection || "";
            const isSport =
              source === "sports_studio" || source === "studio_enfant";
            const Therapeutes = isTherapeutes(hit);

            const remoteSvg =
              document.querySelector(".directory_remote_icon")?.innerHTML ||
              "";
            const atHomeSvg =
              document.querySelector(".directory_at_home_icon")?.innerHTML ||
              "";
            const discountSvg =
              document.querySelector(".directory_discount_icon")?.innerHTML ||
              "";
            const locationSvg =
              document.querySelector(".directory_card_location_icon")
                ?.innerHTML || "";

            const photoDiv =
              '<div class="directory_card_photo_container">' +
              '<div class="directory_card_photo' +
              (isNetwork ? " is-label" : "") +
              '" style="' +
              (photoUrl
                ? "background-image:url('" +
                  photoUrl +
                  "');background-size:cover;background-position:center;"
                : "") +
              '">' +
              '<div class="directory_card_label_tag" style="display:' +
              (isNetwork ? "flex" : "none") +
              ';">' +
              '<img src="https://cdn.prod.website-files.com/64708634ac0bc7337aa7acd8/65a65b49a0e66151845cad61_mob_menu_logo_dark_green.svg" loading="lazy" alt="" class="directory_card_label_tag_logo">' +
              "</div>" +
              "</div>" +
              "</div>";

            const remoteIcon =
              '<div class="directory_remote_icon" style="display:' +
              (isRemote ? "block" : "none") +
              ';">' +
              remoteSvg +
              '<div class="tooltip">Consultation en visio</div>' +
              "</div>";

            const atHomeIcon =
              '<div class="directory_at_home_icon" style="display:' +
              (isAtHome ? "block" : "none") +
              ';">' +
              atHomeSvg +
              '<div class="tooltip">Se déplace à votre domicile</div>' +
              "</div>";

            const showDiscount = !Therapeutes;
            const discountDiv =
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

            const titleDiv =
              '<div class="directory_card_title"><div>' +
              name +
              "</div></div>";

            const prestationsArr = toArray(hit.prestations);
            const specialitiesArr = toArray(hit.specialities);
            let partnerDetails1 = "";
            if (Therapeutes) {
              partnerDetails1 = hit.mainjob || "";
            } else {
              if (prestationsArr.length > 0) {
                partnerDetails1 = prestationsArr.join(", ");
              } else {
                if (specialitiesArr.length > 3) {
                  const visibleSpecialities = specialitiesArr
                    .slice(0, 3)
                    .join(", ");
                  const extraSpecialities = specialitiesArr.slice(3);
                  const extraCount = extraSpecialities.length;
                  const tooltipContent = extraSpecialities
                    .map((s) => "<div>" + s + "</div>")
                    .join("");
                  partnerDetails1 =
                    visibleSpecialities +
                    ', <span class="directory_card_more_specialities"><span class="directory_remote_icon">+' +
                    extraCount +
                    '<div class="tooltip">' +
                    tooltipContent +
                    "</div></span></span>";
                } else {
                  partnerDetails1 = specialitiesArr.join(", ");
                }
              }
            }

            const partnerDetails1Div =
              '<div class="directory_card_partner_details_1"><div>' +
              partnerDetails1 +
              "</div></div>";

            let partnerDetails2Html = "";
            if (Therapeutes) {
              const jobsArr = toArray(hit.jobs);
let jobsTxt = "";
if (jobsArr.length > 3) {
  const firstThree = jobsArr.slice(0, 3).join(", ");
  const extraCount = jobsArr.length - 3;
  jobsTxt = `${firstThree} +${extraCount}`;
} else {
  jobsTxt = jobsArr.join(", ");
}

partnerDetails2Html =
  '<div class="directory_card_partner_details_2"><div>' +
  jobsTxt +
  "</div></div>";

            } else {
              const shortTxt = truncate(hit.short_desc || "", 70);
              partnerDetails2Html =
                '<div class="directory_card_partner_details_2"><div class="directory_card_partner_short_desc">' +
                shortTxt +
                "</div></div>";
            }

            let showLocation = true;
            if (isSport && showHome === true) showLocation = false;
            if (!showSearch) showLocation = false;
            if (!city && !depNum) showLocation = false;

            const locationText =
              Therapeutes || isSport
                ? city + (depNum ? " (" + depNum + ")" : "")
                : city;

            const locationDiv =
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

            let tagItems = [];
            if (Therapeutes) {
              tagItems = toArray(hit.prestations).slice(0, 2);
            } else {
              tagItems = toArray(hit.specialities).slice(0, 2);
            }

            const prestasHtml = tagItems
              .map(
                (p) =>
                  '<div class="directory_card_prestation_tag"><div>' +
                  p +
                  "</div></div>"
              )
              .join("");

            const prestationsDiv =
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
              partnerDetails1Div +
              partnerDetails2Html +
              "</div>" +
              locationDiv +
              prestationsDiv +
              "</a>" +
              "</li>"
            );
          },
          empty: "<div>Aucun résultat trouvé.</div>",
          showMoreText: "Afficher plus de résultat",
        },
      }),

      dynamicSuggestionsWidget,
    ]);

    search.start();

    // à chaque render
    search.on("render", () => {
  renderClearButton();

  if (search.helper && search.helper.state) {
    // on garde l’URL à jour
    updateUrlFromState(search.helper.state);
  }

  const renderState = search.renderState?.[ALGOLIA_INDEX_NAME];
  const buttons = document.querySelectorAll(
    ".ais-InfiniteHits-loadMore, .directory_show_more_button"
  );
  const domCards = document.querySelectorAll(
    "#hits .directory_card_container"
  ).length;
  const nbHits = renderState?.searchResults?.nbHits;
  const infiniteResults = renderState?.infiniteHits?.results;
  const hasMore = infiniteResults
    ? infiniteResults.nbPages > infiniteResults.page + 1
    : false;

  buttons.forEach((btn) => {
    const isDisabledBtn =
      btn.classList.contains("ais-InfiniteHits-loadMore--disabled") ||
      btn.hasAttribute("disabled");

    const mustHide =
      (typeof nbHits === "number" && domCards >= nbHits) ||
      isDisabledBtn ||
      !hasMore;

    if (mustHide) {
      btn.setAttribute("style", "display: none;");
      btn.classList.add("is-hidden");
      btn.setAttribute("aria-hidden", "true");
    } else {
      btn.setAttribute("style", "display: block;");
      btn.classList.remove("is-hidden");
      btn.removeAttribute("aria-hidden");
    }
  });
});




    // setup listeners
    setupSearchDropdown();
    setupSuggestionClicks();
    setupTypeBlockClicks();
    setupSpePrestaBlockClicks();
    setupJobBlockClicks();
    setupBooleanBlockClicks();
    setupDiscountBlockClicks();

    // ---- setup functions ----
    const mapsClearBtn = document.querySelector(".directory_search_clear");
if (mapsClearBtn) {
  mapsClearBtn.addEventListener("click", () => {
    if (!searchInstance || !searchInstance.helper) return;
    const helper = searchInstance.helper;

    // on vide l'état de localisation
    currentGeoFilter = null;
    helper.setQueryParameter("aroundLatLng", undefined);
    helper.setQueryParameter("aroundRadius", undefined);

    // on nettoie le champ
    const mapsInput = document.getElementById("maps_input");
    const mapsBox = document.getElementById("maps_autocomplete");
    if (mapsInput) {
      mapsInput.value = "";
      mapsInput.classList.remove("is-selected");
    }
    if (mapsBox) {
      mapsBox.style.display = "none";
    }
    mapsClearBtn.style.display = "none";

    // on relance la recherche
    helper.search();
  });
}
    const clearBtnMobile = document.getElementById("clear_button_mobile");
if (clearBtnMobile) {
  clearBtnMobile.addEventListener("click", () => {
    if (!searchInstance || !searchInstance.helper) return;
    const helper = searchInstance.helper;
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
    hasUserLaunchedSearch = false; // <- AJOUT

    const mapsInput = document.getElementById("maps_input");
    const mapsBox = document.getElementById("maps_autocomplete");
    const mapsClear = document.querySelector(".directory_search_clear");
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


    function setupBooleanBlockClicks() {
      const labelFilterWrapper = document.getElementById("label-filter");
      const remoteFilterWrapper = document.getElementById(
        "works-remotely-filter"
      );
      const atHomeFilterWrapper = document.getElementById(
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

        const helper = searchInstance.helper;
        const filtersStr = buildFiltersStringFromJobsAndBooleans();
        helper.setQueryParameter("filters", filtersStr);
        helper.search();
      }

      if (labelFilterWrapper) {
        labelFilterWrapper.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-bool-filter]");
          if (!btn) return;
          const flagName = btn.getAttribute("data-bool-filter");
          toggleAndSearch(flagName);
        });
      }
      if (remoteFilterWrapper) {
        remoteFilterWrapper.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-bool-filter]");
          if (!btn) return;
          const flagName = btn.getAttribute("data-bool-filter");
          toggleAndSearch(flagName);
        });
      }
      if (atHomeFilterWrapper) {
        atHomeFilterWrapper.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-bool-filter]");
          if (!btn) return;
          const flagName = btn.getAttribute("data-bool-filter");
          toggleAndSearch(flagName);
        });
      }
    }

    function setupDiscountBlockClicks() {
      const discountWrapper = document.getElementById("discount-tags");
      if (!discountWrapper) return;
      discountWrapper.addEventListener("click", (e) => {
        const tag = e.target.closest(".directory_category_tag_wrapper");
        if (!tag || !searchInstance || !searchInstance.helper) return;
        const facetName = tag.getAttribute("data-facet-name");
        const facetValue = tag.getAttribute("data-facet-value");
        const key = `${facetName}:::${facetValue}`;
        const helper = searchInstance.helper;
        const isSelected = selectedFacetTags.has(key);

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
      const input = document.querySelector(".directory_search_field_container");
      const dropdown =
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
      const clearBtn = document.getElementById("clear_button");
      if (!clearBtn) return;

      const hasQuery =
        searchInstance &&
        searchInstance.helper &&
        (searchInstance.helper.state.query || "").trim() !== "";
      const hasFacets = selectedFacetTags.size > 0;
      const hasGeo = !!currentGeoFilter;
      const hasJobs = selectedJobTags.length > 0;
      const hasBools =
        isNetworkSelected || isRemoteSelected || isAtHomeSelected;

      clearBtn.style.display =
        hasQuery || hasFacets || hasGeo || hasJobs || hasBools
          ? "flex"
          : "none";
    }

    const clearBtnInit = document.getElementById("clear_button");
    if (clearBtnInit) {
      clearBtnInit.addEventListener("click", () => {
        if (!searchInstance || !searchInstance.helper) return;
        const helper = searchInstance.helper;
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
        hasUserLaunchedSearch = false; // <- AJOUT


        const mapsInput = document.getElementById("maps_input");
        const mapsBox = document.getElementById("maps_autocomplete");
        const mapsClear = document.querySelector(".directory_search_clear");
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
      const dropdown =
        document.getElementById("tags_autocomplete") ||
        document.querySelector(".directory_search_dropdown_wrapper");
      if (!dropdown) return;

      dropdown.addEventListener("click", (e) => {
        const tag = e.target.closest(".directory_suggestions_tag");
        if (!tag || !searchInstance) return;

        const facetName = tag.getAttribute("data-facet-name");
        const facetValue = tag.getAttribute("data-facet-value");
        if (!facetName || !facetValue) return;

        const helper = searchInstance.helper;
        const key = `${facetName}:::${facetValue}`;
        const isSelected = tag.classList.contains("is-selected");

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
              helper.addDisjunctiveFacetRefinement(facetName, facetValue).search();
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
      const typesAltWrapper = document.getElementById("directory_types");
      if (!typesAltWrapper) return;

      typesAltWrapper.addEventListener("click", (e) => {
        const tag = e.target.closest(".directory_category_tag_wrapper");
        if (!tag || !searchInstance || !searchInstance.helper) return;

        const facetName = tag.getAttribute("data-facet-name");
        let facetValue = tag.getAttribute("data-facet-value") || "";
        facetValue = facetValue.trim();
        const helper = searchInstance.helper;

        if (facetValue === "__ALL_TYPES__") {
          helper.clearRefinements("type");
          Array.from(selectedFacetTags)
            .filter((k) => k.startsWith("type:::"))
            .forEach((k) => selectedFacetTags.delete(k));
          helper.search();
          return;
        }

        const key = `${facetName}:::${facetValue}`;
        const isSelected = selectedFacetTags.has(key);

        if (isSelected) {
          selectedFacetTags.delete(key);
          helper.removeDisjunctiveFacetRefinement(facetName, facetValue).search();
        } else {
          selectedFacetTags.add(key);
          helper.addDisjunctiveFacetRefinement(facetName, facetValue).search();
        }
      });
    }

    function setupSpePrestaBlockClicks() {
      const speWrapper = document.getElementById("spe_filtre");
      const moreSpe = document.getElementById("more-spe");
      if (speWrapper) {
        speWrapper.addEventListener("click", (e) => {
          const tag = e.target.closest(".directory_category_tag_wrapper");
          if (!tag || !searchInstance || !searchInstance.helper) return;
          const facetName = tag.getAttribute("data-facet-name");
          const facetValue = tag.getAttribute("data-facet-value");
          const key = `${facetName}:::${facetValue}`;
          const helper = searchInstance.helper;
          const isSelected = selectedFacetTags.has(key);
          if (isSelected) {
            selectedFacetTags.delete(key);
            helper.removeFacetRefinement(facetName, facetValue).search();
          } else {
            selectedFacetTags.add(key);
            helper.addFacetRefinement(facetName, facetValue).search();
          }
        });
      }
      if (moreSpe) {
        moreSpe.addEventListener("click", () => {
          speExpanded = !speExpanded;
          if (searchInstance) searchInstance.refresh();
        });
      }

      const prestaWrapper = document.getElementById("presta_filtre");
      const morePresta = document.getElementById("more-presta");
      if (prestaWrapper) {
        prestaWrapper.addEventListener("click", (e) => {
          const tag = e.target.closest(".directory_category_tag_wrapper");
          if (!tag || !searchInstance || !searchInstance.helper) return;
          const facetName = tag.getAttribute("data-facet-name");
          const facetValue = tag.getAttribute("data-facet-value");
          const key = `${facetName}:::${facetValue}`;
          const helper = searchInstance.helper;
          const isSelected = selectedFacetTags.has(key);
          if (isSelected) {
            selectedFacetTags.delete(key);
            helper.removeFacetRefinement(facetName, facetValue).search();
          } else {
            selectedFacetTags.add(key);
            helper.addFacetRefinement(facetName, facetValue).search();
          }
        });
      }
      if (morePresta) {
        morePresta.addEventListener("click", () => {
          prestaExpanded = !prestaExpanded;
          if (searchInstance) searchInstance.refresh();
        });
      }
    }

    function setupJobBlockClicks() {
      const jobWrapper = document.getElementById("job_filtre");
      const moreJob = document.getElementById("more-job");

      if (jobWrapper) {
        jobWrapper.addEventListener("click", (e) => {
          const tag = e.target.closest(".directory_category_tag_wrapper");
          if (!tag || !searchInstance || !searchInstance.helper) return;
          const value = (tag.getAttribute("data-facet-value") || "").trim();
          const helper = searchInstance.helper;
          const key = `jobs:::${value}`;
          const idx = selectedJobTags.indexOf(value);

          if (idx > -1) {
            selectedJobTags.splice(idx, 1);
            selectedFacetTags.delete(key);
          } else {
            selectedJobTags.push(value);
            selectedFacetTags.add(key);
          }

          const filtersStr = buildFiltersStringFromJobsAndBooleans();
          helper.setQueryParameter("filters", filtersStr);
          helper.search();
        });
      }

      if (moreJob) {
        moreJob.addEventListener("click", () => {
          jobExpanded = !jobExpanded;
          if (searchInstance) searchInstance.refresh();
        });
      }
    }

    function applyGeoFilterFromMaps(lat, lng, label = "") {
      currentGeoFilter = { lat, lng, label };
      if (searchInstance && searchInstance.helper) {
        const helper = searchInstance.helper;
        helper.setQueryParameter("aroundLatLng", `${lat},${lng}`);
        helper.setQueryParameter("aroundRadius", 100000);
        helper.search();
      }
      const mapsInput = document.getElementById("maps_input");
      const mapsClear = document.querySelector(".directory_search_clear");
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
      const params = new URLSearchParams(window.location.search);
      const query = params.get("q") || "";
      const types = (params.get("type") || "").split(",").filter(Boolean);
      const spes = (params.get("specialities") || "").split(",").filter(Boolean);
      const geo = params.get("geo") || "";
      const prestas = (params.get("prestations") || "").split(",").filter(Boolean);
      const jobs = (params.get("jobs") || "").split(",").filter(Boolean);
      const reimb = (params.get("reimbursment_percentage") || "")
        .split(",")
        .filter(Boolean);
      const geolabel = params.get("geolabel") || "";
      const urlNetwork = params.get("network") === "true";
      const urlRemote = params.get("remote") === "true";
      const urlAtHome = params.get("athome") === "true";

      if (!searchInstance || !searchInstance.helper) return;
      const helper = searchInstance.helper;

      if (query) {
        helper.setQuery(query);
      }

      helper.clearRefinements("type");
      helper.clearRefinements("specialities");
      helper.clearRefinements("prestations");
      helper.clearRefinements("jobs");
      helper.clearRefinements("reimbursment_percentage");

      types.forEach((t) => helper.addDisjunctiveFacetRefinement("type", t));
      spes.forEach((s) => helper.addFacetRefinement("specialities", s));
      prestas.forEach((p) => helper.addFacetRefinement("prestations", p));
      reimb.forEach((r) =>
        helper.addDisjunctiveFacetRefinement("reimbursment_percentage", r)
      );

      types.forEach((t) => selectedFacetTags.add(`type:::${t}`));
      spes.forEach((s) => selectedFacetTags.add(`specialities:::${s}`));
      prestas.forEach((p) => selectedFacetTags.add(`prestations:::${p}`));
      reimb.forEach((r) =>
        selectedFacetTags.add(`reimbursment_percentage:::${r}`)
      );

      jobs.forEach((j) => {
        const cleanJob = j.trim();
        if (!cleanJob) return;
        if (!selectedJobTags.includes(cleanJob)) {
          selectedJobTags.push(cleanJob);
        }
      });

      isNetworkSelected = urlNetwork;
      isRemoteSelected = urlRemote;
      isAtHomeSelected = urlAtHome;

      const filtersStr = buildFiltersStringFromJobsAndBooleans();
      helper.setQueryParameter("filters", filtersStr);

      if (geo) {
        const [latStr, lngStr] = geo.split(",");
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (!isNaN(lat) && !isNaN(lng)) {
          currentGeoFilter = {
            lat,
            lng,
            label: geolabel ? decodeURIComponent(geolabel) : "",
          };
          helper.setQueryParameter("aroundLatLng", `${lat},${lng}`);
          helper.setQueryParameter("aroundRadius", 100000);
          const mapsInput = document.getElementById("maps_input");
          const mapsClear = document.querySelector(".directory_search_clear");
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

    setTimeout(applyUrlParamsToSearch, 50);
    window.applyGeoFilterFromMaps = applyGeoFilterFromMaps;
  }

  initAlgolia();
});
