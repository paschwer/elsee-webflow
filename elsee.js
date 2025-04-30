<script>
// Script global – Site Elsee

(function () {
  // 1. Localise les dates (optionnel, personnaliser le sélecteur si besoin)
  const localizeDates = () => {
    const data = {
      months: {
        en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        local: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
      },
      days: {
        en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        local: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
      }
    };

    const shorten = str => str.slice(0, 3);

    const convertToLocal = (type, selector) => {
      const elements = document.querySelectorAll(selector);
      const ref = type === 'month' ? data.months : data.days;

      elements.forEach(el => {
        let text = el.textContent;
        ref.en.forEach((en, i) => {
          const local = ref.local[i];
          text = text.replace(new RegExp(en, 'g'), local);
          text = text.replace(new RegExp(shorten(en), 'g'), shorten(local));
        });
        el.textContent = text;
      });
    };

    // Activer si besoin :
    // convertToLocal('month', '.classname');
    // convertToLocal('day', '.classname');
  };

  // 2. Accordéon FAQ
  const setupFAQToggle = () => {
    document.querySelectorAll(".faq_accordion_item").forEach(item => {
      const header = item.querySelector(".faq_accordion_header");
      const content = item.querySelector(".faq_accordion_content");
      const toggle = item.querySelector(".faq_accordion_toggle");

      if (header && content && toggle) {
        content.style.display = "none";
        header.addEventListener("click", () => {
          const isOpen = content.style.display === "block";
          content.style.display = isOpen ? "none" : "block";
          toggle.classList.toggle("active", !isOpen);
        });
      }
    });
  };

  // 3. Ajoute une virgule entre les éléments CMS d'une liste
  const addCommasToCMSLists = () => {
    document.querySelectorAll(".collection_list_with_separator").forEach(list => {
      const items = list.querySelectorAll(".w-dyn-item");
      items.forEach((item, i) => {
        const txt = item.querySelector(".main_text");
        if (txt && i < items.length - 1) {
          txt.textContent = txt.textContent.trim() + ", ";
        }
      });
    });
  };

  // 4. Boutons .funnelentry – ouverture d'une URL avec paramètre `url`
  const setupGlobalFunnelEntryButtons = () => {
    const buttons = document.querySelectorAll(".funnelentry");
    const currentUrl = encodeURIComponent(window.location.href);
    const targetBase = "/obtenir-mon-offre";

    buttons.forEach(button => {
      button.addEventListener("click", function (e) {
        e.preventDefault();
        const finalUrl = `${targetBase}?url=${currentUrl}`;
        window.open(finalUrl, "_blank");
      });
    });
  };

  // Initialisation
  document.addEventListener("DOMContentLoaded", function () {
    localizeDates();
    setupFAQToggle();
    addCommasToCMSLists();
    setupGlobalFunnelEntryButtons();
    setupMultiStepForm(); // si utilisé
  });
})();
</script>
