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
        this.updateUI();
        this.checkPageComplexity();
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

        // Help modal
        document.getElementById('closeHelp').addEventListener('click', () => {
            this.closeHelp();
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
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WebSimplifyPopup();
});
