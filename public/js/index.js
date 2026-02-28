(function () {
  const pageViewPayload = {
    page: window.location.pathname,
    eventType: 'page_view',
    timestamp: new Date().toISOString(),
  };

  fetch('/api/events/page-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pageViewPayload),
  }).catch(function () {
    // Silent fail for UX.
  });
})();
