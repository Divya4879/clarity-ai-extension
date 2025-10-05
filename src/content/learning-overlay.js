// Learning Mode Overlay - Shows simplification rules in action
class LearningOverlay {
    constructor() {
        this.isActive = false;
        this.explanations = [];
        this.init();
    }

    init() {
        this.createOverlayElements();
        this.setupEventListeners();
    }

    createOverlayElements() {
        // Create learning overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'learning-overlay';
        this.overlay.className = 'learning-overlay';
        this.overlay.innerHTML = `
            <div class="learning-panel">
                <div class="learning-header">
                    <h3>🎓 Learning Mode Active</h3>
                    <button class="close-learning">×</button>
                </div>
                <div class="learning-content">
                    <div class="rule-explanation" id="currentRule">
                        <h4>Click on simplified text to see how it was changed!</h4>
                        <p>Hover over any simplified section to learn about the simplification rules applied.</p>
                    </div>
                    <div class="learning-stats">
                        <span class="stat">Rules Learned: <span id="rulesLearned">0</span></span>
                        <span class="stat">Examples Seen: <span id="examplesSeen">0</span></span>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .learning-overlay {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 320px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .learning-panel {
                padding: 16px;
            }

            .learning-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }

            .learning-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }

            .close-learning {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s;
            }

            .close-learning:hover {
                background-color: rgba(255, 255, 255, 0.2);
            }

            .rule-explanation h4 {
                margin: 0 0 8px 0;
                font-size: 14px;
                color: #51cf66;
            }

            .rule-explanation p {
                margin: 0;
                font-size: 13px;
                line-height: 1.4;
                opacity: 0.9;
            }

            .learning-stats {
                display: flex;
                justify-content: space-between;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.2);
            }

            .stat {
                font-size: 12px;
                opacity: 0.8;
            }

            .learning-highlight {
                background: linear-gradient(120deg, #a8edea 0%, #fed6e3 100%) !important;
                color: #333 !important;
                padding: 2px 4px !important;
                border-radius: 4px !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
                position: relative !important;
            }

            .learning-highlight:hover {
                transform: scale(1.02) !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
            }

            .learning-tooltip {
                position: absolute;
                background: #333;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                max-width: 250px;
                z-index: 10001;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                pointer-events: none;
            }

            .learning-tooltip::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 5px solid transparent;
                border-top-color: #333;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.overlay);
    }

    setupEventListeners() {
        // Close button
        this.overlay.querySelector('.close-learning').addEventListener('click', () => {
            this.deactivate();
        });

        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'toggleLearningMode') {
                if (this.isActive) {
                    this.deactivate();
                } else {
                    this.activate();
                }
                sendResponse({ success: true });
            }
        });
    }

    activate() {
        this.isActive = true;
        this.overlay.style.display = 'block';
        this.addLearningHighlights();
        this.updateStats();
    }

    deactivate() {
        this.isActive = false;
        this.overlay.style.display = 'none';
        this.removeLearningHighlights();
    }

    addLearningHighlights() {
        // Find all simplified elements
        const simplifiedElements = document.querySelectorAll('[data-simplified="true"]');
        
        simplifiedElements.forEach((element, index) => {
            element.classList.add('learning-highlight');
            
            // Add click handler for detailed explanation
            element.addEventListener('click', (e) => {
                e.preventDefault();
                this.showDetailedExplanation(element);
            });

            // Add hover handler for quick tooltip
            element.addEventListener('mouseenter', (e) => {
                this.showQuickTooltip(e, element);
            });

            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    removeLearningHighlights() {
        const highlights = document.querySelectorAll('.learning-highlight');
        highlights.forEach(element => {
            element.classList.remove('learning-highlight');
        });
        this.hideTooltip();
    }

    showDetailedExplanation(element) {
        const originalText = element.getAttribute('data-original-text') || 'Original text not available';
        const simplifiedText = element.textContent;
        const rule = this.getSimplificationRule(originalText, simplifiedText);

        const explanation = document.getElementById('currentRule');
        explanation.innerHTML = `
            <h4>🔍 ${rule.title}</h4>
            <p><strong>Original:</strong> "${originalText.substring(0, 100)}${originalText.length > 100 ? '...' : ''}"</p>
            <p><strong>Simplified:</strong> "${simplifiedText}"</p>
            <p><strong>Rule Applied:</strong> ${rule.description}</p>
        `;

        this.incrementRulesLearned();
    }

    showQuickTooltip(event, element) {
        const rule = this.getSimplificationRule(
            element.getAttribute('data-original-text') || '',
            element.textContent
        );

        const tooltip = document.createElement('div');
        tooltip.className = 'learning-tooltip';
        tooltip.textContent = rule.quickTip;

        document.body.appendChild(tooltip);

        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';

        this.currentTooltip = tooltip;
    }

    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }

    getSimplificationRule(original, simplified) {
        const rules = [
            {
                title: "Shorter Sentences",
                description: "Long sentences were broken into smaller, easier-to-read parts.",
                quickTip: "Long sentence → Shorter sentences"
            },
            {
                title: "Simpler Words",
                description: "Complex vocabulary was replaced with everyday words.",
                quickTip: "Complex words → Simple words"
            },
            {
                title: "Active Voice",
                description: "Passive voice was converted to active voice for clarity.",
                quickTip: "Passive voice → Active voice"
            },
            {
                title: "Clear Structure",
                description: "Information was reorganized for better flow and understanding.",
                quickTip: "Better organization and structure"
            }
        ];

        // Simple rule detection based on text characteristics
        if (original.length > simplified.length * 1.5) {
            return rules[0]; // Shorter sentences
        } else if (original.includes('tion') || original.includes('ment')) {
            return rules[1]; // Simpler words
        } else if (original.includes('was') || original.includes('were')) {
            return rules[2]; // Active voice
        } else {
            return rules[3]; // Clear structure
        }
    }

    async updateStats() {
        const stats = await chrome.storage.sync.get({
            rulesLearned: 0,
            examplesSeen: 0
        });

        document.getElementById('rulesLearned').textContent = stats.rulesLearned;
        document.getElementById('examplesSeen').textContent = stats.examplesSeen;
    }

    async incrementRulesLearned() {
        const result = await chrome.storage.sync.get({ rulesLearned: 0 });
        const newCount = result.rulesLearned + 1;
        
        await chrome.storage.sync.set({ rulesLearned: newCount });
        document.getElementById('rulesLearned').textContent = newCount;
    }
}

// Initialize learning overlay
const learningOverlay = new LearningOverlay();
