const chatContainer = document.querySelector('.chat-container');
const chatHeaderTitle = document.querySelector('#chat-header-title');
const toggleBtn = document.querySelector('.toggle-btn');
const chatHeader = document.querySelector('.chat-header');
const resizeHandle = document.querySelector('.resize-handle');
const closeBtn = document.querySelector('.close-btn');
const openBtn = document.querySelector('.chat-open-btn');

// Toggle functionality
function toggleChat() {
    chatContainer.classList.toggle('collapsed');
    chatHeaderTitle.style.display = chatHeaderTitle.style.display == 'none' ? '' : 'none';
    toggleBtn.textContent = chatContainer.classList.contains('collapsed') ? '←' : '→';
}

function closeChat() {
    chatContainer.classList.add('hidden');
    chatContainer.classList.remove('collapsed');
    openBtn.style.display = 'block';
}

function openChat() {
    chatContainer.classList.remove('hidden');
    chatContainer.style.display = 'block';
    openBtn.style.display = 'none';
    toggleBtn.textContent = '→';
}

toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleChat();
});

chatHeader.addEventListener('click', () => {
    toggleChat();
});

closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeChat();
});

openBtn.addEventListener('click', () => {
    openChat();
});

// Resize functionality
let isResizing = false;

resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 200 && newWidth <= 600) { // Respect min/max width
        chatContainer.style.width = `${newWidth}px`;
    }
});

document.addEventListener('mouseup', () => {
    isResizing = false;
});

// Chat functionality
const input = document.querySelector('.chat-input input');
const sendBtn = document.querySelector('.chat-input button');
const messages = document.querySelector('.chat-messages');

function addMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.textContent = text;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

sendBtn.addEventListener('click', () => {
    if (input.value.trim()) {
        addMessage(input.value);
        input.value = '';
    }
});

input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
        addMessage(input.value);
        input.value = '';
    }
});
