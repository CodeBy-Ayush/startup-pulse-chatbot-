document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    let prompt = document.querySelector("#prompt");
    let submitBtn = document.querySelector("#submit");
    let micBtn = document.querySelector("#mic-button");
    let chatContainer = document.querySelector(".chat-container");
    let themeToggle = document.querySelector(".theme-toggle");
    let soundToggle = document.querySelector(".sound-toggle");
    let body = document.body;

    // Check for saved theme preference or default to dark mode
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    const NEWS_API_KEY = "06c796bb31a446dd9b30f395fc222c6c";
    const NEWS_API_URL = `https://newsapi.org/v2/everything?q=startup OR startups -inurl:(login OR signup)&language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;

    let userMessage = null;
    let recognition = null;
    let isListening = false;
    let previousQueries = new Set(); // To remember what user has asked before
    let voiceInputUsed = false; // Flag to track if voice input was used

    // Theme toggler
    function setTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-mode');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        } else {
            body.classList.remove('light-mode');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
        localStorage.setItem('theme', theme);
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    // Sound toggle
    let isSoundMuted = localStorage.getItem('sound') === 'muted';
    if (isSoundMuted) {
        soundToggle.classList.add('muted');
        soundToggle.innerHTML = '<i class="fas fa-volume-mute"></i>';
    }

    soundToggle.addEventListener('click', () => {
        isSoundMuted = !isSoundMuted;
        localStorage.setItem('sound', isSoundMuted ? 'muted' : 'on');

        if (isSoundMuted) {
            soundToggle.classList.add('muted');
            soundToggle.innerHTML = '<i class="fas fa-volume-mute"></i>';
            speechSynthesis.cancel(); // Stop any ongoing speech
        } else {
            soundToggle.classList.remove('muted');
            soundToggle.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    });

    // Initialize speech recognition
    function initSpeechRecognition() {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = function() {
                isListening = true;
                voiceInputUsed = true; // Set flag when voice input is used
                micBtn.classList.add('listening');
                showNotification("Listening...", "info");
            };

            recognition.onresult = function(event) {
                const transcript = event.results[0][0].transcript;
                prompt.value = transcript;
                showNotification(`Heard: "${transcript}"`, "success");
                setTimeout(() => handleChatResponse(transcript), 500);
            };

            recognition.onerror = function(event) {
                console.error('Speech recognition error', event.error);
                isListening = false;
                micBtn.classList.remove('listening');
                showNotification("Voice recognition error. Try again.", "error");
            };

            recognition.onend = function() {
                isListening = false;
                micBtn.classList.remove('listening');
            };
        } else {
            micBtn.style.display = 'none';
            showNotification("Voice recognition not supported in this browser.", "error");
        }
    }

    function toggleSpeechRecognition() {
        if (!recognition) {
            initSpeechRecognition();
        }

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    }

    function showNotification(message, type = "info") {
        const notification = document.querySelector(".notification");
        notification.textContent = message;
        notification.className = "notification"; // Reset classes
        notification.classList.add('show', type);

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    async function fetchStartupNews(query = "latest") {
        // If user is asking something non-startup related
        if (!isStartupRelated(query)) {
            previousQueries.add(query.toLowerCase());
            return "I'm specialized in startup news. Could you ask me about startups, tech innovations, or venture capital instead?";
        }

        // If user is repeating the same question
        if (previousQueries.has(query.toLowerCase())) {
            return "I believe I've already shared news about this topic. Would you like to know about something different in the startup world?";
        }

        // Remember this query
        previousQueries.add(query.toLowerCase());

        try {
            let url = query === "latest" ?
                NEWS_API_URL :
                `https://newsapi.org/v2/everything?q=${encodeURIComponent(query + " startups")}&language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.status !== "ok" || !data.articles.length) {
                return "Sorry, I couldn't find any recent startup news matching your request.";
            }

            const articles = data.articles.slice(0, 3);
            let newsResponse = "Here are the latest startup news updates:<br><br>";
            articles.forEach((article, index) => {
                newsResponse += `${index + 1}. <strong>${article.title}</strong><br>`;
                newsResponse += `${article.description || "No description available."}<br>`;
                newsResponse += `<a href="${article.url}" class="news-link" target="_blank">Read more</a><br><br>`;
            });

            // Enable text-to-speech ONLY if voice input was used and sound is not muted
            if (voiceInputUsed && !isSoundMuted) {
                speakResponse(stripHtmlTags(newsResponse));
            }

            return newsResponse;
        } catch (error) {
            console.error("Fetch error:", error);
            return "Oops! Something went wrong while fetching startup news. Please try again later.";
        }
    }

    function isStartupRelated(query) {
        const startupKeywords = [
            "startup", "tech", "innovation", "entrepreneur", "venture", "capital",
            "funding", "business", "company", "investor", "investment", "founder",
            "series", "incubator", "accelerator", "silicon", "valley", "unicorn",
            "disrupt", "technology", "software", "app", "application", "platform",
            "digital", "ai", "artificial intelligence", "machine learning", "blockchain",
            "fintech", "biotech", "robotics", "saas", "iot", "data", "cloud", "latest"
        ];

        query = query.toLowerCase();

        // Check if any of the keywords is present in the query
        return startupKeywords.some(keyword => query.includes(keyword));
    }

    function stripHtmlTags(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    }

    function speakResponse(text) {
        if ('speechSynthesis' in window && !isSoundMuted) {
            // Cancel any ongoing speech
            speechSynthesis.cancel();

            // Split the text into smaller chunks to avoid cutting off
            const maxLength = 150;
            const textChunks = [];

            while (text.length > 0) {
                let chunk = text.substring(0, maxLength);

                // Try to find a period or comma to break at
                const lastPeriod = chunk.lastIndexOf('.');
                const lastComma = chunk.lastIndexOf(',');
                const breakPoint = Math.max(lastPeriod, lastComma);

                if (breakPoint > 0 && breakPoint < maxLength - 1) {
                    chunk = text.substring(0, breakPoint + 1);
                }

                textChunks.push(chunk);
                text = text.substring(chunk.length);
            }

            let i = 0;
            const speakNextChunk = () => {
                if (i < textChunks.length) {
                    const utterance = new SpeechSynthesisUtterance(textChunks[i]);
                    utterance.rate = 1.0;
                    utterance.pitch = 1.1;
                    utterance.onend = () => {
                        i++;
                        speakNextChunk();
                    };
                    speechSynthesis.speak(utterance);
                }
            };

            speakNextChunk();
        }
    }

    function createChatBox(html, classes) {
        let div = document.createElement("div");
        div.innerHTML = html;
        div.classList.add(classes);
        return div;
    }

    function showTypingIndicator() {
        const typingHtml = `
            <div class="avatar bot-avatar">
                <img src="user.png" alt="Bot Avatar">
            </div>
            <div class="ai-chat-area">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>`;
        let aiTypingBox = createChatBox(typingHtml, "ai-chat-box");
        chatContainer.appendChild(aiTypingBox);
        return aiTypingBox;
    }

    function addSuggestionChips() {
        const suggestionsHtml = `
            <div class="suggestion-chips">
                <button class="chip">Latest startup news</button>
                <button class="chip">AI startups</button>
                <button class="chip">Fintech startups</button>
                <button class="chip">Startup funding</button>
            </div>
        `;
        let suggestionsBox = document.createElement("div");
        suggestionsBox.classList.add("suggestions-container");
        suggestionsBox.innerHTML = suggestionsHtml;
        chatContainer.appendChild(suggestionsBox);

        // Add event listeners to chips
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', function() {
                // Reset voice input flag when using text/click input
                voiceInputUsed = false;
                handleChatResponse(this.textContent);
            });
        });
    }

    async function handleChatResponse(userInput) {
        if (!userInput.trim()) return;

        userMessage = userInput;
        let userHtml = `
            <div class="avatar user-avatar">
                <img src="user.png" alt="User Avatar">
            </div>
            <div class="user-chat-area">${userMessage}</div>`;
        prompt.value = "";
        let userChatBox = createChatBox(userHtml, "user-chat-box");
        chatContainer.appendChild(userChatBox);
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });

        // Remove suggestion chips if any
        document.querySelectorAll('.suggestions-container').forEach(el => el.remove());

        const typingBox = showTypingIndicator();
        setTimeout(async() => {
            typingBox.remove();
            let aiChatBox = createChatBox(`
                <div class="avatar bot-avatar">
                    <img src="user.png" alt="Bot Avatar">
                </div>
                <div class="ai-chat-area">Fetching startup news...</div>`, "ai-chat-box");
            chatContainer.appendChild(aiChatBox);

            const newsResponse = await fetchStartupNews(userMessage.toLowerCase());
            aiChatBox.querySelector(".ai-chat-area").innerHTML = newsResponse;
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
        }, 1200);
    }

    prompt.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            // Reset voice input flag when using keyboard
            voiceInputUsed = false;
            handleChatResponse(prompt.value);
        }
    });

    submitBtn.addEventListener("click", () => {
        // Reset voice input flag when using button
        voiceInputUsed = false;
        handleChatResponse(prompt.value);
    });

    micBtn.addEventListener("click", toggleSpeechRecognition);

    prompt.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight > 70 ? this.scrollHeight : 70) + 'px';
    });

    // Initialize speech recognition if available
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        initSpeechRecognition();
    } else {
        micBtn.style.display = 'none';
    }

    // Initial welcome message
    setTimeout(() => {
        let welcomeHtml = `
            <div class="avatar bot-avatar">
                <img src="user.png" alt="Bot Avatar">
            </div>
            <div class="ai-chat-area">
                <h2>Welcome to Startup Pulse!</h2>
                <p>I'm your AI assistant for the latest startup news and insights. Ask me about any startup topic or use the microphone to speak your query.</p>
            </div>`;
        let welcomeBox = createChatBox(welcomeHtml, "ai-chat-box");
        chatContainer.appendChild(welcomeBox);

        // Add suggestion chips
        addSuggestionChips();

        // Do NOT automatically speak the welcome message
    }, 500);
});