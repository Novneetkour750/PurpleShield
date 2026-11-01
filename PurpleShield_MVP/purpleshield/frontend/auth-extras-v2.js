/* PurpleShield login extras (v2). UI only: makes NO API calls.
   Adds: show/hide password, "Create account" view with live password-strength meter.
   Forgot-password has been removed. The backend has no register endpoint, so
   submitting the form shows an honest "not available" message. */
(function () {
  'use strict';

  // Password policy shown to the user. Change this number if you want.
  const MIN_LENGTH = 8;

  function init() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) { console.warn('[auth-extras] #login-form not found'); return; }
    const side = loginForm.parentElement;

    function addToggle(input) {
      if (!input || input.parentNode.classList.contains('pw-wrap')) return;
      const wrap = document.createElement('span');
      wrap.className = 'pw-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pw-toggle';
      btn.textContent = 'Show';
      btn.setAttribute('aria-label', 'Show password');
      btn.addEventListener('click', function () {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
      wrap.appendChild(btn);
    }

    function evaluate(password) {
      const rules = [
        { label: MIN_LENGTH + ' or more characters', ok: password.length >= MIN_LENGTH },
        { label: 'One lowercase letter', ok: /[a-z]/.test(password) },
        { label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
        { label: 'One number', ok: /\d/.test(password) },
        { label: 'One symbol (e.g. ! @ # $)', ok: /[^A-Za-z0-9]/.test(password) },
      ];
      const passed = rules.filter(function (r) { return r.ok; }).length;
      let level = 'empty', text = 'Enter a password';
      if (password) {
        if (passed <= 2) { level = 'weak'; text = 'Weak'; }
        else if (passed === 3) { level = 'fair'; text = 'Fair'; }
        else if (passed === 4) { level = 'good'; text = 'Good'; }
        else { level = 'strong'; text = 'Strong'; }
      }
      return { rules: rules, passed: passed, level: level, text: text, allOk: passed === rules.length };
    }

    /* ---- Create account view ---- */
    const signup = document.createElement('form');
    signup.id = 'signup-form';
    signup.className = 'login-card auth-extra';
    signup.hidden = true;
    signup.noValidate = true;
    signup.innerHTML =
      '<div class="eyebrow">NEW ACCOUNT</div>' +
      '<h2>Create your account <span class="preview-tag">Preview</span></h2>' +
      '<p class="muted">Choose a username and a strong password.</p>' +
      '<label for="su-username">Username</label>' +
      '<input id="su-username" autocomplete="username" maxlength="80" placeholder="Choose a username" />' +
      '<label for="su-password">Password</label>' +
      '<input id="su-password" type="password" autocomplete="new-password" maxlength="256" placeholder="Create a password" />' +
      '<div class="pw-meter" aria-hidden="true"><i id="su-meter"></i></div>' +
      '<div class="pw-meter-row"><span>Password strength</span><b id="su-strength">Enter a password</b></div>' +
      '<ul class="pw-rules" id="su-rules"></ul>' +
      '<label for="su-confirm">Confirm password</label>' +
      '<input id="su-confirm" type="password" autocomplete="new-password" maxlength="256" placeholder="Re-enter the password" />' +
      '<p id="su-error" class="inline-error" role="alert"></p>' +
      '<p id="su-notice" class="auth-notice" role="status" hidden></p>' +
      '<button class="button button-primary button-wide" type="submit"><span>Create account</span><span aria-hidden="true">→</span></button>' +
      '<div class="auth-links"><button type="button" class="link-button" data-view="login">Back to sign in</button></div>';
    side.insertBefore(signup, loginForm.nextSibling);

    /* ---- "Create account" button on the login card ---- */
    const create = document.createElement('div');
    create.className = 'auth-create';
    create.innerHTML = '<span>New to PurpleShield?</span><button type="button" class="link-button" data-view="signup">Create account</button>';
    const hint = loginForm.querySelector('.login-hint');
    loginForm.insertBefore(create, hint || null);

    addToggle(document.getElementById('password'));
    addToggle(document.getElementById('su-password'));
    addToggle(document.getElementById('su-confirm'));

    function showView(name) {
      loginForm.hidden = name !== 'login';
      signup.hidden = name !== 'signup';
      const field = document.getElementById(name === 'signup' ? 'su-username' : 'username');
      if (field) field.focus();
    }
    side.addEventListener('click', function (event) {
      const target = event.target.closest('[data-view]');
      if (target) showView(target.dataset.view);
    });

    /* ---- strength meter ---- */
    const pw = document.getElementById('su-password');
    const meter = document.getElementById('su-meter');
    const strengthText = document.getElementById('su-strength');
    const rulesList = document.getElementById('su-rules');
    function renderStrength() {
      const result = evaluate(pw.value);
      meter.style.width = (result.passed / result.rules.length * 100) + '%';
      meter.className = 'level-' + result.level;
      strengthText.textContent = result.text;
      strengthText.className = 'level-' + result.level;
      rulesList.textContent = '';
      result.rules.forEach(function (rule) {
        const li = document.createElement('li');
        li.className = rule.ok ? 'ok' : '';
        li.textContent = rule.label;
        rulesList.appendChild(li);
      });
    }
    pw.addEventListener('input', renderStrength);
    renderStrength();

    /* ---- submit (no network) ---- */
    signup.addEventListener('submit', function (event) {
      event.preventDefault();
      const error = document.getElementById('su-error');
      const notice = document.getElementById('su-notice');
      notice.hidden = true;
      error.textContent = '';
      const username = document.getElementById('su-username').value.trim();
      const password = pw.value;
      const confirm = document.getElementById('su-confirm').value;
      if (!username) { error.textContent = 'Enter a username.'; return; }
      if (!evaluate(password).allOk) { error.textContent = 'Password does not meet all the requirements above.'; return; }
      if (password !== confirm) { error.textContent = 'Passwords do not match.'; return; }
      notice.textContent = 'Account creation is not available yet. The current PurpleShield API has no registration endpoint, so nothing was sent or saved. Ask an Admin to create your account.';
      notice.hidden = false;
    });

    document.documentElement.setAttribute('data-auth-extras', 'ready');
  }

  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  } catch (error) {
    console.error('[auth-extras] failed to start:', error);
  }
})();