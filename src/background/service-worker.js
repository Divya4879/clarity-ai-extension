// WebSimplify Pro - Service Worker
class WebSimplifyBackground {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeExtension();
    }

    setupEventListeners() {
        // Extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        // Tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // Tab activation
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.handleTabActivation(activeInfo);
        });

        // Message handling
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }

    async initializeExtension() {
        // Set default storage values
        const defaults = {
            simplificationLevel: 2,
            pagesSimplified: 0,
            totalTimeSaved: 0,
            domainPreferences: {},
            isEnabled: true
        };

        const existing = await chrome.storage.sync.get(Object.keys(defaults));
        const toSet = {};

        for (const [key, value] of Object.entries(defaults)) {
            if (existing[key] === undefined) {
                toSet[key] = value;
            }
        }

        if (Object.keys(toSet).length > 0) {
            await chrome.storage.sync.set(toSet);
        }

        // Chrome AI APIs will be integrated in Day 2
        console.log('Extension initialized successfully');
    }

    async initializeAIAPIs() {
        try {
            // Chrome AI APIs will be integrated later
            // For now, use basic text analysis
            console.log('AI APIs initialization deferred to content script');
        } catch (error) {
            console.error('Failed to initialize AI APIs:', error);
        }
    }

    handleInstallation(details) {
        if (details.reason === 'install') {
            // First time installation
            console.log('WebSimplify Pro installed');
            
            // Set default badge
            chrome.action.setBadgeText({ text: '' });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
            
            // Open welcome page (optional)
            // chrome.tabs.create({ url: 'welcome.html' });
        } else if (details.reason === 'update') {
            console.log('WebSimplify Pro updated');
        }
    }

    async handleTabUpdate(tabId, changeInfo, tab) {
        // Only process when page is completely loaded
        if (changeInfo.status === 'complete' && tab.url) {
            // Skip chrome:// and extension pages
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                return;
            }

            // Reset badge for new page
            chrome.action.setBadgeText({ text: '', tabId: tabId });
            
            // Inject content script if needed
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['src/content/content-script.js']
                });
            } catch (error) {
                // Content script might already be injected
                console.log('Content script injection skipped:', error.message);
            }
        }
    }

    async handleTabActivation(activeInfo) {
        // Update badge when switching tabs
        try {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            if (tab.url && !tab.url.startsWith('chrome://')) {
                // Request complexity score from content script
                chrome.tabs.sendMessage(activeInfo.tabId, {
                    action: 'getComplexityScore'
                }).catch(() => {
                    // Content script not ready, ignore
                });
            }
        } catch (error) {
            console.log('Tab activation handling failed:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'updateBadge':
                    await this.updateBadge(sender.tab.id, message.complexity);
                    sendResponse({ success: true });
                    break;

                case 'trackAnalytics':
                    await this.trackAnalytics(message.data);
                    sendResponse({ success: true });
                    break;

                case 'updateStats':
                    await this.updateStats(message.stats);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({ error: error.message });
        }
    }

    async updateBadge(tabId, complexity) {
        const score = Math.round(complexity);
        const color = score <= 3 ? '#4CAF50' : score <= 6 ? '#FF9800' : '#f44336';
        
        await chrome.action.setBadgeText({ 
            text: score.toString(), 
            tabId: tabId 
        });
        
        await chrome.action.setBadgeBackgroundColor({ 
            color: color, 
            tabId: tabId 
        });
    }

    async trackAnalytics(data) {
        try {
            const current = await chrome.storage.sync.get(['analytics']);
            const analytics = current.analytics || [];
            
            // Add new analytics entry
            analytics.push(data);
            
            // Keep only last 100 entries to avoid storage limits
            if (analytics.length > 100) {
                analytics.splice(0, analytics.length - 100);
            }
            
            await chrome.storage.sync.set({ analytics });
            
            // Update aggregate stats
            if (data.type === 'page_simplified') {
                await this.updateAggregateStats(data);
            }
        } catch (error) {
            console.error('Analytics tracking failed:', error);
        }
    }

    async updateAggregateStats(data) {
        const current = await chrome.storage.sync.get(['pagesSimplified', 'totalTimeSaved', 'totalWordsReduced']);
        
        // Calculate time saved (rough estimate: 1 minute per 200 words reduced)
        const timeSaved = Math.round(data.reduction / 200);
        
        await chrome.storage.sync.set({
            pagesSimplified: (current.pagesSimplified || 0) + 1,
            totalTimeSaved: (current.totalTimeSaved || 0) + timeSaved,
            totalWordsReduced: (current.totalWordsReduced || 0) + data.reduction
        });
    }

    async updateStats(stats) {
        const current = await chrome.storage.sync.get(['pagesSimplified', 'totalTimeSaved']);
        
        await chrome.storage.sync.set({
            pagesSimplified: (current.pagesSimplified || 0) + (stats.pagesSimplified || 0),
            totalTimeSaved: (current.totalTimeSaved || 0) + (stats.timeSaved || 0)
        });
    }
}

// Initialize background service
new WebSimplifyBackground();
