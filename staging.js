(function () const setupMultiStepForm = () => {
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
    'J’ai un trouble hormonal (endométriose, SOPK, SPM ... )': 'TF',
    'J\'ai plus de 45 ans et mon corps change': 'ME',
    'J\'ai des problèmes de digestion': 'BE',
    'J\'ai des problèmes de sommeil / stress': 'BE'
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

      const persona = document.querySelector('input[name="personaSelect"]:checked')?.value;
      const budget = document.querySelector('input[name="annualBudget"]:checked')?.value;
      const email = document.getElementById('emailFunnelForm')?.value;
      const firstName = document.getElementById('firstname')?.value;
      const lastName = document.getElementById('lastname')?.value;
      const phone = document.getElementById('phoneFunnelForm')?.value;

      if (persona && budget && email && firstName && lastName) {
        const mapped = personaMap[persona] || persona;
        const redirect = `https://app.elsee.care/mon-offre?persona=${mapped}&price=${budget}&email=${encodeURIComponent(email)}&firstname=${encodeURIComponent(firstName)}&lastname=${encodeURIComponent(lastName)}`;

        // Préchargement de l’URL
        const prefetchLink = document.createElement('link');
        prefetchLink.rel = 'prefetch';
        prefetchLink.href = redirect;
        document.head.appendChild(prefetchLink);

        // Affichage immédiat de form-info
        const infoElement = document.getElementById('form-info');
        if (infoElement) infoElement.style.display = 'block';

        // Affichage de from-form-to-funnel après 30 secondes
        setTimeout(() => {
          const funnelBtn = document.getElementById('from-form-to-funnel');
          if (funnelBtn) {
            funnelBtn.style.display = 'block';
            funnelBtn.addEventListener('click', () => {
              window.location.assign(redirect);
            }, { once: true }); // Pour éviter plusieurs redirections
          }
        }, 30000);

        // Envoi des données à Make
        fetch("https://hook.eu2.make.com/8vmewfvg17zyfnmm8xj8fvmfwu67g8rn", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            persona,
            abonnement: budget,
            email,
            firstname: firstName,
            lastname: lastName,
            url: window.location.href,
            phone,
            destination: redirect
          })
        }).catch(err => {
          console.error("Erreur d'envoi vers Make :", err);
        });

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
)();

