// CUSTOMER PAGE SCRIPT

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

function trackingMarkup(request) {
  const point = request.tracking;
  if (!point || point.simulated !== true || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) {
    return '<p class="tracking-empty">Waiting for the pasabuyer to share GPS location.</p>';
  }

  const lat = Number(point.lat).toFixed(5);
  const lng = Number(point.lng).toFixed(5);
  const updated = new Date(point.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const mapId = 'gps-map-' + String(request.id).replace(/[^a-zA-Z0-9_-]/g, '');
  return '<div class="location-update"><span class="live-dot" aria-hidden="true"></span><span>Demo location updated at ' + escapeHtml(updated) + '</span></div><div class="gps-map" id="' + mapId + '" data-lat="' + lat + '" data-lng="' + lng + '" role="img" aria-label="OpenStreetMap showing a simulated demo route"></div>';
}

function chatMarkup(request) {
  const messages = DB.get('pb_messages', []).filter(function (message) {
    return message.requestId === request.id;
  });
  let html = '<section class="chat-box" aria-label="Chat with pasabuyer"><h4>Chat <span>' + messages.length + (messages.length === 1 ? ' message' : ' messages') + '</span></h4>';
  if (messages.length) {
    html += '<div class="message-list">';
    messages.forEach(function (message) {
      const time = new Date(message.sentAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      html += '<div class="message ' + (message.from === me.u ? 'mine' : '') + '"><div><b>' + escapeHtml(message.from) + '</b><time>' + escapeHtml(time) + '</time></div><p>' + escapeHtml(message.text) + '</p></div>';
    });
    html += '</div>';
  } else {
    html += '<p class="chat-empty">No messages yet. Send your pasabuyer a note.</p>';
  }
  html += '<form class="chat-form" onsubmit="sendMessage(event, ' + request.id + ')"><label class="visually-hidden" for="message-' + request.id + '">Write a message</label><input id="message-' + request.id + '" name="message" maxlength="500" placeholder="Write a message..." required><button class="btn small" type="submit" aria-label="Send message">Send</button></form></section>';
  return html;
}

function feedbackMarkup(request) {
  if (request.feedback) {
    const rating = Math.max(1, Math.min(5, Number(request.feedback.rating) || 1));
    return '<section class="feedback-result"><h4>Your feedback <span class="rating-stars" aria-label="' + rating + ' out of 5 stars">' + '&#9733;'.repeat(rating) + '</span></h4><p>' + escapeHtml(request.feedback.comment || 'Thanks for sharing your experience.') + '</p></section>';
  }

  return '<form class="feedback-form" onsubmit="submitFeedback(event, ' + request.id + ')"><h4>How was your pasabuy?</h4><label for="rating-' + request.id + '">Rate this delivery</label><div class="feedback-controls"><select id="rating-' + request.id + '" name="rating" required><option value="">Choose a rating</option><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Okay</option><option value="2">2 - Poor</option><option value="1">1 - Bad</option></select><label class="visually-hidden" for="comment-' + request.id + '">Feedback comment</label><input id="comment-' + request.id + '" name="comment" maxlength="280" placeholder="Add a comment (optional)"><button class="btn small" type="submit">Send feedback</button></div></form>';
}

function requestCard(request) {
  let html = '<article class="card req"><div class="req-topline"><span class="badge ' + escapeHtml(request.status) + '">' + escapeHtml(statusLabel(request.status)) + '</span><span class="request-id">REQUEST #' + escapeHtml(String(request.id).slice(-6)) + '</span></div>';
  html += '<h3>' + escapeHtml(request.item) + '</h3>';
  html += '<div class="request-details"><p><span>Pickup</span>' + escapeHtml(request.store) + '</p><p><span>Deliver to</span>' + escapeHtml(request.addr) + '</p><p><span>Budget</span>&#8369;' + escapeHtml(request.budget) + '</p><p><span>Pasabuyer</span>' + escapeHtml(request.by || 'Finding a pasabuyer') + '</p></div>';
  if (request.notes) html += '<p class="request-note">' + escapeHtml(request.notes) + '</p>';
  if (request.status === 'open') html += '<button class="btn small ghost" type="button" onclick="cancelRequest(' + request.id + ')">Cancel request</button>';
  if (request.status === 'on-the-way') html += '<section class="tracking-details"><h4>Pasabuyer location</h4>' + trackingMarkup(request) + '</section>';
  if (request.status !== 'open' && request.status !== 'delivered') html += chatMarkup(request);
  if (request.status === 'delivered') html += feedbackMarkup(request);
  html += '</article>';
  return html;
}

const me = guard('customer');
const topBar = document.querySelector('.top');
function updateTopBar() {
  topBar.classList.toggle('is-scrolled', window.scrollY > 8);
}
window.addEventListener('scroll', updateTopBar, { passive: true });
updateTopBar();
let activeFilter = 'all';
$('who').textContent = 'Hi, ' + me.u;
$('logout').onclick = logout;

$('reqForm').onsubmit = function (event) {
  event.preventDefault();
  const requests = DB.get('pb_requests', []);
  requests.unshift({
    id: Date.now(),
    customer: me.u,
    item: $('item').value.trim(),
    store: $('store').value.trim(),
    budget: Number($('budget').value),
    addr: $('addr').value.trim(),
    notes: $('notes').value.trim(),
    status: 'open',
    by: null,
    tracking: null,
    feedback: null,
    createdAt: Date.now()
  });
  DB.set('pb_requests', requests);
  event.target.reset();
  render();
};

function cancelRequest(id) {
  const requests = DB.get('pb_requests', []).filter(function (request) {
    return request.id !== id || request.status !== 'open' || request.customer !== me.u;
  });
  DB.set('pb_requests', requests);
  render();
}

function sendMessage(event, requestId) {
  event.preventDefault();
  const request = DB.get('pb_requests', []).find(function (item) {
    return item.id === requestId && item.customer === me.u && item.status !== 'open' && item.status !== 'delivered';
  });
  const text = event.currentTarget.elements.message.value.trim();
  if (!request || !text) return;

  const messages = DB.get('pb_messages', []);
  messages.push({ requestId: requestId, from: me.u, role: 'customer', text: text, sentAt: Date.now() });
  DB.set('pb_messages', messages);
  render();
}

function submitFeedback(event, requestId) {
  event.preventDefault();
  const requests = DB.get('pb_requests', []);
  const request = requests.find(function (item) {
    return item.id === requestId && item.customer === me.u && item.status === 'delivered' && !item.feedback;
  });
  if (!request) return;

  const form = event.currentTarget;
  request.feedback = {
    rating: Number(form.elements.rating.value),
    comment: form.elements.comment.value.trim(),
    submittedAt: Date.now()
  };
  DB.set('pb_requests', requests);
  render();
}

function render(preserveInput) {
  const activeInput = preserveInput && $('list').contains(document.activeElement) ? document.activeElement : null;
  const activeId = activeInput && activeInput.id;
  const activeValue = activeInput && activeInput.value;
  const selectionStart = activeInput && activeInput.selectionStart;
  const selectionEnd = activeInput && activeInput.selectionEnd;
  const mine = DB.get('pb_requests', []).filter(function (request) {
    return request.customer === me.u;
  });
  const openCount = mine.filter(function (request) { return request.status === 'open'; }).length;
  const activeCount = mine.filter(function (request) { return isActiveStatus(request.status); }).length;
  const deliveredCount = mine.filter(function (request) { return request.status === 'delivered'; }).length;
  $('countOpen').textContent = openCount;
  $('countActive').textContent = activeCount;
  $('countDone').textContent = deliveredCount;

  const shown = activeFilter === 'all' ? mine : mine.filter(function (request) {
    return activeFilter === 'accepted' ? isActiveStatus(request.status) : request.status === activeFilter;
  });
  $('boardCount').textContent = shown.length + (shown.length === 1 ? ' request' : ' requests');
  if (!shown.length) {
    const message = mine.length ? 'No requests in this view.' : 'No requests yet. Post your first one to get started.';
    $('list').innerHTML = '<div class="empty-state"><span aria-hidden="true">&#9711;</span><p>' + message + '</p></div>';
    renderGpsTrackers($('list'));
    restoreBoardInput(activeId, activeValue, selectionStart, selectionEnd);
    return;
  }
  $('list').innerHTML = shown.map(requestCard).join('');
  renderGpsTrackers($('list'));
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
  if (!event.key || event.key === 'pb_requests' || event.key === 'pb_messages') render(true);
});
render();
