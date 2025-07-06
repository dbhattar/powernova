function toggleForm() {
    const signupForm = document.getElementById('signup-form');
    const signinForm = document.getElementById('signin-form');
    
    if (signupForm.style.display === 'none') {
        signupForm.style.display = 'block';
        signinForm.style.display = 'none';
    } else {
        signupForm.style.display = 'none';
        signinForm.style.display = 'block';
    }
}

// Signup Form Submission
document.getElementById('signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });
        
        const data = await response.json();
        if (response.ok) {
            alert('Signup successful!');
            toggleForm();
        } else {
            alert(data.detail || 'Signup failed');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Signin Form Submission
document.getElementById('signin').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    
    try {
        const response = await fetch('/api/signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });
        
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("access_token", data.access_token);
            window.location.href = "ui.html";
            // alert('Signin successful! Token: ' + data.access_token);
        } else {
            alert(data.detail || 'Signin failed');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

if (localStorage.getItem('access_token') != null) {
    window.location.href = "ui.html";
}