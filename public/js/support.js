(function () {
  const form = document.querySelector('.contact-form');
  const searchInput = document.getElementById('searchFaq');

  if (!form) {
    return;
  }

  const status = document.createElement('p');
  status.className = 'small muted';
  status.setAttribute('aria-live', 'polite');
  form.appendChild(status);

  async function getGeoPosition() {
    if (!('geolocation' in navigator)) {
      return { available: false, reason: 'geolocation_not_supported' };
    }

    return new Promise(function (resolve) {
      navigator.geolocation.getCurrentPosition(
        function (position) {
          resolve({
            available: true,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        function (error) {
          resolve({
            available: false,
            reason: error.message || 'permission_denied',
          });
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Request failed');
    }

    return response.json();
  }

  if (searchInput) {
    let timeoutId;
    searchInput.addEventListener('input', function (event) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(function () {
        const term = event.target.value.trim();
        if (!term) {
          return;
        }

        postJson('/api/events/faq-search', {
          page: window.location.pathname,
          eventType: 'faq_search',
          term: term,
          timestamp: new Date().toISOString(),
        }).catch(function () {
          // Silent fail for UX.
        });
      }, 500);
    });
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const consent = document.getElementById('securityConsent');
    if (!consent || !consent.checked) {
      status.textContent = 'Veuillez accepter le consentement sécurité pour continuer.';
      return;
    }

    status.textContent = 'Envoi sécurisé en cours...';

    const payload = {
      page: window.location.pathname,
      eventType: 'support_request',
      timestamp: new Date().toISOString(),
      reference: document.getElementById('reference')?.value?.trim() || '',
      email: document.getElementById('email')?.value?.trim() || '',
      subject: document.getElementById('subject')?.value || '',
      message: document.getElementById('message')?.value?.trim() || '',
      faqSearchTerm: searchInput ? searchInput.value.trim() : '',
      consentGranted: true,
      geolocation: await getGeoPosition(),
    };

    try {
      await postJson('/api/support-request', payload);
      status.textContent = 'Votre demande a été envoyée avec succès.';
      form.reset();
    } catch (error) {
      status.textContent = 'Impossible d’envoyer la demande pour le moment.';
    }
  });
})();
