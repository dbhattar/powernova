const chatContainer = document.querySelector('.chat-container');
const chatHeaderTitle = document.querySelector('#chat-header-title');
const chatHeader = document.querySelector('.chat-header');
const resizeHandle = document.querySelector('.resize-handle');
const closeBtn = document.querySelector('.close-btn');
const openBtn = document.querySelector('.chat-open-btn');

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

// Chat Functionality
function addMessage(content, isUser = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isUser ? 'user-message' : 'ollama-message');
    
    if (isUser) {
        messageDiv.textContent = content;
    } else {
        const thinkRegex = /<think>.*?<\/think>/g;
        const thinkContent = content.match(thinkRegex) || [];
        let mainContent = content.replace(thinkRegex, '').trim();

        if (thinkContent.length > 0) {
            const thinkDiv = document.createElement('div');
            thinkDiv.style.color = '#666';
            thinkDiv.style.fontStyle = 'italic';
            thinkDiv.textContent = thinkContent.map(t => t.replace(/<think>|<\/think>/g, '')).join('\n');
            messageDiv.appendChild(thinkDiv);
        }

        if (mainContent) {
            const mainDiv = document.createElement('div');
            mainDiv.innerHTML = marked.parse(mainContent);
            messageDiv.appendChild(mainDiv);
        } else {
            messageDiv.textContent = '[No response content]';
        }
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
async function sendMessage() {
    const input = document.getElementById('chat-message');
    const message = input.value.trim();
    if (!message) return;

    // Add user message
    addMessage(message, true);
    input.value = '';

    // Send to Ollama
    try {
        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'deepseek-r1', // Change to your preferred Ollama model
                messages: [{ role: 'user', content: message }],
                stream: false
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        const reply = data.message.content;
        addMessage(reply);
    } catch (error) {
        addMessage('Error: Could not connect to Ollama', false);
        console.error('Chat error:', error);
    }
}

// Handle Enter key for chat
document.getElementById('chat-message').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
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

