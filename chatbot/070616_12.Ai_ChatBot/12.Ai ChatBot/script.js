document.addEventListener("DOMContentLoaded", () => {
            // DOM Element Selection
            const promptInput = document.querySelector("#prompt");
            const submitBtn = document.querySelector("#submit");
            const chatContainer = document.querySelector(".chat-container");
            const voiceBtn = document.querySelector("#voice-btn");
            const voiceIndicator = document.querySelector(".voice-indicator");
            const themeToggleBtn = document.querySelector("#theme-toggle");
            const body = document.body;
            const themeOptions = document.querySelectorAll(".theme-option");
            const clearHistoryBtn = document.querySelector("#clear-history");
            const sidebarCollapseBtn = document.querySelector("#collapse-sidebar");
            const sidebarExpandBtn = document.querySelector("#expand-sidebar");
            const sidebar = document.querySelector(".sidebar");
            const historyContainer = document.querySelector(".history-container");
            const queryTags = document.querySelectorAll(".query-tag");
            const welcomeModal = document.querySelector("#welcome-modal");
            const getStartedBtn = document.querySelector("#get-started");
            const closeModalBtn = welcomeModal.querySelector(".close-modal");
            const notificationContainer = document.querySelector(".notification-container");
            const confidenceBar = voiceIndicator.querySelector('.confidence-bar');

            // --- Configuration ---
            // !!! IMPORTANT: REPLACE "YOUR_NEWS_API_KEY" WITH YOUR ACTUAL KEY !!!
            const NEWS_API_KEY = "06c796bb31a446dd9b30f395fc222c6c"; // <<<=== GET YOUR KEY FROM newsapi.org AND PUT IT HERE
            // !!! If NEWS_API_KEY is not set correctly, fetching will fail !!!

            const NEWS_API_URL_BASE = `https://newsapi.org/v2/everything`;
            const USE_MOCK_NEWS = false; // <--- Set to false to use the REAL API

            // --- State Variables ---
            let isListening = false;
            let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];
            let recognition = null;
            let confidenceInterval = null;

            // --- Speech Recognition Setup ---
            try {
                if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    recognition = new SpeechRecognition();
                    recognition.continuous = false;
                    recognition.interimResults = false;
                    recognition.lang = 'en-US';

                    recognition.onresult = handleVoiceResult;
                    recognition.onend = handleVoiceEnd;
                    recognition.onerror = handleVoiceError;
                    recognition.onaudiostart = handleVoiceAudioStart;
                    recognition.onsoundstart = handleVoiceSoundStart;
                } else {
                    console.warn("Speech Recognition not supported in this browser.");
                    voiceBtn.disabled = true;
                    voiceBtn.title = "Voice command not supported";
                }
            } catch (error) {
                console.error("Error initializing Speech Recognition:", error);
                voiceBtn.disabled = true;
                voiceBtn.title = "Voice command error";
            }

            // --- Core Functions ---

            async function fetchStartupNews(query = "latest") {
                if (USE_MOCK_NEWS) { // Keep the mock logic just in case, but it's disabled now
                    console.log("Using MOCK data (should be disabled).");
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const mockData = { /* ... mock data ... */ };
                    return formatNewsResponse(mockData, query);
                }

                // --- Real API Fetch ---
                if (!NEWS_API_KEY || NEWS_API_KEY === "YOUR_NEWS_API_KEY") {
                    console.error("News API Key is missing or not replaced!");
                    showNotification("ERROR: News API Key not configured in script.js");
                    return `Sorry, the news service isn't configured correctly. Please add a valid News API key in the script.`;
                }

                try {
                    // Construct search query for the API
                    const searchQuery = query.toLowerCase() === 'latest' ?
                        'startup OR startups' // Broad search for general latest news
                        // More specific query including 'startup' for better relevance
                        :
                        `(${query} AND (startup OR startups)) OR "${query} startup"`;

                    const url = `${NEWS_API_URL_BASE}?q=${encodeURIComponent(searchQuery)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${NEWS_API_KEY}`;

                    console.log("Fetching Real News URL:", url);

                    const response = await fetch(url);

                    if (!response.ok) {
                        let errorMsg = `HTTP error! Status: ${response.status}`;
                        let apiMessage = '';
                        try {
                            const errorData = await response.json();
                            console.error("API Error Response:", errorData);
                            apiMessage = errorData.message || '';
                            if (response.status === 401) { // Unauthorized
                                errorMsg = `API Error: Invalid API Key or unauthorized request. Check your key.`;
                            } else if (response.status === 429) { // Too Many Requests
                                errorMsg = `API Error: Rate limit exceeded. Please wait and try again later.`;
                            } else if (apiMessage) {
                                errorMsg = `API Error (${response.status}): ${apiMessage}`;
                            }
                        } catch (e) { /* Ignore if response is not JSON */ }
                        throw new Error(errorMsg);
                    }

                    const data = await response.json();
                    console.log("Real API Response:", data);

                    if (data.totalResults === 0) {
                        return `Sorry, I couldn't find any recent startup news matching "${query}". Try a broader term?`;
                    }

                    return formatNewsResponse(data, query);

                } catch (error) {
                    console.error("Fetch error:", error);
                    // Provide more specific feedback based on error type
                    let userErrorMessage = `Oops! Something went wrong while fetching news for "${query}".`;
                    if (error.message.includes("API Error")) {
                        userErrorMessage = error.message; // Show the specific API error message
                    } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                        // This often indicates a network error or CORS issue
                        userErrorMessage = `Network error or CORS issue fetching news for "${query}". Ensure you're online and not running directly from a local file (use a local server).`;
                        console.warn("Potential CORS issue or network error. Try using a local web server.");
                    } else {
                        userErrorMessage = `Error fetching news for "${query}". Please check the console or try again later.`;
                    }

                    showNotification(userErrorMessage); // Show detailed error in notification
                    // Return a simpler message for the chat interface
                    return `Sorry, I couldn't fetch news for "${query}" right now. There might be a network issue or an API problem.`;
                }
            }

            function formatNewsResponse(data, query) {
                // This function remains the same as before
                if (data.status !== "ok" || !data.articles || data.articles.length === 0) {
                    // It's possible API returns OK but 0 articles even if totalResults > 0 sometimes
                    return `Sorry, I couldn't retrieve specific articles for "${query}", even though some results were found.`;
                }

                const articles = data.articles.slice(0, 3); // Show top 3
                let newsResponse = `Here are the top startup news updates related to "${query}":<br><br>`;

                articles.forEach((article, index) => {
                    const title = article.title ? article.title.replace(/</g, "<").replace(/>/g, ">") : "No Title";
                    const description = article.description ? article.description.replace(/</g, "<").replace(/>/g, ">") : "No description available.";
                    const url = article.url || "#";

                    newsResponse += `${index + 1}. <strong>${title}</strong><br>`;
                    if (description !== "No description available.") { // Only show description if available
                        newsResponse += `${description}<br>`;
                    }
                    newsResponse += `<a href="${url}" class="news-link" target="_blank" rel="noopener noreferrer">Read more</a><br><br>`;
                });
                return newsResponse;
            }

            function createChatBox(isUser, content) {
                // This function remains the same as before
                const avatarSrc = isUser ? "user.png" : "bot.jpg";
                const boxClass = isUser ? "user-chat-box" : "ai-chat-box";
                const areaClass = isUser ? "user-chat-area" : "ai-chat-area";
                const avatarAlt = isUser ? "User Avatar" : "StartupPulse Bot Avatar";

                const div = document.createElement("div");
                div.classList.add(boxClass);

                const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                div.innerHTML = `
            <img src="${avatarSrc}" alt="${avatarAlt}" class="avatar">
            <div class="${areaClass}">
                ${content}
                <div class="chat-actions">
                    <button class="chat-action-btn copy-btn" title="Copy">
                        <i class="fas fa-copy"></i>
                    </button>
                    ${!isUser ? `
                    <button class="chat-action-btn speak-btn" title="Read Aloud">
                        <i class="fas fa-volume-up"></i>
                    </button>` : ''}
                </div>
                <div class="chat-timestamp">${timestamp}</div>
            </div>
        `;

        const copyBtn = div.querySelector('.copy-btn');
        copyBtn?.addEventListener('click', () => {
            const textToCopy = div.querySelector(`.${areaClass}`).innerText.replace(/Read more/g, '').trim();
            navigator.clipboard.writeText(textToCopy)
                .then(() => showNotification('Text copied to clipboard!'))
                .catch(err => {
                     console.error('Copy failed:', err);
                     showNotification('Failed to copy text.');
                });
        });

        if (!isUser) {
            const speakBtn = div.querySelector('.speak-btn');
            speakBtn?.addEventListener('click', () => {
                const textToSpeak = div.querySelector(`.${areaClass}`).innerText.replace(/Read more/g, '').trim();
                speakText(textToSpeak);
            });
        }

        return div;
    }

    function showTypingIndicator() {
        // This function remains the same as before
        const typingDiv = createChatBox(false, `
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `);
        const actions = typingDiv.querySelector('.chat-actions');
        if(actions) actions.remove();
        const timestamp = typingDiv.querySelector('.chat-timestamp');
        if(timestamp) timestamp.remove();

        chatContainer.appendChild(typingDiv);
        scrollToBottom();
        return typingDiv;
    }

    async function handleChatResponse(userInput) {
        // This function remains the same as before, calling the updated fetchStartupNews
        const trimmedInput = userInput.trim();
        if (!trimmedInput) return;

        const userChatBox = createChatBox(true, trimmedInput.replace(/</g, "<").replace(/>/g, ">"));
        chatContainer.appendChild(userChatBox);
        scrollToBottom();
        promptInput.value = "";

        const typingBox = showTypingIndicator();
        let newsResponse = '';

        try {
            newsResponse = await fetchStartupNews(trimmedInput); // Now fetches real news

            typingBox.remove();
            const aiChatBox = createChatBox(false, newsResponse);
            chatContainer.appendChild(aiChatBox);

            const links = aiChatBox.querySelectorAll('.news-link');
            links.forEach((link, index) => {
                link.style.animationDelay = `${index * 0.1}s`;
                link.style.animation = 'fadeIn 0.5s forwards';
                link.style.opacity = '0';
            });

            scrollToBottom();
            saveChatHistory(trimmedInput, newsResponse);
            updateHistorySidebar();
            // speakFirstHeadline(aiChatBox); // Optional

        } catch (error) {
            console.error("Error in handleChatResponse:", error);
            typingBox.remove();
            // Use the error message from fetchStartupNews if available
            const errorContent = error.message.includes("API Error") || error.message.includes("Network error")
                ? error.message
                : "Sorry, I encountered an error processing your request.";
            const errorBox = createChatBox(false, errorContent);
            chatContainer.appendChild(errorBox);
            scrollToBottom();
            newsResponse = errorContent; // Save error state to history
            saveChatHistory(trimmedInput, newsResponse);
            updateHistorySidebar();
        }
    }

    function saveChatHistory(query, response) {
        // This function remains the same as before
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = response;
        const plainResponse = tempDiv.innerText.replace(/\s\s+/g, ' ').trim();

        chatHistory.unshift({
            query: query,
            responsePreview: plainResponse.substring(0, 80) + (plainResponse.length > 80 ? '...' : ''),
            fullResponse: response,
            timestamp: new Date().toISOString()
        });

        if (chatHistory.length > 15) {
            chatHistory = chatHistory.slice(0, 15);
        }
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    }

    function updateHistorySidebar() {
        // This function remains the same as before
        historyContainer.innerHTML = '';

        if (chatHistory.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'No chat history yet.';
            emptyMessage.style.padding = '15px';
            emptyMessage.style.opacity = '0.7';
            emptyMessage.style.textAlign = 'center';
            historyContainer.appendChild(emptyMessage);
            return;
        }

        chatHistory.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            historyItem.setAttribute('tabindex', '0');
            historyItem.setAttribute('role', 'button');
            historyItem.setAttribute('aria-label', `Chat about ${item.query}`);
            historyItem.dataset.index = index;

            const date = new Date(item.timestamp);
            const formattedDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const queryEl = document.createElement('strong');
            queryEl.textContent = item.query;
            const previewEl = document.createElement('p');
            previewEl.textContent = item.responsePreview;
            const timestampEl = document.createElement('div');
            timestampEl.classList.add('timestamp');
            timestampEl.textContent = `${formattedDate}, ${formattedTime}`;

             const deleteBtn = document.createElement('button');
             deleteBtn.classList.add('delete-history');
             deleteBtn.setAttribute('title', 'Delete this chat');
             deleteBtn.setAttribute('aria-label', 'Delete this chat');
             deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
             deleteBtn.dataset.index = index;

            historyItem.appendChild(deleteBtn);
            historyItem.appendChild(queryEl);
            historyItem.appendChild(previewEl);
            historyItem.appendChild(timestampEl);

            historyItem.addEventListener('click', (e) => {
                 if (e.target.closest('.delete-history')) return;
                 promptInput.value = item.query;
                 promptInput.focus();
                 if (window.innerWidth < 992) {
                     toggleSidebar(false);
                 }
            });

             historyItem.addEventListener('keydown', (e) => {
                 if (e.key === 'Enter') historyItem.click();
             });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemIndex = parseInt(e.currentTarget.dataset.index);
                if (!isNaN(itemIndex)) deleteHistoryItem(itemIndex);
            });

            historyContainer.appendChild(historyItem);
        });
    }

     function deleteHistoryItem(index) {
         // This function remains the same as before
         chatHistory.splice(index, 1);
         localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
         updateHistorySidebar();
         showNotification('Conversation removed from history');
     }

    // --- Voice Recognition Handlers ---
    function startVoiceRecognition() {
        // This function remains the same as before
        if (!recognition) {
            showNotification("Voice recognition is not supported in your browser.");
            return;
        }
        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
                isListening = true;
                voiceBtn.classList.add('active');
                voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
                voiceBtn.title = "Stop Listening";
                voiceIndicator.style.display = 'flex';
                confidenceBar.style.width = '0%';
            } catch (error) {
                console.error("Error starting recognition:", error);
                showNotification(`Could not start voice recognition: ${error.message}`);
                handleVoiceEnd();
            }
        }
    }
    function handleVoiceResult(event) {
        // This function remains the same as before
        const transcript = event.results[0][0].transcript;
        console.log("Voice transcript:", transcript);
        confidenceBar.style.width = '100%';
        setTimeout(() => { handleVoiceEnd(); }, 300);
        promptInput.value = transcript;
        handleChatResponse(transcript);
    }
    function handleVoiceEnd() {
        // This function remains the same as before
        if (!isListening) return;
        isListening = false;
        voiceBtn.classList.remove('active');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.title = "Voice Command";
        voiceIndicator.style.display = 'none';
        confidenceBar.style.width = '0%';
        if (confidenceInterval) {
            clearInterval(confidenceInterval);
            confidenceInterval = null;
        }
        console.log("Voice recognition ended.");
    }
    function handleVoiceError(event) {
        // This function remains the same as before
        console.error('Speech recognition error:', event.error, event.message);
        let errorMessage = "An unknown voice error occurred.";
        if (event.error === 'no-speech') errorMessage = "I didn't hear anything. Please try again.";
        else if (event.error === 'audio-capture') errorMessage = "Audio capture failed. Check microphone permissions.";
        else if (event.error === 'not-allowed') errorMessage = "Microphone access denied. Please allow access.";
        else errorMessage = `Voice Error: ${event.message || event.error}`;
        showNotification(errorMessage);
        handleVoiceEnd();
    }
     function handleVoiceAudioStart() {
         // This function remains the same as before
         console.log("Audio capture started.");
         if (!confidenceInterval) {
             let confidenceValue = 0;
             confidenceInterval = setInterval(() => {
                 confidenceValue = Math.min(100, confidenceValue + Math.random() * 10);
                 confidenceBar.style.width = `${confidenceValue}%`;
             }, 200);
         }
     }
     function handleVoiceSoundStart() {
        // This function remains the same as before
         console.log("Sound detected.");
     }

    // --- Text-to-Speech ---
    function speakText(text) {
        // This function remains the same as before
        if (!('speechSynthesis' in window)) {
            showNotification("Text-to-speech not supported.");
            return;
        }
        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        const cleanText = text.replace(/https?:\/\/[^\s]+/g, '').replace(/Read more/gi, '').trim();
        if (!cleanText) return;
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => voice.lang === 'en-US' && voice.name.includes('Google'));
        if (preferredVoice) utterance.voice = preferredVoice;
        window.speechSynthesis.speak(utterance);
    }

    // --- UI Utility Functions ---
    function scrollToBottom() {
        // This function remains the same as before
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
    }
    function toggleTheme(themeName) {
        // This function remains the same as before
        body.className = body.className.replace(/theme-\w+/g, '').trim();
        body.classList.add(`theme-${themeName}`);
        localStorage.setItem('theme', themeName);
        createBubbles();
        showNotification(`${themeName.charAt(0).toUpperCase() + themeName.slice(1)} theme applied`);
    }
    function showNotification(message) {
        // This function remains the same as before
        const notification = document.createElement('div');
        notification.classList.add('notification');
        const iconClass = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? 'fa-exclamation-circle' : 'fa-info-circle';
        notification.innerHTML = `<i class="fas ${iconClass}"></i><span></span>`;
        notification.querySelector('span').textContent = message;
        notificationContainer.appendChild(notification);
        notification.addEventListener('animationend', (e) => { if (e.animationName === 'fade-out') notification.remove(); });
        setTimeout(() => { if (notification.parentNode === notificationContainer) notification.remove(); }, 4000);
    }
    function toggleSidebar(forceShow = null) {
        // This function remains the same as before
        const shouldShow = forceShow !== null ? forceShow : sidebar.classList.contains('collapsed');
        if (shouldShow) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('show');
            sidebarExpandBtn.classList.add('hide');
            // sidebarCollapseBtn.focus(); // Avoid focusing if toggled programmatically
            body.classList.remove('sidebar-collapsed');
        } else {
            sidebar.classList.add('collapsed');
            sidebar.classList.remove('show');
            sidebarExpandBtn.classList.remove('hide');
            // sidebarExpandBtn.focus(); // Avoid focusing if toggled programmatically
            body.classList.add('sidebar-collapsed');
        }
    }
    function clearAllHistory() {
        // This function remains the same as before
        if (chatHistory.length === 0) {
            showNotification("Chat history is already empty."); return;
        }
        chatHistory = [];
        localStorage.removeItem('chatHistory');
        updateHistorySidebar();
        chatContainer.innerHTML = '';
        addInitialWelcomeMessage();
        showNotification('Chat history cleared');
    }
    function createBubbles() {
        // This function remains the same as before
        const bubblesContainer = document.querySelector('.bubbles');
        if (!bubblesContainer) return;
        bubblesContainer.innerHTML = '';
        const bubbleCount = Math.floor(window.innerWidth / 80);
        for (let i = 0; i < bubbleCount; i++) {
            const bubble = document.createElement('div');
            const size = Math.random() * 50 + 10;
            const left = Math.random() * 100;
            const duration = Math.random() * 15 + 10;
            const delay = Math.random() * 5;
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.left = `${left}%`;
            bubble.style.animationDuration = `${duration}s`;
            bubble.style.animationDelay = `${delay}s`;
            bubblesContainer.appendChild(bubble);
        }
    }
     function addInitialWelcomeMessage() {
        // This function remains the same as before
         const hour = new Date().getHours();
         let greeting = "Hello";
         if (hour < 12) greeting = "Good morning";
         else if (hour < 18) greeting = "Good afternoon";
         else greeting = "Good evening";
         const welcomeMessage = `${greeting}! Welcome to StartupPulse.<br>Ask me about the latest startup news, specific companies (like 'AI startups'), or funding rounds.<br>You can also use the <i class="fas fa-microphone"></i> for voice commands.<br>How can I help you today?`;
         const welcomeBox = createChatBox(false, welcomeMessage);
         const actions = welcomeBox.querySelector('.chat-actions');
         if (actions) actions.remove();
         chatContainer.appendChild(welcomeBox);
     }

    // --- Initialization ---
    function init() {
        // This function remains the same as before
        console.log("Initializing StartupPulse (Real-Time Mode)...");
        const savedTheme = localStorage.getItem('theme') || 'blue';
        toggleTheme(savedTheme);
        updateHistorySidebar();
        createBubbles();
        if (!localStorage.getItem('welcomeSeen')) {
            welcomeModal.classList.add('show');
            getStartedBtn.focus();
        } else {
             addInitialWelcomeMessage();
        }
        if (window.innerWidth < 992) toggleSidebar(false);
        else toggleSidebar(true);
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = () => { console.log("Voices loaded."); };
            }
        }
        promptInput.focus();
        console.log("Initialization complete.");
    }

    // --- Event Listeners ---
    // All event listeners remain the same as before
    promptInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatResponse(promptInput.value); } });
    submitBtn.addEventListener("click", () => { handleChatResponse(promptInput.value); });
    voiceBtn.addEventListener("click", startVoiceRecognition);
    themeOptions.forEach(option => { option.addEventListener('click', (e) => { toggleTheme(e.currentTarget.dataset.theme); }); option.addEventListener('keydown', (e) => { if (e.key === 'Enter') toggleTheme(e.currentTarget.dataset.theme); }); });
    clearHistoryBtn.addEventListener('click', clearAllHistory);
    sidebarCollapseBtn.addEventListener('click', () => toggleSidebar(false));
    sidebarExpandBtn.addEventListener('click', () => toggleSidebar(true));
    queryTags.forEach(tag => { tag.addEventListener('click', () => { const query = tag.textContent; promptInput.value = query; handleChatResponse(query); if (window.innerWidth < 992) toggleSidebar(false); }); tag.addEventListener('keydown', (e) => { if(e.key === 'Enter') tag.click(); }); });
    getStartedBtn.addEventListener('click', () => { welcomeModal.classList.remove('show'); localStorage.setItem('welcomeSeen', 'true'); addInitialWelcomeMessage(); promptInput.focus(); });
    closeModalBtn.addEventListener('click', () => { welcomeModal.classList.remove('show'); if (!localStorage.getItem('welcomeSeen')) { localStorage.setItem('welcomeSeen', 'true'); addInitialWelcomeMessage(); } promptInput.focus(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && welcomeModal.classList.contains('show')) closeModalBtn.click(); });
    let resizeTimeout;
    window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(() => { createBubbles(); }, 250); });

    // --- Start the Application ---
    init();
});