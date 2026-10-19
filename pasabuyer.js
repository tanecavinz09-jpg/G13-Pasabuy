// PASABUYER PAGE SCRIPT

const DB = {
  get(key, fallback) {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

function $(id) {
  return document.getElementById(id);
}

function guard(role) {
  const session = DB.get('pb_session', null);
  if (!session || session.role !== role) {
    location.href = 'login.html';
  }
  return session;
}

function logout() {
  stopTracking('Location sharing stopped when you logged out.');
  localStorage.removeItem('pb_session');
  location.href = 'login.html';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text == null ? '' : text);
  return div.innerHTML;
}

function statusLabel(status) {
  const labels = {
    accepted: 'In progress',
    ready: 'Ready for delivery',
    'on-the-way': 'On the way'
  };
  return labels[status] || status;
}

function isActiveStatus(status) {
  return status === 'accepted' || status === 'ready' || status === 'on-the-way';
}

const DEMO_ROUTE = [
  { lat: 14.5995, lng: 120.9842 },
  { lat: 14.6001, lng: 120.9848 },
  { lat: 14.6007, lng: 120.9854 },
  { lat: 14.6012, lng: 120.9848 }
];

function locationMarkup(request) {
  const point = request.tracking;
  let html;
  if (!point || point.simulated !== true || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) {
    html = '<p class="tracking-empty">Waiting for GPS location.</p>';
  } else {
    const lat = Number(point.lat).toFixed(5);
    const lng = Number(point.lng).toFixed(5);
    const updated = new Date(point.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const mapId = 'gps-map-' + String(request.id).replace(/[^a-zA-Z0-9_-]/g, '');
    html = '<div class="location-update"><span class="live-dot" aria-hidden="true"></span><span>Demo location updated at ' + escapeHtml(updated) + '</span></div><div class="gps-map" id="' + mapId + '" data-lat="' + lat + '" data-lng="' + lng + '" role="img" aria-label="OpenStreetMap showing a simulated demo route"></div>';
  }
  const sharing = demoTimer !== null;
  html += '<div class="tracking-controls"><button class="btn small ghost" type="button" onclick="toggleTracking()" aria-pressed="' + sharing + '">' + (sharing ? 'Stop demo tracker' : 'Start demo tracker') + '</button>';
  if (trackingMessage) html += '<p class="tracking-empty" role="status">' + escapeHtml(trackingMessage) + '</p>';
  html += '</div>';
  return html;
}

function chatMarkup(request) {
  const messages = DB.get('pb_messages', []).filter(function (message) {
    return message.requestId === request.id;
  });
  let html = '<section class="chat-box" aria-label="Chat with customer"><h4>Chat <span>' + messages.length + (messages.length === 1 ? ' message' : ' messages') + '</span></h4>';
  if (messages.length) {
    html += '<div class="message-list">';
    messages.forEach(function (message) {
      const time = new Date(message.sentAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      html += '<div class="message ' + (message.from === me.u ? 'mine' : '') + '"><div><b>' + escapeHtml(message.from) + '</b><time>' + escapeHtml(time) + '</time></div><p>' + escapeHtml(message.text) + '</p></div>';
    });
    html += '</div>';
  } else {
    html += '<p class="chat-empty">No messages yet. Send the customer an update.</p>';
  }
  html += '<form class="chat-form" onsubmit="sendMessage(event, ' + request.id + ')"><label class="visually-hidden" for="message-' + request.id + '">Write a message</label><input id="message-' + request.id + '" name="message" maxlength="500" placeholder="Write a message..." required><button class="btn small" type="submit" aria-label="Send message">Send</button></form></section>';
  return html;
}

function feedbackMarkup(request) {
  if (!request.feedback) return '<p class="feedback-pending">Customer feedback is pending.</p>';
  const rating = Math.max(1, Math.min(5, Number(request.feedback.rating) || 1));
  return '<section class="feedback-result"><h4>Customer feedback <span class="rating-stars" aria-label="' + rating + ' out of 5 stars">' + '&#9733;'.repeat(rating) + '</span></h4><p>' + escapeHtml(request.feedback.comment || 'No comment left.') + '</p></section>';
}

function requestCard(request) {
  let html = '<article class="card req"><div class="req-topline"><span class="badge ' + escapeHtml(request.status) + '">' + escapeHtml(statusLabel(request.status)) + '</span><span class="request-id">REQUEST #' + escapeHtml(String(request.id).slice(-6)) + '</span></div>';
  html += '<h3>' + escapeHtml(request.item) + '</h3>';
  html += '<div class="request-details"><p><span>Pickup</span>' + escapeHtml(request.store) + '</p><p><span>Deliver to</span>' + escapeHtml(request.addr) + '</p><p><span>Budget</span>&#8369;' + escapeHtml(request.budget) + '</p><p><span>Customer</span>' + escapeHtml(request.customer) + '</p></div>';
  if (request.notes) html += '<p class="request-note">' + escapeHtml(request.notes) + '</p>';
  if (request.status === 'open') html += '<button class="btn small accept-button" type="button" onclick="acceptRequest(' + request.id + ')">Accept request <span aria-hidden="true">&#8594;</span></button>';
  if (request.by === me.u && request.status !== 'open') {
    if (request.status === 'on-the-way') html += '<section class="tracking-details"><h4>GPS sharing</h4>' + locationMarkup(request) + '</section>';
    if (request.status !== 'delivered') html += chatMarkup(request);
  }
  if (request.by === me.u && request.status === 'accepted') html += '<button class="btn small complete-button" type="button" onclick="markReadyForDelivery(' + request.id + ')">Mark ready for delivery</button>';
  if (request.by === me.u && request.status === 'ready') html += '<button class="btn small complete-button" type="button" onclick="markOnTheWay(' + request.id + ')">Mark on the way</button>';
  if (request.by === me.u && request.status === 'on-the-way') html += '<button class="btn small complete-button" type="button" onclick="markDelivered(' + request.id + ')">Mark delivered</button>';
  if (request.status === 'delivered' && request.by === me.u) html += feedbackMarkup(request);
  html += '</article>';
  return html;
}

const me = guard('pasabuyer');
const topBar = document.querySelector('.top');
function updateTopBar() {
  topBar.classList.toggle('is-scrolled', window.scrollY > 8);
}
window.addEventListener('scroll', updateTopBar, { passive: true });
updateTopBar();
let activeFilter = 'open';
let demoTimer = null;
let demoRouteIndex = 0;
let trackingMessage = '';
$('who').textContent = 'Hi, ' + me.u;
$('logout').onclick = logout;

function toggleTracking() {
  if (demoTimer !== null) stopTracking('Demo tracker stopped.');
  else startTracking();
}

function updateRequest(id, change) {
  const requests = DB.get('pb_requests', []);
  const request = requests.find(function (item) {
    return item.id === id;
  });
  if (request) change(request);
  DB.set('pb_requests', requests);
  render();
}

function acceptRequest(id) {
  updateRequest(id, function (request) {
    if (request.status !== 'open') return;
    request.status = 'accepted';
    request.by = me.u;
  });
}

function markReadyForDelivery(id) {
  updateRequest(id, function (request) {
    if (request.by === me.u && request.status === 'accepted') request.status = 'ready';
  });
}

function markOnTheWay(id) {
  updateRequest(id, function (request) {
    if (request.by === me.u && request.status === 'ready') request.status = 'on-the-way';
  });
}

function markDelivered(id) {
  updateRequest(id, function (request) {
    if (request.by === me.u && request.status === 'on-the-way') {
      request.status = 'delivered';
      request.tracking = null;
    }
  });
  stopTrackingIfNoOnTheWayJobs();
}

function sendMessage(event, requestId) {
  event.preventDefault();
  const request = DB.get('pb_requests', []).find(function (item) {
    return item.id === requestId && item.by === me.u && item.status !== 'open' && item.status !== 'delivered';
  });
  const text = event.currentTarget.elements.message.value.trim();
  if (!request || !text) return;

  const messages = DB.get('pb_messages', []);
  messages.push({ requestId: requestId, from: me.u, role: 'pasabuyer', text: text, sentAt: Date.now() });
  DB.set('pb_messages', messages);
  render();
}

function hasOnTheWayJobs() {
  return DB.get('pb_requests', []).some(function (request) {
    return request.by === me.u && request.status === 'on-the-way';
  });
}

function stopTrackingIfNoOnTheWayJobs() {
  if (demoTimer !== null && !hasOnTheWayJobs()) stopTracking('Demo tracker stopped because no delivery is on the way.');
}

function updateDemoLocation() {
  if (!hasOnTheWayJobs()) {
    stopTrackingIfNoOnTheWayJobs();
    return;
  }

  const point = DEMO_ROUTE[demoRouteIndex];
  demoRouteIndex = (demoRouteIndex + 1) % DEMO_ROUTE.length;
  const requests = DB.get('pb_requests', []);
  requests.forEach(function (request) {
    if (request.by === me.u && request.status === 'on-the-way') {
      request.tracking = { lat: point.lat, lng: point.lng, updatedAt: Date.now(), simulated: true };
    }
  });
  DB.set('pb_requests', requests);
  trackingMessage = 'Simulated demo route. No device location is used.';
  render(true);
}

function startTracking() {
  if (!hasOnTheWayJobs()) {
    trackingMessage = 'The demo tracker is available only when a delivery is on the way.';
    render();
    return;
  }
  if (demoTimer !== null) return;

  demoRouteIndex = 0;
  trackingMessage = 'Simulated demo route. No device location is used.';
  demoTimer = window.setInterval(updateDemoLocation, 3000);
  updateDemoLocation();
}

function stopTracking(message) {
  if (demoTimer !== null) window.clearInterval(demoTimer);
  demoTimer = null;
  trackingMessage = message || '';
  const requests = DB.get('pb_requests', []);
  let changed = false;
  requests.forEach(function (request) {
    if (request.by === me.u && request.status === 'on-the-way' && request.tracking) {
      request.tracking = null;
      changed = true;
    }
  });
  if (changed) DB.set('pb_requests', requests);
  render();
}

function render(preserveInput) {
  const activeInput = preserveInput && $('board').contains(document.activeElement) ? document.activeElement : null;
  const activeId = activeInput && activeInput.id;
  const activeValue = activeInput && activeInput.value;
  const selectionStart = activeInput && activeInput.selectionStart;
  const selectionEnd = activeInput && activeInput.selectionEnd;
  const all = DB.get('pb_requests', []);
  const open = all.filter(function (request) { return request.status === 'open'; });
  const mine = all.filter(function (request) { return request.by === me.u; });
  const active = mine.filter(function (request) { return isActiveStatus(request.status); });
  const delivered = mine.filter(function (request) { return request.status === 'delivered'; });
  $('countOpen').textContent = open.length;
  $('countActive').textContent = active.length;
  $('done').textContent = delivered.length;

  const shown = activeFilter === 'open' ? open : activeFilter === 'accepted' ? active : delivered;
  $('boardCount').textContent = shown.length + (shown.length === 1 ? ' request' : ' requests');
  if (!shown.length) {
    const messages = {
      open: 'No open requests right now. New customer requests will appear here.',
      accepted: 'You have no active jobs. Accept an available request to get started.',
      delivered: 'Completed requests will appear here.'
    };
    $('board').innerHTML = '<div class="empty-state"><span aria-hidden="true">&#9711;</span><p>' + messages[activeFilter] + '</p></div>';
    renderGpsTrackers($('board'));
    restoreBoardInput(activeId, activeValue, selectionStart, selectionEnd);
    return;
  }
  $('board').innerHTML = shown.map(requestCard).join('');
  renderGpsTrackers($('board'));
  restoreBoardInput(activeId, activeValue, selectionStart, selectionEnd);
}

function restoreBoardInput(id, value, selectionStart, selectionEnd) {
  if (!id) return;
  const input = $(id);
  if (!input) return;
  input.value = value;
  input.focus({ preventScroll: true });
  if (typeof selectionStart === 'number' && typeof input.setSelectionRange === 'function') {
    input.setSelectionRange(selectionStart, selectionEnd);
  }
}

document.querySelectorAll('[data-filter]').forEach(function (button) {
  button.addEventListener('click', function () {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(function (tab) {
      const selected = tab === button;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-pressed', selected);
    });
    render();
  });
});

window.addEventListener('storage', function (event) {
  if (!event.key || event.key === 'pb_requests' || event.key === 'pb_messages') {
    stopTrackingIfNoOnTheWayJobs();
    render(true);
  }
});
render();
