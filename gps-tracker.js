(function () {
  const maps = new Map();
  const savedRequests = localStorage.getItem('pb_requests');
  if (savedRequests) {
    const requests = JSON.parse(savedRequests);
    let clearedLocation = false;
    requests.forEach(function (request) {
      if (request.tracking && request.tracking.simulated !== true) {
        request.tracking = null;
        clearedLocation = true;
      }
    });
    if (clearedLocation) localStorage.setItem('pb_requests', JSON.stringify(requests));
  }

  window.renderGpsTrackers = function (root) {
    const visibleMaps = new Set();
    const containers = root.querySelectorAll('.gps-map[data-lat][data-lng]');
    containers.forEach(function (container) {
      const lat = Number(container.dataset.lat);
      const lng = Number(container.dataset.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      if (!window.L) {
        container.textContent = 'Map unavailable. Simulated coordinates: ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
        return;
      }

      const existing = maps.get(container.id);
      if (existing) {
        container.replaceWith(existing.container);
        existing.container.dataset.lat = lat;
        existing.container.dataset.lng = lng;
        existing.marker.setLatLng([lat, lng]);
        existing.map.setView([lat, lng], existing.map.getZoom(), { animate: false });
        requestAnimationFrame(function () {
          existing.map.invalidateSize();
        });
        visibleMaps.add(container.id);
        return;
      }

      const map = L.map(container, { scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19
      }).addTo(map);
      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        color: '#fff',
        weight: 3,
        fillColor: '#713a9b',
        fillOpacity: 1
      }).addTo(map).bindPopup('Simulated demo location');
      maps.set(container.id, { container: container, map: map, marker: marker });
      visibleMaps.add(container.id);
    });

    maps.forEach(function (entry, id) {
      if (!visibleMaps.has(id)) {
        entry.map.remove();
        maps.delete(id);
      }
    });
  };
})();