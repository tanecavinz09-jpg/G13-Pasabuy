// LOGIN PAGE SCRIPT

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

let isSignup = false; // false = Log In mode, true = Sign Up mode

// Demo accounts (only created the first time)
if (!localStorage.getItem('pb_users')) {
  DB.set('pb_users', [
    { u: 'customer', email: 'customer@example.com', p: '1234', role: 'customer' },
    { u: 'pasabuyer', email: 'pasabuyer@example.com', p: '1234', role: 'pasabuyer' }
  ]);
}

const users = DB.get('pb_users', []);
users.forEach(function (user) {
  if (!user.email && user.u === 'customer') user.email = 'customer@example.com';
  if (!user.email && user.u === 'pasabuyer') user.email = 'pasabuyer@example.com';
});
DB.set('pb_users', users);

// Fill in the username if "Remember Me" was used before
const rememberedUser = localStorage.getItem('pb_remember');
if (rememberedUser) {
  const rememberedAccount = users.find(function (user) {
    return user.u.toLowerCase() === rememberedUser.toLowerCase() || (user.email && user.email.toLowerCase() === rememberedUser.toLowerCase());
  });
  $('username').value = rememberedAccount && rememberedAccount.email ? rememberedAccount.email : rememberedUser;
  $('remember').checked = true;
}

// Show a message under the form (green if success is true)
function showMessage(text, success) {
  $('msg').textContent = text;
  $('msg').className = success ? 'msg ok' : 'msg';
}

// Switch the form between Log In and Sign Up
function setMode(signup) {
  isSignup = signup;
  $('formTitle').textContent = signup ? 'Create your account' : 'Welcome back';
  $('formIntro').textContent = signup ? 'Join the community and start finding great picks.' : 'Sign in to continue to Online Pasabuy.';
  $('submitText').textContent = signup ? 'Create account' : 'Log in';
  $('roleRow').hidden = !signup;
  $('emailRow').hidden = !signup;
  $('email').required = signup;
  $('usernameLabel').textContent = signup ? 'Username' : 'Email address';
  $('username').type = signup ? 'text' : 'email';
  $('username').name = signup ? 'username' : 'email';
  $('username').autocomplete = signup ? 'username' : 'email';
  $('username').placeholder = signup ? 'Choose a username' : 'you@example.com';
  if (!signup) $('email').value = '';
  $('switchText').textContent = signup ? 'Already a member?' : 'New to Online Pasabuy?';
  $('switchLink').textContent = signup ? 'Log in' : 'Create an account';
  $('password').autocomplete = signup ? 'new-password' : 'current-password';
  $('togglePw').textContent = 'Show';
  $('togglePw').setAttribute('aria-label', 'Show password');
  $('togglePw').title = 'Show password';
  $('password').type = 'password';
  showMessage('');
}

// Show / hide password
$('togglePw').onclick = function () {
  const box = $('password');
  const showPassword = box.type === 'password';
  box.type = showPassword ? 'text' : 'password';
  this.textContent = showPassword ? 'Hide' : 'Show';
  this.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
  this.title = showPassword ? 'Hide password' : 'Show password';
};

$('switchLink').onclick = function (event) {
  event.preventDefault();
  setMode(!isSignup);
};

// Create a new account
function signUp(username, email, password, users) {
  if (password.length < 4) {
    return showMessage('Password needs at least 4 characters.');
  }

  const taken = users.some(function (user) {
    return user.u.toLowerCase() === username.toLowerCase();
  });
  if (taken) {
    return showMessage('That username is taken. Try another.');
  }

  const emailTaken = users.some(function (user) {
    return user.email && user.email.toLowerCase() === email.toLowerCase();
  });
  if (emailTaken) {
    return showMessage('That email is already registered. Try logging in instead.');
  }

  users.push({ u: username, email: email.toLowerCase(), p: password, role: $('role').value });
  DB.set('pb_users', users);
  $('username').value = username;
  $('password').value = '';
  setMode(false);
  showMessage('Account created. Log in below.', true);
}

// Check the email and password, then open the right page
function logIn(email, password, users) {
  const user = users.find(function (account) {
    return account.email && account.email.toLowerCase() === email.toLowerCase() && account.p === password;
  });

  if (!user) {
    return showMessage('Wrong username or password.');
  }

  if ($('remember').checked) {
    localStorage.setItem('pb_remember', email);
  } else {
    localStorage.removeItem('pb_remember');
  }

  DB.set('pb_session', { u: user.u, role: user.role });
  location.href = user.role === 'customer' ? 'customer.html' : 'pasabuyer.html';
}

// Form submit
$('authForm').onsubmit = function (event) {
  event.preventDefault();

  const username = $('username').value.trim();
  const email = $('email').value.trim();
  const password = $('password').value;
  const users = DB.get('pb_users', []);

  if (isSignup) {
    signUp(username, email, password, users);
  } else {
    logIn(username, password, users);
  }
};
