// WebSimplify Pro - Popup Script
class WebSimplifyPopup {
    constructor() {
        this.currentTab = null;
        this.isSimplified = false;
        this.complexityScore = 0;
        this.init();
    }

    async init() {
        await this.getCurrentTab();
        await this.loadUserPreferences();
        this.setupEventListeners();
        this.setupAccessibilityFeatures();
        this.updateUI();
        this.checkPageComplexity();
    }

    setupAccessibilityFeatures() {
        // Setup live region for screen reader announcements
        this.createLiveRegion();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Setup focus management
        this.setupFocusManagement();
        
        // Setup ARIA updates
        this.setupARIAUpdates();
    }

    createLiveRegion() {
        this.liveRegion = document.createElement('div');
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        this.liveRegion.className = 'sr-only';
        document.body.appendChild(this.liveRegion);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt + S: Toggle simplification
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                this.announceToScreenReader('Toggling page simplification');
                this.toggleSimplification();
            }

            // Alt + R: Reset to original
            if (e.altKey && e.key === 'r') {
                e.preventDefault();
                this.announceToScreenReader('Resetting to original content');
                this.resetPage();
            }

            // Alt + H: Toggle heatmap
            if (e.altKey && e.key === 'h') {
                e.preventDefault();
                this.announceToScreenReader('Toggling complexity heatmap');
                this.toggleHeatmap();
            }

            // Escape: Close modals
            if (e.key === 'Escape') {
                this.closeActiveModals();
            }
        });
    }

    setupFocusManagement() {
        // Ensure proper focus order
        const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        focusableElements.forEach((element, index) => {
            element.setAttribute('tabindex', index === 0 ? '0' : '0');
        });
    }

    setupARIAUpdates() {
        // Update button states with ARIA
        const buttons = document.querySelectorAll('button[aria-pressed]');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const isPressed = button.getAttribute('aria-pressed') === 'true';
                button.setAttribute('aria-pressed', !isPressed);
                
                const action = button.textContent.trim();
                this.announceToScreenReader(`${action} ${!isPressed ? 'activated' : 'deactivated'}`);
            });
        });
    }

    announceToScreenReader(message, priority = 'polite') {
        if (this.liveRegion) {
            this.liveRegion.setAttribute('aria-live', priority);
            this.liveRegion.textContent = message;
            
            // Clear after announcement
            setTimeout(() => {
                this.liveRegion.textContent = '';
            }, 1000);
        }
    }

    closeActiveModals() {
        const modals = document.querySelectorAll('[role="dialog"]');
        modals.forEach(modal => {
            if (modal.style.display !== 'none') {
                const closeBtn = modal.querySelector('.modal-close');
                if (closeBtn) {
                    closeBtn.click();
                    this.announceToScreenReader('Modal closed');
                }
            }
        });
    }

    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
    }

    async loadUserPreferences() {
        const result = await chrome.storage.sync.get({
            simplificationLevel: 2,
            pagesSimplified: 0,
            totalTimeSaved: 0,
            analytics: []
        });
        
        this.preferences = result;
        document.getElementById('levelSlider').value = result.simplificationLevel;
        document.getElementById('pagesSimplified').textContent = result.pagesSimplified;
        document.getElementById('timeSavedTotal').textContent = result.totalTimeSaved;
    }

    async openDashboard() {
        // Load analytics data
        const analytics = await this.loadAnalytics();
        
        // Show modal
        document.getElementById('dashboardModal').style.display = 'flex';
        
        // Populate dashboard
        this.populateDashboard(analytics);
    }

    closeDashboard() {
        document.getElementById('dashboardModal').style.display = 'none';
    }

    async loadAnalytics() {
        const result = await chrome.storage.sync.get({
            analytics: [],
            pagesSimplified: 0,
            totalTimeSaved: 0
        });
        
        return result;
    }

    populateDashboard(data) {
        // Update main stats
        document.getElementById('dashTotalPages').textContent = data.pagesSimplified;
        document.getElementById('dashTotalTime').textContent = data.totalTimeSaved;
        
        // Calculate analytics from stored data
        const analytics = data.analytics || [];
        
        if (analytics.length > 0) {
            // Average complexity
            const complexityEntries = analytics.filter(a => a.type === 'page_analyzed');
            const avgComplexity = complexityEntries.length > 0 
                ? (complexityEntries.reduce((sum, a) => sum + a.complexity, 0) / complexityEntries.length).toFixed(1)
                : '0';
            document.getElementById('dashAvgComplexity').textContent = avgComplexity;
            
            // Average reduction
            const simplificationEntries = analytics.filter(a => a.type === 'page_simplified');
            const avgReduction = simplificationEntries.length > 0
                ? Math.round(simplificationEntries.reduce((sum, a) => sum + (a.reduction / a.originalLength * 100), 0) / simplificationEntries.length)
                : 0;
            document.getElementById('dashAvgReduction').textContent = avgReduction + '%';
            
            // Domain analysis
            this.populateDomainStats(complexityEntries);
            
            // Recent activity
            this.populateRecentActivity(analytics.slice(-10));
        }
    }

    populateDomainStats(complexityEntries) {
        const domainStats = {};
        
        complexityEntries.forEach(entry => {
            if (!domainStats[entry.domain]) {
                domainStats[entry.domain] = { count: 0, totalComplexity: 0 };
            }
            domainStats[entry.domain].count++;
            domainStats[entry.domain].totalComplexity += entry.complexity;
        });
        
        const domainContainer = document.getElementById('domainStats');
        domainContainer.innerHTML = '';
        
        Object.entries(domainStats)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5)
            .forEach(([domain, stats]) => {
                const avgComplexity = (stats.totalComplexity / stats.count).toFixed(1);
                const domainElement = document.createElement('div');
                domainElement.className = 'domain-item';
                domainElement.innerHTML = `
                    <div class="domain-name">${this.formatDomainName(domain)}</div>
                    <div class="domain-metrics">
                        <span class="domain-count">${stats.count} pages</span>
                        <span class="domain-complexity">Avg: ${avgComplexity}/10</span>
                    </div>
                `;
                domainContainer.appendChild(domainElement);
            });
    }

    populateRecentActivity(recentAnalytics) {
        const activityContainer = document.getElementById('activityList');
        activityContainer.innerHTML = '';
        
        recentAnalytics.reverse().forEach(activity => {
            const activityElement = document.createElement('div');
            activityElement.className = 'activity-item';
            
            const timeAgo = this.formatTimeAgo(activity.timestamp);
            const actionText = activity.type === 'page_analyzed' 
                ? `Analyzed ${this.formatDomainName(activity.domain)} page (${activity.complexity}/10)`
                : `Simplified ${this.formatDomainName(activity.domain)} page (Level ${activity.level})`;
            
            activityElement.innerHTML = `
                <div class="activity-action">${actionText}</div>
                <div class="activity-time">${timeAgo}</div>
            `;
            activityContainer.appendChild(activityElement);
        });
    }

    formatDomainName(domain) {
        const domainNames = {
            'wikipedia': 'Wikipedia',
            'academic': 'Academic',
            'medical': 'Medical',
            'legal': 'Legal',
            'technical': 'Technical',
            'government': 'Government',
            'finance': 'Finance',
            'news': 'News',
            'general': 'General'
        };
        return domainNames[domain] || domain;
    }

    setupModalEventListeners() {
        // Dashboard modal
        document.getElementById('closeDashboard').addEventListener('click', () => {
            this.closeDashboard();
        });
        document.querySelector('#dashboardModal .modal-overlay').addEventListener('click', () => {
            this.closeDashboard();
        });

        // Batch modal
        document.getElementById('closeBatch').addEventListener('click', () => {
            this.closeBatchModal();
        });
        document.getElementById('cancelBatch').addEventListener('click', () => {
            this.closeBatchModal();
        });
        document.getElementById('startBatch').addEventListener('click', () => {
            this.startBatchProcessing();
        });
        document.getElementById('selectAllTabs').addEventListener('change', (e) => {
            this.toggleAllTabs(e.target.checked);
        });

        // Export modal
        document.getElementById('closeExport').addEventListener('click', () => {
            this.closeExportModal();
        });
        document.getElementById('cancelExport').addEventListener('click', () => {
            this.closeExportModal();
        });
        document.getElementById('startExport').addEventListener('click', () => {
            this.startExport();
        });

        // Export tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchExportTab(e.target.dataset.tab);
            });
        });

        // Share buttons
        document.getElementById('shareEmail').addEventListener('click', () => {
            this.shareContent('email');
        });
        document.getElementById('shareClipboard').addEventListener('click', () => {
            this.shareContent('clipboard');
        });
        document.getElementById('shareSocial').addEventListener('click', () => {
            this.shareContent('social');
        });
        document.getElementById('sharePrint').addEventListener('click', () => {
            this.shareContent('print');
        });

        // Share format change
        document.querySelectorAll('input[name="shareFormat"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateSharePreview();
            });
        });

        // Help modal
        document.getElementById('closeHelp').addEventListener('click', () => {
            this.closeHelp();
        });

        // Learning modal
        document.getElementById('closeLearning').addEventListener('click', () => {
            this.closeLearningMode();
        });
        document.getElementById('generateExample').addEventListener('click', () => {
            this.generateNewExample();
        });

        // Confidence modal
        document.getElementById('confidenceIndicator').addEventListener('click', () => {
            this.openConfidenceAnalysis();
        });
        document.getElementById('closeConfidence').addEventListener('click', () => {
            this.closeConfidenceAnalysis();
        });

        // Feedback buttons
        document.getElementById('feedbackPositive').addEventListener('click', () => {
            this.showFeedbackComment(true);
        });
        document.getElementById('feedbackNegative').addEventListener('click', () => {
            this.showFeedbackComment(false);
        });
        document.getElementById('submitFeedback').addEventListener('click', () => {
            this.submitUserFeedback();
        });
        document.getElementById('closeProfile').addEventListener('click', () => {
            this.closeProfileSetup();
        });
        document.getElementById('saveProfile').addEventListener('click', () => {
            this.saveUserProfile();
        });
        document.getElementById('resetProfile').addEventListener('click', () => {
            this.resetUserProfile();
        });
    }

    openHelp() {
        document.getElementById('helpModal').style.display = 'flex';
    }

    closeHelp() {
        document.getElementById('helpModal').style.display = 'none';
    }

    async openBatchModal() {
        // Get all tabs
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const validTabs = tabs.filter(tab => 
            tab.url.startsWith('http') && 
            !tab.url.includes('chrome://') &&
            !tab.url.includes('chrome-extension://')
        );

        // Populate tab list
        const tabList = document.getElementById('tabList');
        tabList.innerHTML = '';

        validTabs.forEach(tab => {
            const tabItem = document.createElement('div');
            tabItem.className = 'tab-item';
            tabItem.innerHTML = `
                <label class="tab-checkbox">
                    <input type="checkbox" value="${tab.id}" ${tab.id === this.currentTab.id ? 'checked' : ''}>
                    <div class="tab-info">
                        <div class="tab-title">${tab.title}</div>
                        <div class="tab-url">${new URL(tab.url).hostname}</div>
                    </div>
                </label>
            `;
            tabList.appendChild(tabItem);
        });

        document.getElementById('batchModal').style.display = 'flex';
    }

    closeBatchModal() {
        document.getElementById('batchModal').style.display = 'none';
        document.getElementById('batchProgress').style.display = 'none';
    }

    toggleAllTabs(checked) {
        const checkboxes = document.querySelectorAll('#tabList input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    async startBatchProcessing() {
        const selectedTabs = Array.from(document.querySelectorAll('#tabList input[type="checkbox"]:checked'))
            .map(cb => parseInt(cb.value));
        
        if (selectedTabs.length === 0) {
            this.showStatus('Please select at least one tab', 'error');
            return;
        }

        const level = parseInt(document.getElementById('batchLevel').value);
        
        // Show progress
        document.getElementById('batchProgress').style.display = 'block';
        document.querySelector('.batch-section').style.display = 'none';
        document.querySelector('.batch-controls').style.display = 'none';

        let processed = 0;
        const total = selectedTabs.length;
        
        for (const tabId of selectedTabs) {
            try {
                // Update progress
                document.getElementById('progressCounter').textContent = `${processed}/${total}`;
                document.getElementById('progressFill').style.width = `${(processed / total) * 100}%`;
                
                const tab = await chrome.tabs.get(tabId);
                document.getElementById('currentTab').textContent = `Processing: ${tab.title}`;

                // Simplify tab
                await chrome.tabs.sendMessage(tabId, {
                    action: 'simplifyPage',
                    level: level
                });

                processed++;
                
                // Small delay between tabs
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Failed to process tab ${tabId}:`, error);
                processed++;
            }
        }

        // Complete
        document.getElementById('progressCounter').textContent = `${total}/${total}`;
        document.getElementById('progressFill').style.width = '100%';
        document.getElementById('currentTab').textContent = 'Batch processing complete!';

        setTimeout(() => {
            this.closeBatchModal();
            this.showStatus(`Successfully processed ${total} tabs`, 'success');
        }, 1500);
    }

    async openExportModal() {
        if (!this.isSimplified) {
            this.showStatus('Please simplify the page first', 'error');
            return;
        }
        
        document.getElementById('exportModal').style.display = 'flex';
    }

    closeExportModal() {
        document.getElementById('exportModal').style.display = 'none';
    }

    async startExport() {
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        const includeOriginal = document.getElementById('includeOriginal').checked;
        const includeMetrics = document.getElementById('includeMetrics').checked;
        const includeTimestamp = document.getElementById('includeTimestamp').checked;

        try {
            // Get content from current tab
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'getExportData',
                options: {
                    includeOriginal,
                    includeMetrics,
                    includeTimestamp
                }
            });

            if (response && response.data) {
                await this.downloadContent(response.data, format);
                this.closeExportModal();
                this.showStatus(`Content exported as ${format.toUpperCase()}`, 'success');
            } else {
                throw new Error('Failed to get export data');
            }
        } catch (error) {
            this.showStatus('Export failed. Please try again.', 'error');
        }
    }

    async downloadContent(data, format) {
        let content, filename, mimeType;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const title = data.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);

        switch (format) {
            case 'pdf':
                content = this.generatePDF(data);
                filename = `${title}_simplified_${timestamp}.pdf`;
                mimeType = 'application/pdf';
                break;
            case 'html':
                content = this.generateHTML(data);
                filename = `${title}_simplified_${timestamp}.html`;
                mimeType = 'text/html';
                break;
            case 'txt':
                content = this.generateText(data);
                filename = `${title}_simplified_${timestamp}.txt`;
                mimeType = 'text/plain';
                break;
            case 'md':
                content = this.generateMarkdown(data);
                filename = `${title}_simplified_${timestamp}.md`;
                mimeType = 'text/markdown';
                break;
        }

        // Create download
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    generateHTML(data) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title} - Simplified</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
        .metrics { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .original { background: #fff3cd; padding: 15px; border-radius: 8px; }
        .simplified { background: #d4edda; padding: 15px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${data.title}</h1>
        ${data.includeTimestamp ? `<p><strong>Simplified:</strong> ${new Date().toLocaleString()}</p>` : ''}
        ${data.includeTimestamp ? `<p><strong>Source:</strong> ${data.url}</p>` : ''}
    </div>
    
    ${data.includeMetrics ? `
    <div class="metrics">
        <h2>Reading Metrics</h2>
        <p><strong>Original reading time:</strong> ${data.metrics.before} minutes</p>
        <p><strong>Simplified reading time:</strong> ${data.metrics.after} minutes</p>
        <p><strong>Time saved:</strong> ${data.metrics.saved} minutes</p>
        <p><strong>Complexity reduction:</strong> ${data.metrics.complexityReduction} points</p>
    </div>
    ` : ''}
    
    ${data.includeOriginal ? `
    <div class="comparison">
        <div class="original">
            <h3>Original Content</h3>
            <div>${data.originalContent}</div>
        </div>
        <div class="simplified">
            <h3>Simplified Content</h3>
            <div>${data.simplifiedContent}</div>
        </div>
    </div>
    ` : `
    <div class="content">
        <h2>Simplified Content</h2>
        <div>${data.simplifiedContent}</div>
    </div>
    `}
</body>
</html>`;
    }

    generateText(data) {
        let content = `${data.title}\n${'='.repeat(data.title.length)}\n\n`;
        
        if (data.includeTimestamp) {
            content += `Simplified: ${new Date().toLocaleString()}\n`;
            content += `Source: ${data.url}\n\n`;
        }
        
        if (data.includeMetrics) {
            content += `READING METRICS\n`;
            content += `Original reading time: ${data.metrics.before} minutes\n`;
            content += `Simplified reading time: ${data.metrics.after} minutes\n`;
            content += `Time saved: ${data.metrics.saved} minutes\n`;
            content += `Complexity reduction: ${data.metrics.complexityReduction} points\n\n`;
        }
        
        if (data.includeOriginal) {
            content += `ORIGINAL CONTENT\n${'-'.repeat(16)}\n${data.originalText}\n\n`;
            content += `SIMPLIFIED CONTENT\n${'-'.repeat(18)}\n${data.simplifiedText}\n`;
        } else {
            content += `SIMPLIFIED CONTENT\n${'-'.repeat(18)}\n${data.simplifiedText}\n`;
        }
        
        return content;
    }

    generateMarkdown(data) {
        let content = `# ${data.title}\n\n`;
        
        if (data.includeTimestamp) {
            content += `**Simplified:** ${new Date().toLocaleString()}  \n`;
            content += `**Source:** ${data.url}\n\n`;
        }
        
        if (data.includeMetrics) {
            content += `## Reading Metrics\n\n`;
            content += `- **Original reading time:** ${data.metrics.before} minutes\n`;
            content += `- **Simplified reading time:** ${data.metrics.after} minutes\n`;
            content += `- **Time saved:** ${data.metrics.saved} minutes\n`;
            content += `- **Complexity reduction:** ${data.metrics.complexityReduction} points\n\n`;
        }
        
        if (data.includeOriginal) {
            content += `## Original Content\n\n${data.originalText}\n\n`;
            content += `## Simplified Content\n\n${data.simplifiedText}\n`;
        } else {
            content += `## Simplified Content\n\n${data.simplifiedText}\n`;
        }
        
        return content;
    }

    generatePDF(data) {
        // For PDF generation, we'll create HTML and let the browser handle it
        // In a real implementation, you'd use a PDF library like jsPDF
        return this.generateHTML(data);
    }

    setupEventListeners() {
        // Main simplify button
        document.getElementById('simplifyBtn').addEventListener('click', () => {
            this.toggleSimplification();
        });

        // Simplification level slider
        document.getElementById('levelSlider').addEventListener('input', (e) => {
            this.updateSimplificationLevel(parseInt(e.target.value));
        });

        // Quick action buttons
        document.getElementById('splitViewBtn').addEventListener('click', () => {
            this.toggleSplitView();
        });

        document.getElementById('heatmapBtn').addEventListener('click', () => {
            this.toggleHeatmap();
        });

        document.getElementById('learningBtn').addEventListener('click', () => {
            this.openLearningMode();
        });

        document.getElementById('profileBtn').addEventListener('click', () => {
            this.openProfileSetup();
        });

        document.getElementById('batchBtn').addEventListener('click', () => {
            this.openBatchModal();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.openExportModal();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetPage();
        });

        // Dashboard button
        document.getElementById('dashboardBtn').addEventListener('click', () => {
            this.openDashboard();
        });

        // Help button
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.openHelp();
        });

        // Modal event listeners
        this.setupModalEventListeners();
    }

    async checkPageComplexity() {
        try {
            // Send message to content script to analyze page complexity
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'analyzeComplexity'
            });

            if (response && response.complexity) {
                this.updateComplexityScore(response.complexity);
            }
        } catch (error) {
            console.log('Content script not ready yet');
            // Retry after a short delay
            setTimeout(() => this.checkPageComplexity(), 1000);
        }
    }

    updateComplexityScore(score) {
        this.complexityScore = score;
        const scoreElement = document.getElementById('complexityScore');
        const indicator = document.getElementById('complexityIndicator');
        
        scoreElement.textContent = score;
        
        // Update color based on complexity
        if (score <= 3) {
            indicator.style.color = '#4CAF50'; // Green
        } else if (score <= 6) {
            indicator.style.color = '#FF9800'; // Orange
        } else {
            indicator.style.color = '#f44336'; // Red
        }

        // Update extension badge
        chrome.action.setBadgeText({
            text: score.toString(),
            tabId: this.currentTab.id
        });

        const badgeColor = score <= 3 ? '#4CAF50' : score <= 6 ? '#FF9800' : '#f44336';
        chrome.action.setBadgeBackgroundColor({
            color: badgeColor,
            tabId: this.currentTab.id
        });
    }

    async toggleSimplification() {
        const btn = document.getElementById('simplifyBtn');
        const btnText = btn.querySelector('.btn-text');
        const btnIcon = btn.querySelector('.btn-icon');

        if (!this.isSimplified) {
            // Start simplification with enhanced error handling
            btn.classList.add('processing');
            btnText.textContent = 'Simplifying...';
            btnIcon.textContent = '⏳';

            try {
                // Check if content script is ready
                await this.ensureContentScriptReady();
                
                const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                    action: 'simplifyPage',
                    level: this.preferences.simplificationLevel
                });

                if (response && response.success) {
                    this.isSimplified = true;
                    btn.classList.remove('processing');
                    btn.classList.add('completed');
                    btnText.textContent = 'Restore Original';
                    btnIcon.textContent = '↺';

                    // Show additional controls with animation
                    this.showControlsWithAnimation();

                    // Update reading time
                    this.updateReadingTime(response.readingTime);

                    // Update stats
                    await this.updateStats();

                    this.showStatus('Page simplified successfully! Use Alt+S to toggle.', 'success');
                } else {
                    throw new Error('Simplification failed');
                }
            } catch (error) {
                btn.classList.remove('processing');
                btnText.textContent = 'Simplify Page';
                btnIcon.textContent = '🧠';
                
                // Enhanced error messages
                let errorMessage = 'Failed to simplify page.';
                if (error.message.includes('Could not establish connection')) {
                    errorMessage = 'Please refresh the page and try again.';
                } else if (error.message.includes('No main content')) {
                    errorMessage = 'No content found to simplify on this page.';
                }
                
                this.showStatus(errorMessage, 'error');
            }
        } else {
            // Restore original with confirmation
            try {
                await chrome.tabs.sendMessage(this.currentTab.id, {
                    action: 'restoreOriginal'
                });

                this.isSimplified = false;
                btn.classList.remove('completed');
                btnText.textContent = 'Simplify Page';
                btnIcon.textContent = '🧠';

                // Hide additional controls with animation
                this.hideControlsWithAnimation();

                this.showStatus('Original content restored', 'info');
            } catch (error) {
                this.showStatus('Failed to restore original content', 'error');
            }
        }
    }

    async ensureContentScriptReady() {
        let retries = 3;
        while (retries > 0) {
            try {
                await chrome.tabs.sendMessage(this.currentTab.id, { action: 'ping' });
                return;
            } catch (error) {
                retries--;
                if (retries === 0) {
                    // Inject content script
                    await chrome.scripting.executeScript({
                        target: { tabId: this.currentTab.id },
                        files: ['src/content/content-script.js']
                    });
                    // Wait a bit for initialization
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
    }

    showControlsWithAnimation() {
        const controls = ['levelControl', 'readingTime', 'quickActions'];
        controls.forEach((id, index) => {
            const element = document.getElementById(id);
            element.style.display = 'block';
            element.style.opacity = '0';
            element.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                element.style.transition = 'all 0.3s ease';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    hideControlsWithAnimation() {
        const controls = ['levelControl', 'readingTime', 'quickActions'];
        controls.forEach((id, index) => {
            const element = document.getElementById(id);
            element.style.transition = 'all 0.3s ease';
            element.style.opacity = '0';
            element.style.transform = 'translateY(-10px)';
            
            setTimeout(() => {
                element.style.display = 'none';
            }, 300);
        });
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('statusMessage');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.style.display = 'block';

        // Enhanced status styling
        statusElement.style.opacity = '0';
        statusElement.style.transform = 'translateY(-10px)';
        
        requestAnimationFrame(() => {
            statusElement.style.transition = 'all 0.3s ease';
            statusElement.style.opacity = '1';
            statusElement.style.transform = 'translateY(0)';
        });

        // Auto-hide with fade out
        setTimeout(() => {
            statusElement.style.opacity = '0';
            statusElement.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 300);
        }, type === 'error' ? 5000 : 3000);
    }

    async updateSimplificationLevel(level) {
        this.preferences.simplificationLevel = level;
        
        // Save to storage
        await chrome.storage.sync.set({ simplificationLevel: level });

        // If page is already simplified, re-simplify with new level
        if (this.isSimplified) {
            try {
                await chrome.tabs.sendMessage(this.currentTab.id, {
                    action: 'updateSimplificationLevel',
                    level: level
                });
            } catch (error) {
                console.error('Failed to update simplification level:', error);
            }
        }
    }

    updateReadingTime(timeData) {
        if (timeData && timeData.detailed) {
            const detailed = timeData.detailed;
            
            // Update basic display
            document.getElementById('timeBefore').textContent = `${timeData.before} min`;
            document.getElementById('timeAfter').textContent = `${timeData.after} min`;
            document.getElementById('timeSaved').textContent = `${timeData.saved} min`;
            
            // Add detailed metrics
            const readingTimeContainer = document.getElementById('readingTime');
            
            // Remove existing detailed info
            const existingDetails = readingTimeContainer.querySelector('.reading-details');
            if (existingDetails) {
                existingDetails.remove();
            }
            
            // Create detailed metrics
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'reading-details';
            detailsDiv.innerHTML = `
                <div class="detail-row">
                    <span class="detail-label">Word count:</span>
                    <span class="detail-value">${detailed.wordCount.original} → ${detailed.wordCount.simplified}</span>
                    ${detailed.wordCount.reduction > 0 ? `<span class="improvement">-${detailed.wordCount.reduction}</span>` : ''}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Complexity:</span>
                    <span class="detail-value">Reduced by ${detailed.complexityReduction} points</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Comprehension:</span>
                    <span class="detail-value improvement">+${detailed.comprehensionBoost}% easier</span>
                </div>
                <div class="reading-speeds">
                    <div class="speed-option">
                        <span class="speed-label">Slow reader:</span>
                        <span class="speed-value">${detailed.saved.slow}min saved</span>
                    </div>
                    <div class="speed-option">
                        <span class="speed-label">Fast reader:</span>
                        <span class="speed-value">${detailed.saved.fast}min saved</span>
                    </div>
                </div>
            `;
            
            readingTimeContainer.appendChild(detailsDiv);
        } else if (timeData) {
            // Fallback to basic display
            document.getElementById('timeBefore').textContent = `${timeData.before} min`;
            document.getElementById('timeAfter').textContent = `${timeData.after} min`;
            document.getElementById('timeSaved').textContent = `${timeData.saved} min`;
        }
    }

    async updateStats() {
        this.preferences.pagesSimplified += 1;
        await chrome.storage.sync.set({ 
            pagesSimplified: this.preferences.pagesSimplified 
        });
        
        document.getElementById('pagesSimplified').textContent = this.preferences.pagesSimplified;
        document.getElementById('stats').style.display = 'block';
    }

    async toggleSplitView() {
        try {
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'toggleSplitView'
            });
            
            if (response && response.success) {
                const btn = document.getElementById('splitViewBtn');
                const btnText = btn.querySelector('.btn-text');
                const btnIcon = btn.querySelector('.btn-icon');
                
                // Toggle button state
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    btnText.textContent = 'Split View';
                    btnIcon.textContent = '⚖️';
                    this.showStatus('Split view disabled', 'info');
                } else {
                    btn.classList.add('active');
                    btnText.textContent = 'Exit Split';
                    btnIcon.textContent = '📱';
                    this.showStatus('Split view enabled - compare original vs simplified', 'success');
                }
            }
        } catch (error) {
            this.showStatus('Split view not available', 'error');
        }
    }

    async toggleHeatmap() {
        try {
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'toggleHeatmap'
            });
            
            if (response && response.success) {
                const btn = document.getElementById('heatmapBtn');
                const btnText = btn.querySelector('.btn-text');
                const btnIcon = btn.querySelector('.btn-icon');
                
                // Toggle button state
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    btnText.textContent = 'Heatmap';
                    btnIcon.textContent = '🔥';
                    this.showStatus('Complexity heatmap disabled', 'info');
                } else {
                    btn.classList.add('active');
                    btnText.textContent = 'Hide Map';
                    btnIcon.textContent = '🗺️';
                    this.showStatus('Complexity heatmap enabled - click sections to simplify', 'success');
                }
            }
        } catch (error) {
            this.showStatus('Heatmap not available', 'error');
        }
    }

    async resetPage() {
        try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'resetPage'
            });
            
            // Reset popup state
            this.isSimplified = false;
            const btn = document.getElementById('simplifyBtn');
            btn.classList.remove('completed', 'processing');
            btn.querySelector('.btn-text').textContent = 'Simplify Page';
            btn.querySelector('.btn-icon').textContent = '🧠';

            // Reset action button states
            const splitBtn = document.getElementById('splitViewBtn');
            const heatmapBtn = document.getElementById('heatmapBtn');
            
            splitBtn.classList.remove('active');
            splitBtn.querySelector('.btn-text').textContent = 'Split View';
            splitBtn.querySelector('.btn-icon').textContent = '⚖️';
            
            heatmapBtn.classList.remove('active');
            heatmapBtn.querySelector('.btn-text').textContent = 'Heatmap';
            heatmapBtn.querySelector('.btn-icon').textContent = '🔥';

            // Hide controls
            document.getElementById('levelControl').style.display = 'none';
            document.getElementById('readingTime').style.display = 'none';
            document.getElementById('quickActions').style.display = 'none';

            this.showStatus('Page reset to original state', 'info');
        } catch (error) {
            this.showStatus('Failed to reset page', 'error');
        }
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('statusMessage');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.style.display = 'block';

        // Hide after 3 seconds
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }

    updateUI() {
        // Update UI based on current state
        if (this.isSimplified) {
            document.getElementById('levelControl').style.display = 'block';
            document.getElementById('quickActions').style.display = 'flex';
        }
    }

    // Learning Mode Methods
    openLearningMode() {
        document.getElementById('learningModal').style.display = 'flex';
        this.initializeLearningMode();
    }

    async togglePageLearningMode() {
        try {
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'toggleLearningMode'
            });

            if (response && response.success) {
                this.showStatus('Learning mode toggled', 'success');
            } else {
                this.showStatus('Failed to toggle learning mode', 'error');
            }
        } catch (error) {
            this.showStatus('Learning mode not available on this page', 'error');
        }
    }

    closeLearningMode() {
        document.getElementById('learningModal').style.display = 'none';
        this.updateLearningProgress();
    }

    async initializeLearningMode() {
        const progress = await chrome.storage.sync.get({
            conceptsLearned: 0,
            examplesViewed: 0,
            learningTime: 0
        });

        document.getElementById('conceptsLearned').textContent = progress.conceptsLearned;
        document.getElementById('examplesViewed').textContent = progress.examplesViewed;
        document.getElementById('learningTime').textContent = Math.floor(progress.learningTime / 60000);

        this.learningStartTime = Date.now();
    }

    generateNewExample() {
        const examples = [
            {
                original: "The implementation of quantum computational algorithms necessitates sophisticated mathematical frameworks.",
                simplified: "Quantum computers need complex math to work.",
                originalComplexity: 8,
                simplifiedComplexity: 3
            },
            {
                original: "Artificial intelligence technologies have precipitated unprecedented organizational transformations.",
                simplified: "AI is changing how companies work in new ways.",
                originalComplexity: 9,
                simplifiedComplexity: 2
            }
        ];

        const example = examples[Math.floor(Math.random() * examples.length)];
        
        document.getElementById('originalExample').textContent = example.original;
        document.getElementById('simplifiedExample').textContent = example.simplified;
        
        document.querySelector('.example-original h4').textContent = `Original (Complexity: ${example.originalComplexity}/10)`;
        document.querySelector('.example-simplified h4').textContent = `Simplified (Complexity: ${example.simplifiedComplexity}/10)`;

        this.incrementExamplesViewed();
    }

    async incrementExamplesViewed() {
        const result = await chrome.storage.sync.get({ examplesViewed: 0 });
        await chrome.storage.sync.set({ examplesViewed: result.examplesViewed + 1 });
        document.getElementById('examplesViewed').textContent = result.examplesViewed + 1;
    }

    async updateLearningProgress() {
        if (!this.learningStartTime) return;

        const sessionTime = Date.now() - this.learningStartTime;
        const result = await chrome.storage.sync.get({ learningTime: 0, conceptsLearned: 0 });

        await chrome.storage.sync.set({ 
            learningTime: result.learningTime + sessionTime,
            conceptsLearned: result.conceptsLearned + 1
        });
    }

    // Profile Setup Methods
    async openProfileSetup() {
        document.getElementById('profileModal').style.display = 'flex';
        await this.loadUserProfile();
        this.populateProfileForm();
        this.updateDomainStats();
    }

    closeProfileSetup() {
        document.getElementById('profileModal').style.display = 'none';
    }

    async loadUserProfile() {
        const profile = await chrome.storage.sync.get({
            userProfile: {
                experienceLevel: 'intermediate',
                domains: {},
                preferences: {
                    technicalTerms: 'simplify',
                    sentenceLength: 'medium',
                    explanationDepth: 'moderate'
                }
            }
        });

        this.userProfile = profile.userProfile;
    }

    populateProfileForm() {
        // Set experience level
        const experienceRadio = document.querySelector(`input[name="experience"][value="${this.userProfile.experienceLevel}"]`);
        if (experienceRadio) experienceRadio.checked = true;

        // Set preferences
        document.getElementById('technicalTerms').value = this.userProfile.preferences.technicalTerms;
        document.getElementById('sentenceLength').value = this.userProfile.preferences.sentenceLength;
        document.getElementById('explanationDepth').value = this.userProfile.preferences.explanationDepth;
    }

    updateDomainStats() {
        const domains = ['academic', 'legal', 'technical', 'medical'];
        
        domains.forEach(domain => {
            const domainData = this.userProfile.domains[domain];
            const level = this.calculateDomainLevel(domainData);
            const levelElement = document.getElementById(`${domain}Level`);
            if (levelElement) {
                levelElement.textContent = level;
                levelElement.className = `stat-level ${level.toLowerCase()}`;
            }
        });
    }

    calculateDomainLevel(domainData) {
        if (!domainData) return 'Novice';
        
        const visitScore = Math.min(domainData.visitCount / 20, 1);
        const timeScore = Math.min(domainData.timeSpent / 3600000, 1);
        const complexityScore = Math.min(domainData.complexityHandled / 10, 1);
        const totalScore = (visitScore + timeScore + complexityScore) / 3;
        
        if (totalScore < 0.3) return 'Novice';
        if (totalScore < 0.7) return 'Familiar';
        return 'Expert';
    }

    async saveUserProfile() {
        // Get experience level
        const experienceLevel = document.querySelector('input[name="experience"]:checked')?.value || 'intermediate';
        
        // Get preferences
        const preferences = {
            technicalTerms: document.getElementById('technicalTerms').value,
            sentenceLength: document.getElementById('sentenceLength').value,
            explanationDepth: document.getElementById('explanationDepth').value
        };

        // Update profile
        this.userProfile.experienceLevel = experienceLevel;
        this.userProfile.preferences = preferences;

        // Save to storage
        await chrome.storage.sync.set({ userProfile: this.userProfile });

        // Show success message
        this.showStatus('Profile saved successfully!', 'success');
        this.closeProfileSetup();
    }

    async resetUserProfile() {
        const defaultProfile = {
            experienceLevel: 'intermediate',
            domains: {},
            preferences: {
                technicalTerms: 'simplify',
                sentenceLength: 'medium',
                explanationDepth: 'moderate'
            }
        };

        await chrome.storage.sync.set({ userProfile: defaultProfile });
        this.userProfile = defaultProfile;
        this.populateProfileForm();
        this.updateDomainStats();
        this.showStatus('Profile reset to defaults', 'info');
    }

    // Enhanced Export & Share Methods
    switchExportTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`${tabName}-tab`).style.display = 'block';

        // Update share preview if switching to share tab
        if (tabName === 'share') {
            this.updateSharePreview();
        }
    }

    async startExport() {
        try {
            // Get export options
            const format = document.querySelector('input[name="exportFormat"]:checked').value;
            const options = {
                includeOriginal: document.getElementById('includeOriginal').checked,
                includeMetrics: document.getElementById('includeMetrics').checked,
                includeTimestamp: document.getElementById('includeTimestamp').checked,
                includeImages: document.getElementById('includeImages').checked,
                preserveFormatting: document.getElementById('preserveFormatting').checked,
                accessibility: document.getElementById('accessibilityMode').checked
            };

            this.showStatus('Preparing export...', 'info');

            // Get content from current tab
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'getExportData',
                options: options
            });

            if (response && response.data) {
                // Load export manager if not already loaded
                if (!window.ExportManager) {
                    await this.loadExportManager();
                }

                const exportManager = new window.ExportManager();
                const result = await exportManager.exportContent(response.data, { format, ...options });

                if (result.success) {
                    this.showStatus(`Export completed: ${result.filename}`, 'success');
                    this.closeExportModal();
                } else {
                    this.showStatus('Export failed', 'error');
                }
            } else {
                this.showStatus('No content available for export', 'error');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showStatus('Export failed: ' + error.message, 'error');
        }
    }

    async shareContent(target) {
        try {
            const shareFormat = document.querySelector('input[name="shareFormat"]:checked').value;
            
            this.showStatus(`Preparing to share via ${target}...`, 'info');

            // Get content from current tab
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'getExportData',
                options: { format: shareFormat }
            });

            if (response && response.data) {
                // Load export manager if not already loaded
                if (!window.ExportManager) {
                    await this.loadExportManager();
                }

                const exportManager = new window.ExportManager();
                const result = await exportManager.shareContent(response.data, target, { format: shareFormat });

                if (result.success) {
                    this.showStatus(result.message, 'success');
                    if (target === 'clipboard') {
                        // Keep modal open for clipboard sharing
                        this.updateSharePreview();
                    } else {
                        this.closeExportModal();
                    }
                } else {
                    this.showStatus('Sharing failed', 'error');
                }
            } else {
                this.showStatus('No content available for sharing', 'error');
            }
        } catch (error) {
            console.error('Share error:', error);
            this.showStatus('Sharing failed: ' + error.message, 'error');
        }
    }

    async updateSharePreview() {
        try {
            const shareFormat = document.querySelector('input[name="shareFormat"]:checked').value;
            const previewElement = document.getElementById('sharePreview');

            // Get simplified content for preview
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'getExportData',
                options: { format: shareFormat }
            });

            if (response && response.data) {
                let previewText = '';
                
                switch (shareFormat) {
                    case 'text':
                        previewText = `${document.title}\n\n${response.data.simplifiedText.substring(0, 200)}...`;
                        break;
                    case 'markdown':
                        previewText = `# ${document.title}\n\n${response.data.simplifiedText.substring(0, 200)}...`;
                        break;
                    case 'html':
                        previewText = `<h1>${document.title}</h1>\n<p>${response.data.simplifiedText.substring(0, 200)}...</p>`;
                        break;
                }

                previewElement.textContent = previewText;
            } else {
                previewElement.textContent = 'No content available for preview';
            }
        } catch (error) {
            document.getElementById('sharePreview').textContent = 'Preview not available';
        }
    }

    async loadExportManager() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('src/utils/export-manager.js');
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Confidence Analysis Methods
    async openConfidenceAnalysis() {
        try {
            // Get confidence data from content script
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'getConfidenceAnalysis'
            });

            if (response && response.confidence) {
                this.displayConfidenceAnalysis(response.confidence);
                document.getElementById('confidenceModal').style.display = 'flex';
            } else {
                this.showStatus('No confidence data available', 'info');
            }
        } catch (error) {
            this.showStatus('Confidence analysis not available', 'error');
        }
    }

    closeConfidenceAnalysis() {
        document.getElementById('confidenceModal').style.display = 'none';
    }

    displayConfidenceAnalysis(confidenceData) {
        const { confidence, level, factors, flags, recommendations } = confidenceData;

        // Update confidence score display
        document.getElementById('confidenceValue').textContent = Math.round(confidence * 100) + '%';
        
        // Update confidence circle
        const circle = document.getElementById('confidenceCircle');
        const angle = confidence * 360;
        circle.style.setProperty('--confidence-angle', angle + 'deg');

        // Update confidence level
        const levelElement = document.getElementById('confidenceLevel');
        const levelText = levelElement.querySelector('.level-text');
        const levelDesc = levelElement.querySelector('.level-description');
        
        levelText.textContent = level.charAt(0).toUpperCase() + level.slice(1);
        levelDesc.textContent = this.getConfidenceLevelDescription(level);

        // Update factors
        this.updateConfidenceFactors(factors);

        // Update flags
        this.updateConfidenceFlags(flags);

        // Update recommendations
        this.updateConfidenceRecommendations(recommendations);
    }

    getConfidenceLevelDescription(level) {
        const descriptions = {
            high: 'AI is highly confident in this simplification',
            medium: 'AI is moderately confident in this simplification',
            low: 'AI has low confidence - manual review recommended'
        };
        return descriptions[level] || 'Confidence level unknown';
    }

    updateConfidenceFactors(factors) {
        const factorMappings = {
            textSimilarity: { element: 'similarityFactor', value: 'similarityValue' },
            complexityReduction: { element: 'complexityFactor', value: 'complexityValue' },
            uncertaintyScore: { element: 'uncertaintyFactor', value: 'uncertaintyValue' },
            aiModelConfidence: { element: 'aiConfidenceFactor', value: 'aiConfidenceValue' }
        };

        Object.entries(factorMappings).forEach(([factor, { element, value }]) => {
            const factorValue = factors[factor] || 0;
            const fillElement = document.getElementById(element);
            const valueElement = document.getElementById(value);

            if (fillElement && valueElement) {
                fillElement.style.width = (factorValue * 100) + '%';
                valueElement.textContent = Math.round(factorValue * 100) + '%';
            }
        });
    }

    updateConfidenceFlags(flags) {
        const flagsList = document.getElementById('flagsList');
        
        if (!flags || flags.length === 0) {
            flagsList.innerHTML = '<p class="no-flags">No confidence issues detected</p>';
            return;
        }

        flagsList.innerHTML = flags.map(flag => `
            <div class="flag-item ${flag.type}">
                <span class="flag-icon">${this.getFlagIcon(flag.type)}</span>
                <span class="flag-text">${flag.message}</span>
                <span class="flag-severity">${flag.severity}</span>
            </div>
        `).join('');
    }

    updateConfidenceRecommendations(recommendations) {
        const recommendationsList = document.getElementById('recommendationsList');
        
        if (!recommendations || recommendations.length === 0) {
            recommendationsList.innerHTML = '<p class="no-recommendations">No specific recommendations</p>';
            return;
        }

        recommendationsList.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item">
                <span class="recommendation-icon">💡</span>
                <span class="recommendation-text">${rec.message}</span>
            </div>
        `).join('');
    }

    getFlagIcon(type) {
        const icons = {
            warning: '⚠️',
            uncertainty: '❓',
            complexity: '🔍',
            similarity: '📊',
            ai_uncertainty: '🤖',
            error: '❌'
        };
        return icons[type] || '⚠️';
    }

    showFeedbackComment(isPositive) {
        this.currentFeedbackType = isPositive;
        document.getElementById('feedbackComment').style.display = 'block';
        document.getElementById('feedbackText').focus();
    }

    async submitUserFeedback() {
        try {
            const comment = document.getElementById('feedbackText').value;
            
            // Send feedback to content script
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'submitConfidenceFeedback',
                feedback: {
                    isPositive: this.currentFeedbackType,
                    comment: comment
                }
            });

            if (response && response.success) {
                this.showStatus('Thank you for your feedback!', 'success');
                this.closeConfidenceAnalysis();
            } else {
                this.showStatus('Failed to submit feedback', 'error');
            }
        } catch (error) {
            this.showStatus('Failed to submit feedback', 'error');
        }
    }

    updateConfidenceIndicator(confidenceData) {
        const indicator = document.getElementById('confidenceIndicator');
        const score = document.getElementById('confidenceScore');
        const flags = document.getElementById('confidenceFlags');

        if (confidenceData) {
            indicator.style.display = 'flex';
            score.textContent = Math.round(confidenceData.confidence * 100) + '%';
            
            // Update indicator color based on confidence level
            const level = confidenceData.level;
            if (level === 'high') {
                score.style.color = '#51cf66';
            } else if (level === 'medium') {
                score.style.color = '#ffa726';
            } else {
                score.style.color = '#ff6b6b';
            }

            // Show flags if any
            flags.innerHTML = '';
            if (confidenceData.flags && confidenceData.flags.length > 0) {
                confidenceData.flags.forEach(flag => {
                    const flagElement = document.createElement('div');
                    flagElement.className = `confidence-flag ${flag.type}`;
                    flagElement.title = flag.message;
                    flags.appendChild(flagElement);
                });
            }
        } else {
            indicator.style.display = 'none';
        }
    }
}
}
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WebSimplifyPopup();
});
