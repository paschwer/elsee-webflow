(function () {
  // 1. Affiche l’URL
  const showPageUrl = () => {
    const urlDisplay = document.querySelector('[fs-hacks-element="show-page-url"]');
    const urlInput = document.querySelector('[fs-hacks-element="page-url-input"]');
    if (urlDisplay && urlInput) {
      urlInput.value = location.href;
      urlDisplay.textContent = location.href;
    }
  };

  // 2. Localise les dates
  const localizeDates = () => {
    const data = {
      months: {
        en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
        local: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
      },
      days: {
        en: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
        local: ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']
      }
    };
    const shorten = str => str.slice(0, 3);
    const convertToLocal = (type, selector) => {
      const elements = document.querySelectorAll(selector);
      const ref = type === 'month' ? data.months : data.days;
      elements.forEach(el => {
        let text = el.textContent;
        ref.en.forEach((en, i) => {
          text = text.replace(new RegExp(en, 'g'), ref.local[i]);
          text = text.replace(new RegExp(shorten(en), 'g'), shorten(ref.local[i]));
        });
        el.textContent = text;
      });
    };
    // À activer si besoin
    // convertToLocal('month', '.classname');
  };

  // 3. Accordéon FAQ
  const setupFAQToggle = () => {
    document.querySelectorAll(".faq_accordion_item").forEach(item => {
      const header = item.querySelector(".faq_accordion_header");
      const content = item.querySelector(".faq_accordion_content");
      const toggle = item.querySelector(".faq_accordion_toggle");
      if (header && content && toggle) {
        content.style.display = "none";
        header.addEventListener("click", () => {
          const open = content.style.display === "block";
          content.style.display = open ? "none" : "block";
          toggle.classList.toggle("active", !open);
        });
      }
    });
  };

  // 4. Virgules CMS
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

  // 5. Formulaire multi-étapes
  const setupMultiStepForm = () => {
    const formContainer = document.getElementById('customerForm');
    if (!formContainer) return;

    const form = formContainer.querySelector('form#wf-form-customerForm');
    const steps = document.querySelectorAll('.formstep');
    const prevBtn = document.querySelector('.is_prev');
    const nextBtn = document.querySelector('.is_next');
    const submitBtn = document.querySelector('.is_submit');
    const legalSection = document.querySelector('.islegals');
    const requiredMsg = document.querySelector('.requiredmessage');
    const stepIndicators = [
      document.querySelector('.is_step1'),
      document.querySelector('.is_step2'),
      document.querySelector('.is_step3')
    ];

    const personaMap = {
  1: 'BE',
  2: 'FE',
  3: 'GP',
  4: 'GP',
  5: 'TF',
  6: 'ME',
  7: 'BE',
  8: 'BE'
};

    const urlLocation = document.getElementById('urlLocation');
    if (urlLocation) urlLocation.value = window.location.href;

    let current = 0;
    const showStep = index => {
      steps.forEach((step, i) => step.style.display = i === index ? 'flex' : 'none');
      if (prevBtn) prevBtn.style.display = index === 0 ? 'none' : 'inline-block';
      if (nextBtn) nextBtn.style.display = index === steps.length - 1 ? 'none' : 'inline-block';
      if (submitBtn) submitBtn.style.display = index === steps.length - 1 ? 'inline-block' : 'none';
      if (legalSection) legalSection.style.display = index === steps.length - 1 ? 'block' : 'none';
      if (requiredMsg) requiredMsg.style.display = 'none';
      stepIndicators.forEach((el, i) => el && (el.style.color = i <= index ? 'var(--smooth_pink_24)' : ''));
      steps[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const validate = () => {
      const fields = steps[current].querySelectorAll('[required]');
      let valid = true;
      fields.forEach(field => {
        if (field.type === 'radio') {
          if (!document.querySelector(`input[name="${field.name}"]:checked`)) valid = false;
        } else if (field.tagName === 'SELECT' && field.value === 'Choisir une proposition') {
          valid = false;
        } else if (!field.value.trim()) {
          valid = false;
        }
      });
      if (!valid && requiredMsg) requiredMsg.style.display = 'block';
      return valid;
    };

    showStep(current);
    nextBtn && nextBtn.addEventListener('click', () => {
      if (validate() && current < steps.length - 1) {
        current++;
        showStep(current);
      }
    });
    prevBtn && prevBtn.addEventListener('click', () => {
      if (current > 0) {
        current--;
        showStep(current);
      }
    });

    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const  = document.querySelector('input[name="Select"]:checked')?.value;
        const budget = document.querySelector('input[name="annualBudget"]:checked')?.value;
        const email = document.getElementById('emailFunnelForm')?.value;
        const firstName = document.getElementById('firstname')?.value;
        const lastName = document.getElementById('lastname')?.value;
        const phone = document.getElementById('phoneFunnelForm')?.value;
        if ( && budget && email && firstName ) {
          const mapped = personaMap[persona] || persona;
          const redirect = `https://app.elsee.care/mon-offre?persona=${mapped}&price=${budget}&email=${encodeURIComponent(email)}&firstname=${encodeURIComponent(firstName)}&lastname=${encodeURIComponent(lastName)}`;
          fetch("https://hook.eu2.make.com/8vmewfvg17zyfnmm8xj8fvmfwu67g8rn", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({     persona: mapped,
 abonnement: budget, email, firstname: firstName, lastname: lastName, url: window.location.href, phone, destination: redirect })
          }).then(() => window.location.assign(redirect))
            .catch(() => window.location.assign(redirect));
        } else {
          console.error("Champs manquants dans le formulaire.");
        }
      });
    }
  };

  // === Initialisation ===
  document.addEventListener("DOMContentLoaded", function () {
    showPageUrl();
    localizeDates();
    setupFAQToggle();
    addCommasToCMSLists();
    setupMultiStepForm();
  });
})();
