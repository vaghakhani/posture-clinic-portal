(function () {
  var errorEl = document.getElementById("error");
  var successEl = document.getElementById("success");
  var submitBtn = document.getElementById("submitBtn");
  var googleBtn = document.getElementById("googleBtn");

  function setStatus(node, message) {
    [errorEl, successEl].forEach(function (el) {
      el.hidden = true;
      el.textContent = "";
    });
    if (!message) return;
    node.textContent = message;
    node.hidden = false;
  }

  function setBusy(isBusy) {
    submitBtn.disabled = isBusy;
    googleBtn.disabled = isBusy;
    submitBtn.textContent = isBusy ? "Signing in…" : "Sign in to Portal";
  }

  PosturePortalAuth.requireLoginPage().catch(function (error) {
    setStatus(errorEl, error.message || "Could not restore your session.");
  });

  document.getElementById("loginForm").addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus(errorEl, "");
    setBusy(true);
    var email = document.getElementById("email").value.trim().toLowerCase();
    var password = document.getElementById("password").value;
    PosturePortalAuth.signInWithEmail(email, password)
      .then(function () {
        location.href = PosturePortalAuth.getConfig().appPage || "app.html";
      })
      .catch(function (error) {
        setStatus(errorEl, error.message || "Sign-in failed. Please try again.");
      })
      .finally(function () {
        setBusy(false);
      });
  });

  googleBtn.addEventListener("click", function () {
    setStatus(errorEl, "");
    setBusy(true);
    PosturePortalAuth.signInWithGoogle().catch(function (error) {
      setStatus(errorEl, error.message || "Google sign-in could not start.");
      setBusy(false);
    });
  });
})();
