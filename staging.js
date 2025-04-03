(function () {
  // Définition des fonctions potentiellement manquantes pour éviter les erreurs
  const showPageUrl = window.showPageUrl || function() {};
  const localizeDates = window.localizeDates || function() {};
  const setupFAQToggle = window.setupFAQToggle || function() {};
  const addCommasToCMSLists = window.addCommasToCMSLists || function() {};

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
      'Je veux prendre soin de moi': 'BE',
      'Je cherche à tomber enceinte': 'FE',
      'Je suis enceinte': 'GP',
      'Je viens d\'accoucher': 'GP',
      'J'ai un trouble hormonal (endométriose, SOPK, SPM ... )': 'TF',
      'J\'ai plus de 45 ans et mon corps change': 'ME',
      'J\'ai des problèmes de digestion': 'BE',
      'J\'ai des problèmes de sommeil / stress': 'BE'
    };

    // Enregistrement de l'URL actuelle
    const urlLocation = document.getElementById('urlLocation');
    if (urlLocation) urlLocation.value = window.location.href;

    let current = 0;
    let isSubmitting = false;

    const showStep = index => {
      // Assurer que l'index est valide
      if (index < 0 || index >= steps.length) return;
      
      steps.forEach((step, i) => step.style.display = i === index ? 'flex' : 'none');
      
      if (prevBtn) prevBtn.style.display = index === 0 ? 'none' : 'inline-block';
      if (nextBtn) nextBtn.style.display = index === steps.length - 1 ? 'none' : 'inline-block';
      if (submitBtn) submitBtn.style.display = index === steps.length - 1 ? 'inline-block' : 'none';
      if (legalSection) legalSection.style.display = index === steps.length - 1 ? 'block' : 'none';
      if (requiredMsg) requiredMsg.style.display = 'none';
      
      stepIndicators.forEach((el, i) => {
        if (el) el.style.color = i <= index ? 'var(--smooth_pink_24)' : '';
      });
      
      // Scroll plus sécurisé avec try/catch
      try {
        steps[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        console.warn("Problème de défilement:", e);
      }
    };

    const highlightInvalidFields = (fields) => {
      fields.forEach(field => {
        let isValid = true;
        
        if (field.type === 'radio') {
          isValid = document.querySelector(`input[name="${field.name}"]:checked`);
        } else if (field.tagName === 'SELECT') {
          isValid = field.value !== 'Choisir une proposition';
        } else {
          isValid = field.value.trim() !== '';
        }
        
        // Ajouter/supprimer une classe pour les champs invalides
        if (!isValid) {
          field.classList.add('field-error');
          // Ajouter un écouteur pour retirer la classe lorsque l'utilisateur modifie le champ
          const removeError = () => {
            field.classList.remove('field-error');
            field.removeEventListener('input', removeError);
            field.removeEventListener('change', removeError);
          };
          field.addEventListener('input', removeError);
          field.addEventListener('change', removeError);
        } else {
          field.classList.remove('field-error');
        }
      });
    };

    const validate = () => {
      const fields = Array.from(steps[current].querySelectorAll('[required]'));
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
      
      if (!valid && requiredMsg) {
        requiredMsg.style.display = 'block';
        highlightInvalidFields(fields);
      }
      
      return valid;
    };

    // Validation basique d'email
    const validateEmail = (email) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // Initialisation: afficher la première étape
    showStep(current);

    // Gestion du bouton Suivant
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (validate() && current < steps.length - 1) {
          current++;
          showStep(current);
        }
      });
    }

    // Gestion du bouton Précédent
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (current > 0) {
          current--;
          showStep(current);
        }
      });
    }

    // Gestion de la soumission du formulaire
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        
        // Éviter les soumissions multiples
        if (isSubmitting) return;
        isSubmitting = true;
        
        if (submitBtn) submitBtn.disabled = true;

        const persona = document.querySelector('input[name="personaSelect"]:checked')?.value;
        const budget = document.querySelector('input[name="annualBudget"]:checked')?.value;
        const email = document.getElementById('emailFunnelForm')?.value;
        const firstName = document.getElementById('firstname')?.value;
        const lastName = document.getElementById('lastname')?.value;
        const phone = document.getElementById('phoneFunnelForm')?.value;

        // Validation supplémentaire
        if (!persona || !budget || !email || !firstName || !lastName) {
          console.error("Champs manquants dans le formulaire.");
          if (submitBtn) submitBtn.disabled = false;
          isSubmitting = false;
          return;
        }

        if (!validateEmail(email)) {
          alert("Veuillez entrer une adresse email valide.");
          if (submitBtn) submitBtn.disabled = false;
          isSubmitting = false;
          return;
        }

        const mapped = personaMap[persona] || persona;
        const redirect = `https://app.elsee.care/mon-offre?persona=${mapped}&price=${budget}&email=${encodeURIComponent(email)}&firstname=${encodeURIComponent(firstName)}&lastname=${encodeURIComponent(lastName)}`;

        // Préchargement de l'URL
        try {
          const prefetchLink = document.createElement('link');
          prefetchLink.rel = 'prefetch';
          prefetchLink.href = redirect;
          document.head.appendChild(prefetchLink);
        } catch (err) {
          console.warn("Erreur de préchargement:", err);
          // Ne pas bloquer le processus si le préchargement échoue
        }

        // Affichage immédiat de form-info
        const infoElement = document.getElementById('form-info');
        if (infoElement) infoElement.style.display = 'block';

        // Affichage de from-form-to-funnel après 30 secondes
        const funnelTimeout = setTimeout(() => {
          const funnelBtn = document.getElementById('from-form-to-funnel');
          if (funnelBtn) {
            funnelBtn.style.display = 'block';
            funnelBtn.addEventListener('click', () => {
              window.location.assign(redirect);
            }, { once: true });
          }
        }, 30000);

        // URL du webhook Make stockée dans une constante
        const makeWebhookUrl = "https://hook.eu2.make.com/8vmewfvg17zyfnmm8xj8fvmfwu67g8rn";

        // Envoi à Make
        fetch(makeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            persona,
            abonnement: budget,
            email,
            firstname: firstName,
            lastname: lastName,
            url: window.location.href,
            phone: phone || "",
            destination: redirect
          })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Erreur réseau: ${response.status}`);
          }
          return response;
        })
        .catch(err => {
          console.error("Erreur d'envoi vers Make:", err);
          // On peut gérer l'erreur ici (afficher un message, réessayer, etc.)
        })
        .finally(() => {
          // Réactiver le bouton de soumission après la réponse
          if (submitBtn) submitBtn.disabled = false;
          isSubmitting = false;
        });
      });
    }
  };

  // === Initialisation globale ===
  document.addEventListener("DOMContentLoaded", function () {
    // Utilisation des fonctions définies au début
    showPageUrl();
    localizeDates();
    setupFAQToggle();
    addCommasToCMSLists();
    setupMultiStepForm();
  });
})();
