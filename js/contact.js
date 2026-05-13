function handleSubmit(event) {
    event.preventDefault();

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const subject = document.getElementById("subject").value;
    const message = document.getElementById("message").value;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.textContent = "Sending...";
    submitBtn.disabled = true;

    emailjs.send(
        "xapc wxsy fpuu rjzt",    
        "template_kgqf7ue",    
        {
            name: name,
            email: email,
            subject: subject,
            message: message
        }
    )
    .then(() => {
        document.getElementById("successMessage").style.display = "block";
        setTimeout(() => {
            document.getElementById("successMessage").style.display = "none";
        }, 4000);

        document.querySelector("form").reset();
    })
    .catch(error => {
        console.error("EmailJS Error:", error);
        alert(" Error while sending");
    })
    .finally(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });
}

function toggleFAQ(element) {
    // Close all other FAQs
    document.querySelectorAll('.faq-item').forEach(item => {
        if (item !== element) {
            item.classList.remove('active');
            item.querySelector('.faq-question span').textContent = '▼';
        }
    });
    
    // Toggle current FAQ
    element.classList.toggle('active');
    const icon = element.querySelector('.faq-question span');
    icon.textContent = element.classList.contains('active') ? '▲' : '▼';
}