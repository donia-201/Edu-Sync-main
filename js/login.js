const form = document.getElementById("login-form");
const userField = document.getElementById("uNameOrEmail");
const passwordField = document.getElementById("pass");

const userError = document.getElementById("user-error");
const passError = document.getElementById("password-error");

function setupToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!toggle) return;
    const icon = toggle.querySelector("i");

    toggle.addEventListener("click", () => {
        const type = input.type === "password" ? "text" : "password";
        input.type = type;
        icon.classList.toggle("fa-eye");
        icon.classList.toggle("fa-eye-slash");
    });
}

setupToggle("pass", "togglePassword");

form.addEventListener("submit", function (e) {
    e.preventDefault();

    userError.textContent = "";
    passError.textContent = "";

    let valid = true;

    if (!userField.value.trim()) {
        userError.textContent = "Enter email or username.";
        valid = false;
    }

    if (!passwordField.value.trim()) {
        passError.textContent = "Password required.";
        valid = false;
    }

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    fetch("https://edu-sync-back-end-production.up.railway.app/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user: userField.value.trim(),
            password: passwordField.value.trim()
        })
    })
        .then(async res => {
            const data = await res.json().catch(() => ({}));
            return { status: res.status, data };
        })
        .then(result => {
            if (result.status === 401) {
                userError.textContent = result.data.msg || "Invalid email/username or password.";
                submitBtn.disabled = false;
                submitBtn.textContent = "Login";
                return;
            }

            if (!result.data.success) {
                userError.textContent = result.data.msg || "Login failed.";
                submitBtn.disabled = false;
                submitBtn.textContent = "Login";
            } else {
                localStorage.setItem("authToken", result.data.token);
                localStorage.setItem("user", JSON.stringify(result.data.user));

                alert("Welcome back!");
                window.location.href = "../pages/home.html";
            }
        })
        .catch(err => {
            console.error("Error:", err);
            alert("Something went wrong. Please try again.");
            submitBtn.disabled = false;
            submitBtn.textContent = "Login";
        });
});

// ====================  Google OAuth Token ====================
window.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (token) {
        localStorage.setItem("authToken", token);

        fetch("https://edu-sync-back-end-production.up.railway.app/verify-session", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem("user", JSON.stringify(data.user));
                    window.history.replaceState({}, document.title, window.location.pathname);
                    alert("Welcome!");
                    window.location.href = "../pages/home.html";
                } else {
                    alert("Authentication failed. Please try again.");
                    window.location.href = "../pages/login.html";
                }
            })
            .catch(err => {
                console.error("Session verification error:", err);
                alert("Authentication failed. Please try again.");
                window.location.href = "../pages/login.html";
            });
    }
});