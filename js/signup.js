const form = document.getElementById("signup-form");
const user_Name = document.getElementById("uName");
const Name = document.getElementById("name");
const email = document.getElementById("email");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("pass2");

const uNameError = document.getElementById("uName-error");
const emailError = document.getElementById("email-error");
const passError = document.getElementById("password-error");
const confirmPassError = document.getElementById("confirm-password-error");

// ==================== فانكشن العين (Toggle Password) ====================
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

// ==================== Toggle Other Field ====================
function toggleOtherField() {
    const select = document.getElementById("sfield");
    const otherField = document.getElementById("OtherField");
    otherField.style.display = select.value === "Other" ? "block" : "none";
}
document.getElementById("OtherField").style.display = "none";

setupToggle("password", "togglePassword");
setupToggle("pass2", "togglePassword2");

// ==================== Regex للتحقق ====================
const usernameRegex = /^[A-Za-z]+$/;

const emailRegex = /^[A-Za-z][A-Za-z0-9._-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\W]{8,}$/;

// ====================  Sign Up Form ====================
form.addEventListener("submit", function (e) {
    e.preventDefault();

    uNameError.textContent = "";
    emailError.textContent = "";
    passError.textContent = "";
    confirmPassError.textContent = "";

    let valid = true;

    // ✅ Validate Username
    if (!user_Name.value.trim()) {
        uNameError.textContent = "Username is required.";
        valid = false;
    } else if (user_Name.value.trim().length < 3) {
        uNameError.textContent = "Username must be at least 3 characters.";
        valid = false;
    } else if (!usernameRegex.test(user_Name.value.trim())) {
        uNameError.textContent = "Username must contain only letters (no numbers or symbols).";
        valid = false;
    }

    // ✅ Validate Email
    if (!email.value.trim()) {
        emailError.textContent = "Email is required.";
        valid = false;
    } else if (!emailRegex.test(email.value.trim())) {
        emailError.textContent = "Email must start with a letter and be valid.";
        valid = false;
    }

    // ✅ Validate Password
    if (!password.value.trim()) {
        passError.textContent = "Password is required.";
        valid = false;
    } else if (!passwordRegex.test(password.value.trim())) {
        passError.textContent = "Password must be 8+ chars and contain upper, lower, number, symbol.";
        valid = false;
    }

    // ✅ Validate Confirm Password
    if (!confirmPassword.value.trim()) {
        confirmPassError.textContent = "Please confirm your password.";
        valid = false;
    } else if (confirmPassword.value.trim() !== password.value.trim()) {
        confirmPassError.textContent = "Passwords do not match.";
        valid = false;
    }

    if (!valid) return;

    const studyField = document.getElementById("sfield").value;
    const otherField = document.getElementById("OtherField").value.trim();
    const finalStudyField = studyField === "Other" ? otherField : studyField;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing up...";

    fetch("https://edu-sync-back-end-production.up.railway.app/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: user_Name.value.trim(),
            email: email.value.trim(),
            password: password.value.trim(),
            study_field: finalStudyField,
        }),
    })
        .then(async (res) => {
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = body.msg || `Server error: ${res.status}`;
                if (msg.includes("Email")) emailError.textContent = msg;
                else if (msg.includes("Username")) uNameError.textContent = msg;
                else alert(msg);

                submitBtn.disabled = false;
                submitBtn.textContent = "Sign Up";
                throw new Error(msg);
            }
            return body;
        })
        .then((data) => {
            if (data.success) {
                localStorage.setItem("authToken", data.token);
                localStorage.setItem("session_token", data.token); // ✅ Save as session_token too
                localStorage.setItem("user", JSON.stringify(data.user));

                alert("Account created! Redirecting...");
                form.reset();
                window.location.href = "../pages/home.html";
            }
        })
        .catch((err) => {
            console.error(err);
            if (
                !emailError.textContent &&
                !uNameError.textContent &&
                !passError.textContent &&
                !confirmPassError.textContent
            ) {
                alert("Something went wrong. Please try again.");
            }
            submitBtn.disabled = false;
            submitBtn.textContent = "Sign Up";
        });
});

// ==================== Google Sign-In Redirect ====================
function GoogleRedirect() {
    window.location.href =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
            client_id: "562682529890-tq8hjqqtml1kp2oop25i6j7gheiu89h1.apps.googleusercontent.com",
            redirect_uri: "https://edu-sync-back-end-production.up.railway.app/google-callback",
            response_type: "code",
            scope: "email profile",
            access_type: "online",
            prompt: "select_account"
        });
}