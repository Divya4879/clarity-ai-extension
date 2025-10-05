// WebSimplify Pro - Content Script
class WebSimplifyContent {
    constructor() {
        this.originalContent = null;
        this.isSimplified = false;
        this.complexityScore = 0;
        this.mainContent = null;
        this.isSplitView = false;
        this.isHeatmapActive = false;
        this.heatmapElements = [];
        this.currentTooltip = null;
        this.init();
    }

    init() {
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.detectMainContent();
        this.analyzePageComplexity();
        this.setupMessageListener();
        this.injectStyles();
        this.setupWindowHandlers();
        
        // Test Chrome AI APIs on initialization
        setTimeout(() => {
            this.testAIAPIsOnLoad();
        }, 2000);
    }

    async testAIAPIsOnLoad() {
        console.log('🧪 WebSimplify Pro: Testing Chrome AI APIs...');
        
        // Check if window.ai exists
        if (!('ai' in window)) {
            console.error('❌ window.ai is not available. Chrome AI APIs not loaded.');
            console.log('💡 Make sure you are using Chrome Canary/Dev with AI flags enabled');
            return;
        }
        
        console.log('✅ window.ai is available');
        
        // Test each API quickly
        const apiTests = {
            writer: 'writer' in window.ai,
            rewriter: 'rewriter' in window.ai,
            summarizer: 'summarizer' in window.ai,
            prompt: 'languageModel' in window.ai
        };
        
        console.log('📋 API Availability:', apiTests);
        
        // Test one API to verify tokens work
        if (apiTests.rewriter) {
            try {
                const capabilities = await window.ai.rewriter.capabilities();
                console.log('🔧 Rewriter capabilities:', capabilities);
                
                if (capabilities.available === 'readily') {
                    console.log('🎉 Chrome AI APIs are working! Rewriter is ready.');
                } else {
                    console.log('⏳ Rewriter API status:', capabilities.available);
                }
            } catch (error) {
                console.error('❌ Rewriter API test failed:', error.message);
            }
        }
        
        if (apiTests.prompt) {
            try {
                const capabilities = await window.ai.languageModel.capabilities();
                console.log('🔧 Prompt API capabilities:', capabilities);
                
                if (capabilities.available === 'readily') {
                    console.log('🎉 Prompt API is working!');
                } else {
                    console.log('⏳ Prompt API status:', capabilities.available);
                }
            } catch (error) {
                console.error('❌ Prompt API test failed:', error.message);
            }
        }
    }

    setupWindowHandlers() {
        // Handle window resize for heatmap repositioning
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.isHeatmapActive) {
                    this.repositionHeatmapOverlays();
                }
            }, 100);
        });

        // Handle scroll for heatmap repositioning
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if (this.isHeatmapActive) {
                    this.repositionHeatmapOverlays();
                }
            }, 50);
        });
    }

    repositionHeatmapOverlays() {
        const contentSections = this.getContentSections();
        
        this.heatmapElements.forEach((overlay, index) => {
            if (contentSections[index]) {
                this.positionOverlay(overlay, contentSections[index]);
            }
        });
    }

    detectMainContent() {
        // Enhanced content detection with scoring
        const candidates = this.findContentCandidates();
        const scored = candidates.map(element => ({
            element,
            score: this.scoreContentElement(element)
        }));

        // Sort by score and pick the best
        scored.sort((a, b) => b.score - a.score);
        
        if (scored.length > 0 && scored[0].score > 0) {
            this.mainContent = scored[0].element;
        } else {
            this.mainContent = document.body;
        }

        console.log('Main content detected with score:', scored[0]?.score, this.mainContent);
    }

    findContentCandidates() {
        const selectors = [
            'main', 'article', '[role="main"]', '.content', '.main-content',
            '.post-content', '.entry-content', '#content', '#main',
            '.mw-parser-output', '.markdown-body', '.post', '.article-body',
            '.story-body', '.entry', '.page-content', '.single-content'
        ];

        const candidates = new Set();
        
        // Add elements from selectors
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => candidates.add(el));
        });

        // Add largest text containers
        document.querySelectorAll('div, section, article').forEach(el => {
            if (this.getTextLength(el) > 200) {
                candidates.add(el);
            }
        });

        return Array.from(candidates);
    }

    scoreContentElement(element) {
        let score = 0;
        const text = this.getTextContent(element);
        const textLength = text.length;

        // Text length scoring
        if (textLength > 1000) score += 10;
        else if (textLength > 500) score += 5;
        else if (textLength > 200) score += 2;
        else return 0; // Too short

        // Semantic element bonus
        const tagName = element.tagName.toLowerCase();
        if (['main', 'article'].includes(tagName)) score += 15;
        if (element.getAttribute('role') === 'main') score += 15;

        // Class/ID bonus
        const className = element.className.toLowerCase();
        const id = element.id.toLowerCase();
        const contentKeywords = ['content', 'main', 'article', 'post', 'entry', 'body', 'text'];
        
        contentKeywords.forEach(keyword => {
            if (className.includes(keyword)) score += 5;
            if (id.includes(keyword)) score += 5;
        });

        // Penalty for navigation/sidebar elements
        const badKeywords = ['nav', 'sidebar', 'menu', 'header', 'footer', 'ad', 'comment'];
        badKeywords.forEach(keyword => {
            if (className.includes(keyword) || id.includes(keyword)) score -= 10;
        });

        // Paragraph density bonus
        const paragraphs = element.querySelectorAll('p').length;
        if (paragraphs > 3) score += paragraphs;

        // Link density penalty (too many links = navigation)
        const links = element.querySelectorAll('a').length;
        const linkDensity = links / Math.max(1, textLength / 100);
        if (linkDensity > 5) score -= linkDensity * 2;

        return Math.max(0, score);
    }

    getTextContent(element) {
        const clone = element.cloneNode(true);
        // Remove non-content elements
        clone.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .menu, .ad').forEach(el => el.remove());
        return clone.textContent.trim();
    }

    getTextLength(element) {
        return this.getTextContent(element).length;
    }

    async analyzePageComplexity() {
        if (!this.mainContent) return;

        const text = this.extractTextContent(this.mainContent);
        const domain = this.detectDomain();
        
        try {
            // Enhanced complexity analysis with domain intelligence
            this.complexityScore = await this.calculateComplexityScore(text, domain);
            
            // Analyze visual content (multimodal)
            await this.analyzeVisualContent();
            
            // Track analytics
            await this.trackPageAnalysis(domain, this.complexityScore);
            
            // Update badge
            chrome.runtime.sendMessage({
                action: 'updateBadge',
                complexity: this.complexityScore
            });
        } catch (error) {
            console.error('Complexity analysis failed:', error);
            this.complexityScore = 5; // Default
        }
    }

    async analyzeVisualContent() {
        // Multimodal analysis of images, charts, and diagrams
        const images = this.mainContent.querySelectorAll('img, svg, canvas, video');
        const visualComplexity = await this.calculateVisualComplexity(images);
        
        // Adjust overall complexity based on visual content
        this.complexityScore = Math.min(10, this.complexityScore + visualComplexity);
        
        // Add alt-text for complex visuals
        await this.enhanceVisualAccessibility(images);
    }

    async calculateVisualComplexity(images) {
        let visualComplexity = 0;
        
        for (const image of images) {
            // Check for complex visual indicators
            const src = image.src || '';
            const alt = image.alt || '';
            const className = image.className || '';
            
            // Charts and diagrams
            if (src.includes('chart') || alt.includes('chart') || 
                src.includes('graph') || alt.includes('graph') ||
                className.includes('chart') || className.includes('diagram')) {
                visualComplexity += 1;
            }
            
            // Technical diagrams
            if (alt.includes('diagram') || alt.includes('flowchart') ||
                alt.includes('architecture') || alt.includes('schema')) {
                visualComplexity += 1.5;
            }
            
            // Mathematical content
            if (alt.includes('equation') || alt.includes('formula') ||
                src.includes('math') || className.includes('math')) {
                visualComplexity += 2;
            }
            
            // Large images without alt text
            if (!alt && image.width > 300 && image.height > 200) {
                visualComplexity += 0.5;
            }
        }
        
        return Math.min(3, visualComplexity); // Cap at 3 points
    }

    async enhanceVisualAccessibility(images) {
        for (const image of images) {
            if (!image.alt || image.alt.length < 10) {
                try {
                    // Use multimodal AI to generate descriptions
                    const description = await this.generateImageDescription(image);
                    if (description) {
                        image.alt = description;
                        image.title = description;
                    }
                } catch (error) {
                    // Fallback to basic description
                    const basicDescription = this.generateBasicImageDescription(image);
                    if (basicDescription) {
                        image.alt = basicDescription;
                    }
                }
            }
        }
    }

    async generateImageDescription(image) {
        try {
            // Check if multimodal AI is available
            if ('ai' in window && 'languageModel' in window.ai) {
                const session = await window.ai.languageModel.create({
                    systemPrompt: "You are an accessibility assistant. Describe images clearly and concisely for screen readers. Focus on important visual information."
                });
                
                // For now, use context clues since direct image analysis needs special permissions
                const context = this.getImageContext(image);
                const prompt = `Describe this image based on context: ${context}. Provide a clear, concise alt-text description.`;
                
                const description = await session.prompt(prompt);
                session.destroy();
                
                return description.substring(0, 150); // Limit length
            }
        } catch (error) {
            console.log('AI image description failed:', error);
        }
        
        return null;
    }

    getImageContext(image) {
        // Gather context from surrounding elements
        const parent = image.parentElement;
        const siblings = Array.from(parent.children);
        const imageIndex = siblings.indexOf(image);
        
        let context = '';
        
        // Check caption
        const caption = parent.querySelector('figcaption') || 
                       siblings[imageIndex + 1]?.tagName === 'P' ? siblings[imageIndex + 1] : null;
        if (caption) {
            context += `Caption: ${caption.textContent.substring(0, 100)}. `;
        }
        
        // Check surrounding text
        const prevText = siblings[imageIndex - 1]?.textContent?.substring(0, 50) || '';
        const nextText = siblings[imageIndex + 1]?.textContent?.substring(0, 50) || '';
        
        if (prevText) context += `Before: ${prevText}. `;
        if (nextText) context += `After: ${nextText}. `;
        
        // Check image attributes
        const src = image.src || '';
        const className = image.className || '';
        
        if (src.includes('chart')) context += 'This appears to be a chart or graph. ';
        if (src.includes('diagram')) context += 'This appears to be a diagram. ';
        if (className.includes('logo')) context += 'This appears to be a logo. ';
        
        return context.trim();
    }

    generateBasicImageDescription(image) {
        const src = image.src || '';
        const className = image.className || '';
        
        // Basic categorization
        if (src.includes('chart') || className.includes('chart')) {
            return 'Chart or graph showing data visualization';
        }
        if (src.includes('diagram') || className.includes('diagram')) {
            return 'Diagram illustrating concepts or processes';
        }
        if (src.includes('logo') || className.includes('logo')) {
            return 'Company or organization logo';
        }
        if (src.includes('photo') || className.includes('photo')) {
            return 'Photograph or image';
        }
        
        return 'Image content';
    }

    detectDomain() {
        const url = window.location.href;
        const hostname = window.location.hostname;
        
        // Academic/Research
        if (hostname.includes('wikipedia.org')) return 'wikipedia';
        if (hostname.includes('arxiv.org')) return 'academic';
        if (hostname.includes('pubmed.ncbi.nlm.nih.gov')) return 'medical';
        if (hostname.includes('scholar.google')) return 'academic';
        if (hostname.includes('.edu')) return 'academic';
        
        // Legal/Government
        if (hostname.includes('.gov')) return 'government';
        if (url.includes('terms') || url.includes('privacy') || url.includes('policy')) return 'legal';
        
        // Technical
        if (hostname.includes('github.com')) return 'technical';
        if (hostname.includes('stackoverflow.com')) return 'technical';
        if (hostname.includes('docs.') || url.includes('/docs/')) return 'technical';
        if (hostname.includes('developer.')) return 'technical';
        
        // News/Media
        if (hostname.includes('cnn.com') || hostname.includes('bbc.com') || 
            hostname.includes('nytimes.com') || hostname.includes('reuters.com')) return 'news';
        
        // Finance
        if (hostname.includes('sec.gov') || hostname.includes('bloomberg.com') ||
            hostname.includes('wsj.com')) return 'finance';
        
        return 'general';
    }

    async calculateComplexityScore(text, domain) {
        // Domain-specific complexity analysis
        let complexity = await this.baseComplexityScore(text);
        
        // Apply domain-specific adjustments
        const domainModifiers = {
            'academic': { threshold: 0.8, bonus: 1 },
            'medical': { threshold: 0.9, bonus: 1.5 },
            'legal': { threshold: 0.7, bonus: 1.2 },
            'technical': { threshold: 0.8, bonus: 1 },
            'government': { threshold: 0.6, bonus: 0.8 },
            'finance': { threshold: 0.7, bonus: 1 },
            'wikipedia': { threshold: 0.8, bonus: 0.5 },
            'news': { threshold: 0.4, bonus: 0.3 },
            'general': { threshold: 0.5, bonus: 0 }
        };
        
        const modifier = domainModifiers[domain] || domainModifiers['general'];
        
        // Apply domain-specific patterns
        complexity += this.analyzeDomainSpecificPatterns(text, domain);
        
        // Adjust based on domain expectations
        if (complexity > 6) {
            complexity += modifier.bonus;
        }
        
        return Math.min(10, Math.max(1, Math.round(complexity)));
    }

    analyzeDomainSpecificPatterns(text, domain) {
        let domainComplexity = 0;
        
        switch (domain) {
            case 'academic':
            case 'medical':
                // Look for citations, formulas, technical terms
                const citations = text.match(/\[\d+\]|\(\d{4}\)|et al\./gi) || [];
                const formulas = text.match(/[A-Z][a-z]*\d+|[α-ωΑ-Ω]/g) || [];
                domainComplexity += Math.min(2, citations.length / 10 + formulas.length / 20);
                break;
                
            case 'legal':
                // Look for legal jargon
                const legalTerms = text.match(/\b(whereas|heretofore|pursuant|notwithstanding|aforementioned)\b/gi) || [];
                const sections = text.match(/section \d+|§\d+|\(\w\)/gi) || [];
                domainComplexity += Math.min(2, legalTerms.length / 5 + sections.length / 10);
                break;
                
            case 'technical':
                // Look for code, APIs, technical specs
                const codeBlocks = text.match(/```[\s\S]*?```|`[^`]+`/g) || [];
                const apiTerms = text.match(/\b(API|HTTP|JSON|XML|REST|GraphQL)\b/gi) || [];
                domainComplexity += Math.min(1.5, codeBlocks.length / 5 + apiTerms.length / 10);
                break;
                
            case 'finance':
                // Look for financial terms
                const finTerms = text.match(/\b(EBITDA|P\/E|ROI|basis points|derivatives)\b/gi) || [];
                domainComplexity += Math.min(1, finTerms.length / 5);
                break;
        }
        
        return domainComplexity;
    }

    async baseComplexityScore(text) {
        // Use existing complexity calculation as base
        let complexity = 1;
        
        const words = text.split(/\s+/);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgWordsPerSentence = words.length / Math.max(1, sentences.length);
        
        // Sentence length complexity
        if (avgWordsPerSentence > 25) complexity += 4;
        else if (avgWordsPerSentence > 20) complexity += 3;
        else if (avgWordsPerSentence > 15) complexity += 2;
        else if (avgWordsPerSentence > 10) complexity += 1;
        
        // Vocabulary complexity
        const longWords = words.filter(word => word.length > 7).length;
        const longWordRatio = longWords / words.length;
        complexity += longWordRatio * 3;
        
        // Technical terms detection
        const technicalPatterns = [
            /\b(algorithm|implementation|methodology|infrastructure|optimization|paradigm)\b/gi,
            /\b(quantum|molecular|biochemical|neurological|pharmaceutical)\b/gi,
            /\b(constitutional|jurisprudence|litigation|statutory|regulatory)\b/gi,
            /\b(derivative|integral|polynomial|logarithmic|exponential)\b/gi
        ];
        
        technicalPatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            complexity += Math.min(2, matches.length / 10);
        });
        
        return complexity;
    }

    async trackPageAnalysis(domain, complexity) {
        try {
            await chrome.runtime.sendMessage({
                action: 'trackAnalytics',
                data: {
                    type: 'page_analyzed',
                    domain: domain,
                    complexity: complexity,
                    url: window.location.hostname,
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            console.log('Analytics tracking failed:', error);
        }
    }

    async calculateComplexityScore(text) {
        // Advanced complexity scoring algorithm
        let complexity = 1;
        
        // Word and sentence analysis
        const words = text.split(/\s+/);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgWordsPerSentence = words.length / Math.max(1, sentences.length);
        
        // Sentence length complexity
        if (avgWordsPerSentence > 25) complexity += 4;
        else if (avgWordsPerSentence > 20) complexity += 3;
        else if (avgWordsPerSentence > 15) complexity += 2;
        else if (avgWordsPerSentence > 10) complexity += 1;
        
        // Vocabulary complexity
        const longWords = words.filter(word => word.length > 7).length;
        const longWordRatio = longWords / words.length;
        complexity += longWordRatio * 3;
        
        // Technical terms detection
        const technicalPatterns = [
            /\b(algorithm|implementation|methodology|infrastructure|optimization|paradigm)\b/gi,
            /\b(quantum|molecular|biochemical|neurological|pharmaceutical)\b/gi,
            /\b(constitutional|jurisprudence|litigation|statutory|regulatory)\b/gi,
            /\b(derivative|integral|polynomial|logarithmic|exponential)\b/gi
        ];
        
        technicalPatterns.forEach(pattern => {
            const matches = text.match(pattern) || [];
            complexity += Math.min(2, matches.length / 10);
        });
        
        // Passive voice detection
        const passivePatterns = /\b(was|were|been|being)\s+\w+ed\b/gi;
        const passiveMatches = text.match(passivePatterns) || [];
        complexity += Math.min(1, passiveMatches.length / 20);
        
        // Readability factors
        const syllableCount = this.estimateSyllables(text);
        const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * (syllableCount / words.length));
        
        if (fleschScore < 30) complexity += 3;      // Very difficult
        else if (fleschScore < 50) complexity += 2; // Difficult
        else if (fleschScore < 60) complexity += 1; // Fairly difficult
        
        return Math.min(10, Math.max(1, Math.round(complexity)));
    }

    estimateSyllables(text) {
        const words = text.toLowerCase().split(/\s+/);
        let syllables = 0;
        
        words.forEach(word => {
            word = word.replace(/[^a-z]/g, '');
            if (word.length === 0) return;
            
            // Count vowel groups
            const vowelGroups = word.match(/[aeiouy]+/g) || [];
            let count = vowelGroups.length;
            
            // Adjust for silent e
            if (word.endsWith('e')) count--;
            
            // Minimum 1 syllable per word
            syllables += Math.max(1, count);
        });
        
        return syllables;
    }

    extractTextContent(element) {
        // Clone element to avoid modifying original
        const clone = element.cloneNode(true);
        
        // Remove script and style elements
        clone.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
        
        return clone.textContent.trim();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'ping':
                    sendResponse({ status: 'ready' });
                    break;

                case 'analyzeComplexity':
                    sendResponse({ complexity: this.complexityScore });
                    break;

                case 'simplifyPage':
                    try {
                        const result = await this.simplifyPage(message.level);
                        sendResponse(result);
                    } catch (error) {
                        console.error('Simplification failed:', error);
                        sendResponse({ 
                            success: false, 
                            error: this.getErrorMessage(error)
                        });
                    }
                    break;

                case 'restoreOriginal':
                    try {
                        this.restoreOriginal();
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ 
                            success: false, 
                            error: 'Failed to restore original content'
                        });
                    }
                    break;

                case 'updateSimplificationLevel':
                    try {
                        await this.updateSimplificationLevel(message.level);
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ 
                            success: false, 
                            error: 'Failed to update simplification level'
                        });
                    }
                    break;

                case 'toggleSplitView':
                    try {
                        this.toggleSplitView();
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ 
                            success: false, 
                            error: 'Split view not available'
                        });
                    }
                    break;

                case 'toggleHeatmap':
                    try {
                        this.toggleHeatmap();
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ 
                            success: false, 
                            error: 'Heatmap not available'
                        });
                    }
                    break;

                case 'resetPage':
                    try {
                        this.resetPage();
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ 
                            success: false, 
                            error: 'Failed to reset page'
                        });
                    }
                    break;

                case 'getComplexityScore':
                    sendResponse({ complexity: this.complexityScore });
                    break;

                case 'getExportData':
                    try {
                        const exportData = await this.getExportData(message.options);
                        sendResponse({ data: exportData });
                    } catch (error) {
                        sendResponse({ 
                            success: false, 
                            error: 'Failed to prepare export data'
                        });
                    }
                    break;

                case 'toggleLearningMode':
                    try {
                        this.toggleLearningMode();
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ 
                            success: false, 
                            error: 'Learning mode not available'
                        });
                    }
                    break;

                case 'testAI':
                    try {
                        const testResults = await this.testAIAPIs();
                        sendResponse({ 
                            success: true, 
                            results: testResults,
                            available: await this.isAIAvailable()
                        });
                    } catch (error) {
                        sendResponse({ 
                            success: false, 
                            error: 'AI testing failed'
                        });
                    }
                    break;

                default:
                    sendResponse({ error: 'Unknown action: ' + message.action });
            }
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({ 
                success: false, 
                error: 'Internal error occurred'
            });
        }
    }

    getErrorMessage(error) {
        if (error.message === 'No main content found') {
            return 'No content found to simplify on this page';
        }
        if (error.message === 'AI_SESSION_FAILED') {
            return 'AI processing unavailable, using basic simplification';
        }
        if (error.message === 'AI_TIMEOUT') {
            return 'Processing took too long, please try again';
        }
        return 'Simplification failed, please try again';
    }

    async simplifyPage(level = 2) {
        if (!this.mainContent) {
            throw new Error('No main content found');
        }

        return await this.measurePerformanceAsync('simplifyPage', async () => {
            // Load context analyzer if not already loaded
            if (!window.ContextAnalyzer) {
                await this.loadContextAnalyzer();
            }

            // Analyze user context for adaptive simplification
            const contextAnalyzer = new window.ContextAnalyzer();
            const domain = window.location.hostname;
            const contextAnalysis = await contextAnalyzer.analyzeUserContext(domain, this.mainContent);
            
            // Use contextual level if available, otherwise use provided level
            const adaptiveLevel = contextAnalysis.simplificationLevel || level;
            const adaptivePrompt = contextAnalysis.adaptivePrompt;

            // Store original content
            if (!this.originalContent) {
                this.originalContent = this.mainContent.innerHTML;
            }

            const text = this.extractTextContent(this.mainContent);
            
            try {
                // Try Chrome AI APIs first, fallback to basic simplification
                let simplifiedText;
                
                if (await this.isAIAvailable()) {
                    simplifiedText = await this.simplifyWithAI(text, adaptiveLevel, adaptivePrompt);
                } else {
                    simplifiedText = await this.simplifyBasic(text, adaptiveLevel);
                }

                // Apply simplified content with performance optimization
                await this.applySimplifiedContentOptimized(simplifiedText);
                this.isSimplified = true;

                // Calculate reading time
                const readingTime = this.calculateReadingTime(text, simplifiedText);

                // Add accessibility enhancements
                this.addAccessibilityFeatures();

                // Update user profile with domain experience
                await contextAnalyzer.updateUserProfile(domain, this.complexityScore, Date.now() - (this.pageLoadTime || Date.now()));

                return {
                    success: true,
                    readingTime: readingTime,
                    contextual: true,
                    adaptiveLevel: adaptiveLevel,
                    domainFamiliarity: contextAnalysis.domainFamiliarity.level
                };
            } catch (error) {
                console.error('Simplification error:', error);
                throw error;
            }
        });
    }

    async applySimplifiedContentOptimized(simplifiedText) {
        // Use requestAnimationFrame for smooth UI updates
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                // Batch DOM updates
                const sections = this.parseSimplifiedContent(simplifiedText);
                const fragment = document.createDocumentFragment();
                
                sections.forEach(section => {
                    const element = this.createSectionElement(section);
                    fragment.appendChild(element);
                });

                // Single DOM update
                this.mainContent.style.opacity = '0.5';
                
                requestAnimationFrame(() => {
                    this.mainContent.innerHTML = '';
                    this.mainContent.appendChild(fragment);
                    this.mainContent.classList.add('websimplify-simplified');
                    this.mainContent.style.opacity = '1';
                    
                    // Add tooltips after DOM update
                    this.addTooltips();
                    resolve();
                });
            });
        });
    }

    createSectionElement(section) {
        let element;
        
        switch (section.type) {
            case 'heading':
                element = document.createElement('h3');
                element.className = 'websimplify-heading';
                element.textContent = section.content;
                element.setAttribute('tabindex', '0');
                element.setAttribute('role', 'heading');
                element.setAttribute('aria-level', '3');
                break;
                
            case 'list':
                element = document.createElement('ul');
                element.className = 'websimplify-list';
                element.setAttribute('role', 'list');
                section.items.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'websimplify-list-item';
                    li.textContent = item;
                    li.setAttribute('role', 'listitem');
                    li.setAttribute('tabindex', '0');
                    element.appendChild(li);
                });
                break;
                
            case 'paragraph':
                element = document.createElement('p');
                element.className = 'websimplify-paragraph';
                element.textContent = section.content;
                element.setAttribute('tabindex', '0');
                break;
                
            case 'important':
                element = document.createElement('div');
                element.className = 'websimplify-important';
                element.textContent = section.content;
                element.setAttribute('role', 'note');
                element.setAttribute('aria-label', 'Important information');
                element.setAttribute('tabindex', '0');
                break;
                
            default:
                element = document.createElement('p');
                element.className = 'websimplify-paragraph';
                element.textContent = section.content;
                element.setAttribute('tabindex', '0');
        }
        
        return element;
    }

    addAccessibilityFeatures() {
        // Add skip link
        const skipLink = document.createElement('a');
        skipLink.href = '#websimplify-content';
        skipLink.textContent = 'Skip to simplified content';
        skipLink.className = 'websimplify-skip-link';
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: #000;
            color: #fff;
            padding: 8px;
            text-decoration: none;
            z-index: 10001;
            border-radius: 4px;
        `;
        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '6px';
        });
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // Add content landmark
        this.mainContent.setAttribute('id', 'websimplify-content');
        this.mainContent.setAttribute('role', 'main');
        this.mainContent.setAttribute('aria-label', 'Simplified content');
        
        // Add keyboard navigation
        this.addKeyboardNavigation();
        
        // Announce simplification to screen readers
        this.announceToScreenReader('Page content has been simplified for easier reading');
    }

    addKeyboardNavigation() {
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Alt + S: Toggle simplification
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                this.toggleSimplificationFromKeyboard();
            }
            
            // Alt + R: Reset page
            if (e.altKey && e.key === 'r') {
                e.preventDefault();
                this.resetPage();
                this.announceToScreenReader('Page reset to original content');
            }
            
            // Alt + H: Toggle heatmap
            if (e.altKey && e.key === 'h') {
                e.preventDefault();
                this.toggleHeatmap();
            }
        });
    }

    toggleSimplificationFromKeyboard() {
        if (this.isSimplified) {
            this.restoreOriginal();
            this.announceToScreenReader('Original content restored');
        } else {
            this.simplifyPage(2).then(() => {
                this.announceToScreenReader('Content simplified');
            });
        }
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    async isAIAvailable() {
        try {
            // Test all available Chrome AI APIs
            const results = {
                writer: false,
                rewriter: false,
                summarizer: false,
                prompt: false
            };

            // Test Writer API
            if ('ai' in window && 'writer' in window.ai) {
                try {
                    const writerCapabilities = await window.ai.writer.capabilities();
                    results.writer = writerCapabilities.available === 'readily';
                } catch (e) {
                    console.log('Writer API not available:', e.message);
                }
            }

            // Test Rewriter API
            if ('ai' in window && 'rewriter' in window.ai) {
                try {
                    const rewriterCapabilities = await window.ai.rewriter.capabilities();
                    results.rewriter = rewriterCapabilities.available === 'readily';
                } catch (e) {
                    console.log('Rewriter API not available:', e.message);
                }
            }

            // Test Summarizer API
            if ('ai' in window && 'summarizer' in window.ai) {
                try {
                    const summarizerCapabilities = await window.ai.summarizer.capabilities();
                    results.summarizer = summarizerCapabilities.available === 'readily';
                } catch (e) {
                    console.log('Summarizer API not available:', e.message);
                }
            }

            // Test Prompt API (for extensions)
            if ('ai' in window && 'languageModel' in window.ai) {
                try {
                    const promptCapabilities = await window.ai.languageModel.capabilities();
                    results.prompt = promptCapabilities.available === 'readily';
                } catch (e) {
                    console.log('Prompt API not available:', e.message);
                }
            }

            console.log('Chrome AI API Status:', results);
            
            // Return true if any API is available
            return Object.values(results).some(available => available);
        } catch (error) {
            console.log('Chrome AI APIs not available:', error.message);
            return false;
        }
    }

    async simplifyWithAI(text, level, adaptivePrompt = null) {
        try {
            const domain = this.detectDomain();
            
            // Try different APIs in order of preference
            let simplifiedText = null;

            // 1. Try Rewriter API first (most appropriate for simplification)
            if ('ai' in window && 'rewriter' in window.ai) {
                try {
                    simplifiedText = await this.simplifyWithRewriter(text, level, domain, adaptivePrompt);
                    if (simplifiedText) {
                        console.log('Used Rewriter API for contextual simplification');
                        return simplifiedText;
                    }
                } catch (e) {
                    console.log('Rewriter API failed:', e.message);
                }
            }

            // 2. Try Writer API for generating new simplified content
            if ('ai' in window && 'writer' in window.ai) {
                try {
                    simplifiedText = await this.simplifyWithWriter(text, level, domain, adaptivePrompt);
                    if (simplifiedText) {
                        console.log('Used Writer API for contextual simplification');
                        return simplifiedText;
                    }
                } catch (e) {
                    console.log('Writer API failed:', e.message);
                }
            }

            // 3. Try Prompt API as fallback
            if ('ai' in window && 'languageModel' in window.ai) {
                try {
                    simplifiedText = await this.simplifyWithPrompt(text, level, domain);
                    if (simplifiedText) {
                        console.log('Used Prompt API for simplification');
                        return simplifiedText;
                    }
                } catch (e) {
                    console.log('Prompt API failed:', e.message);
                }
            }

            // 4. Fallback to basic simplification
            console.log('All AI APIs failed, using basic simplification');
            return await this.simplifyBasic(text, level);

        } catch (error) {
            console.error('AI simplification failed:', error);
            return await this.simplifyBasic(text, level);
        }
    }

    async simplifyWithRewriter(text, level, domain, adaptivePrompt = null) {
        try {
            const rewriter = await window.ai.rewriter.create({
                tone: level === 1 ? 'casual' : level === 2 ? 'neutral' : 'formal',
                format: 'plain-text',
                length: level === 3 ? 'shorter' : 'as-is'
            });

            const chunks = this.chunkText(text, 1000);
            const simplifiedChunks = [];

            for (const chunk of chunks) {
                const context = adaptivePrompt || `This is ${domain} content. Make it easier to understand.`;
                const result = await rewriter.rewrite(chunk, { context });
                simplifiedChunks.push(result);
            }

            rewriter.destroy();
            return simplifiedChunks.join('\n\n');
        } catch (error) {
            console.error('Rewriter API error:', error);
            return null;
        }
    }

    async simplifyWithWriter(text, level, domain) {
        try {
            const writer = await window.ai.writer.create({
                tone: level === 1 ? 'casual' : level === 2 ? 'neutral' : 'formal',
                format: 'plain-text',
                length: level === 3 ? 'short' : 'medium'
            });

            const prompt = this.getWriterPrompt(text, level, domain);
            const result = await writer.write(prompt);

            writer.destroy();
            return result;
        } catch (error) {
            console.error('Writer API error:', error);
            return null;
        }
    }

    async simplifyWithPrompt(text, level, domain) {
        try {
            const session = await window.ai.languageModel.create({
                systemPrompt: this.getDomainSpecificPrompt(level, domain),
                temperature: 0.3,
                topK: 3
            });

            const chunks = this.chunkText(text, 1500);
            const simplifiedChunks = [];

            for (const chunk of chunks) {
                const prompt = this.getDomainSimplificationPrompt(chunk, level, domain);
                const result = await session.prompt(prompt);
                simplifiedChunks.push(result);
            }

            session.destroy();
            return simplifiedChunks.join('\n\n');
        } catch (error) {
            console.error('Prompt API error:', error);
            return null;
        }
    }

    getWriterPrompt(text, level, domain) {
        const levelDescriptions = {
            1: 'very simple language that anyone can understand',
            2: 'clear and accessible language',
            3: 'concise but easy-to-understand language'
        };

        const domainContext = {
            'academic': 'This is academic content. ',
            'medical': 'This is medical content. ',
            'legal': 'This is legal content. ',
            'technical': 'This is technical content. ',
            'government': 'This is government content. ',
            'finance': 'This is financial content. ',
            'wikipedia': 'This is encyclopedia content. ',
            'news': 'This is news content. ',
            'general': 'This is web content. '
        };

        return `${domainContext[domain] || domainContext['general']}Rewrite the following text using ${levelDescriptions[level]}. Keep all important information but make it easier to read and understand:\n\n${text}`;
    }

    // Add API testing function
    async testAIAPIs() {
        console.log('🧪 Testing Chrome AI APIs...');
        
        const testText = "The implementation of quantum computing algorithms requires sophisticated understanding of quantum mechanical principles and their practical applications in computational systems.";
        
        const results = {
            writer: null,
            rewriter: null,
            summarizer: null,
            prompt: null
        };

        // Test Writer API
        if ('ai' in window && 'writer' in window.ai) {
            try {
                const writer = await window.ai.writer.create();
                results.writer = await writer.write("Simplify this: " + testText);
                writer.destroy();
                console.log('✅ Writer API working:', results.writer.substring(0, 100) + '...');
            } catch (e) {
                console.log('❌ Writer API failed:', e.message);
            }
        }

        // Test Rewriter API
        if ('ai' in window && 'rewriter' in window.ai) {
            try {
                const rewriter = await window.ai.rewriter.create();
                results.rewriter = await rewriter.rewrite(testText);
                rewriter.destroy();
                console.log('✅ Rewriter API working:', results.rewriter.substring(0, 100) + '...');
            } catch (e) {
                console.log('❌ Rewriter API failed:', e.message);
            }
        }

        // Test Summarizer API
        if ('ai' in window && 'summarizer' in window.ai) {
            try {
                const summarizer = await window.ai.summarizer.create();
                results.summarizer = await summarizer.summarize(testText);
                summarizer.destroy();
                console.log('✅ Summarizer API working:', results.summarizer.substring(0, 100) + '...');
            } catch (e) {
                console.log('❌ Summarizer API failed:', e.message);
            }
        }

        // Test Prompt API
        if ('ai' in window && 'languageModel' in window.ai) {
            try {
                const session = await window.ai.languageModel.create();
                results.prompt = await session.prompt("Simplify this text: " + testText);
                session.destroy();
                console.log('✅ Prompt API working:', results.prompt.substring(0, 100) + '...');
            } catch (e) {
                console.log('❌ Prompt API failed:', e.message);
            }
        }

        return results;
    }

    getDomainSpecificPrompt(level, domain) {
        const basePrompts = {
            1: "You are a text simplifier. Make text easier to read by using simple words and shorter sentences. Keep all important information.",
            2: "You are a text simplifier. Rewrite complex text to be clear and accessible. Break long sentences, replace difficult words, and organize information better.",
            3: "You are a text simplifier. Transform complex text into very simple, easy-to-understand language. Use bullet points, short paragraphs, and everyday words."
        };
        
        const domainSpecific = {
            'academic': " Focus on explaining research concepts in plain language while preserving scientific accuracy.",
            'medical': " Explain medical terms in everyday language while maintaining clinical precision.",
            'legal': " Convert legal jargon into plain English while preserving the meaning of legal concepts.",
            'technical': " Explain technical concepts using simple analogies and everyday examples.",
            'government': " Make government language clear and accessible to all citizens.",
            'finance': " Explain financial concepts using simple terms and real-world examples.",
            'wikipedia': " Maintain encyclopedic accuracy while making content more accessible.",
            'news': " Keep the journalistic style while making complex topics easier to understand."
        };
        
        return basePrompts[level] + (domainSpecific[domain] || '');
    }

    getDomainSimplificationPrompt(text, level, domain) {
        const instructions = {
            1: "Simplify this text by using shorter sentences and simpler words:",
            2: "Rewrite this text to be clearer and more accessible:",
            3: "Transform this text into very simple language with bullet points:"
        };
        
        const domainContext = {
            'academic': "\nThis is academic content. Explain research concepts clearly.",
            'medical': "\nThis is medical content. Define medical terms in simple language.",
            'legal': "\nThis is legal content. Convert legal jargon to plain English.",
            'technical': "\nThis is technical content. Use analogies to explain complex concepts.",
            'government': "\nThis is government content. Make it accessible to all citizens.",
            'finance': "\nThis is financial content. Use everyday examples for financial concepts."
        };
        
        return `${instructions[level] || instructions[2]}${domainContext[domain] || ''}\n\n${text}`;
    }

    async trackSimplification(domain, level, originalLength, simplifiedLength) {
        try {
            await chrome.runtime.sendMessage({
                action: 'trackAnalytics',
                data: {
                    type: 'page_simplified',
                    domain: domain,
                    level: level,
                    originalLength: originalLength,
                    simplifiedLength: simplifiedLength,
                    reduction: originalLength - simplifiedLength,
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            console.log('Simplification tracking failed:', error);
        }
    }

    getSystemPrompt(level) {
        const prompts = {
            1: "You are a text simplifier. Make text easier to read by using simple words and shorter sentences. Keep all important information.",
            2: "You are a text simplifier. Rewrite complex text to be clear and accessible. Break long sentences, replace difficult words, and organize information better.",
            3: "You are a text simplifier. Transform complex text into very simple, easy-to-understand language. Use bullet points, short paragraphs, and everyday words."
        };
        return prompts[level] || prompts[2];
    }

    getSimplificationPrompt(text, level) {
        const instructions = {
            1: "Simplify this text by using shorter sentences and simpler words:",
            2: "Rewrite this text to be clearer and more accessible:",
            3: "Transform this text into very simple language with bullet points:"
        };
        return `${instructions[level] || instructions[2]}\n\n${text}`;
    }

    chunkText(text, maxLength) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const chunks = [];
        let currentChunk = '';

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxLength && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += sentence + '. ';
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    async simplifyBasic(text, level) {
        // Enhanced basic simplification
        let simplified = text;

        // Level 1: Basic word replacement
        if (level >= 1) {
            const replacements = {
                'utilize': 'use', 'utilization': 'use', 'demonstrate': 'show',
                'implement': 'do', 'implementation': 'doing', 'methodology': 'method',
                'facilitate': 'help', 'approximately': 'about', 'subsequently': 'then',
                'consequently': 'so', 'furthermore': 'also', 'nevertheless': 'but',
                'therefore': 'so', 'however': 'but', 'although': 'even though',
                'acquire': 'get', 'commence': 'start', 'terminate': 'end',
                'sufficient': 'enough', 'additional': 'more', 'numerous': 'many'
            };

            Object.entries(replacements).forEach(([complex, simple]) => {
                const regex = new RegExp(`\\b${complex}\\b`, 'gi');
                simplified = simplified.replace(regex, simple);
            });
        }

        // Level 2: Sentence restructuring
        if (level >= 2) {
            simplified = this.breakLongSentences(simplified);
            simplified = this.convertPassiveToActive(simplified);
        }

        // Level 3: Advanced restructuring
        if (level >= 3) {
            simplified = this.addBulletPoints(simplified);
            simplified = this.addHeadings(simplified);
        }

        return simplified;
    }

    breakLongSentences(text) {
        return text.replace(/([^.!?]{60,}?),\s+/g, '$1. ');
    }

    convertPassiveToActive(text) {
        // Simple passive to active conversion
        return text
            .replace(/\bis\s+(\w+ed)\s+by\s+(\w+)/gi, '$2 $1')
            .replace(/\bwas\s+(\w+ed)\s+by\s+(\w+)/gi, '$2 $1');
    }

    addBulletPoints(text) {
        // Convert lists to bullet points
        return text.replace(/(\d+\.\s)/g, '• ');
    }

    addHeadings(text) {
        // Add simple headings for long paragraphs
        const paragraphs = text.split('\n\n');
        return paragraphs.map((para, index) => {
            if (para.length > 300 && index > 0) {
                const firstSentence = para.split('.')[0];
                if (firstSentence.length < 50) {
                    return `## ${firstSentence}\n\n${para.substring(firstSentence.length + 1)}`;
                }
            }
            return para;
        }).join('\n\n');
    }

    applySimplifiedContent(simplifiedText) {
        // Enhanced content application with better formatting and preservation
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                // Store interactive elements before modification
                const interactiveElements = this.preserveInteractiveElements();
                
                // Parse and create sections
                const sections = this.parseSimplifiedContent(simplifiedText);
                const fragment = document.createDocumentFragment();
                
                sections.forEach(section => {
                    const element = this.createSectionElement(section);
                    fragment.appendChild(element);
                });

                // Apply with smooth transition
                this.mainContent.style.opacity = '0.5';
                
                requestAnimationFrame(() => {
                    this.mainContent.innerHTML = '';
                    this.mainContent.appendChild(fragment);
                    
                    // Restore interactive elements
                    this.restoreInteractiveElements(interactiveElements);
                    
                    this.mainContent.classList.add('websimplify-simplified');
                    this.mainContent.style.opacity = '1';
                    
                    // Add tooltips and accessibility features
                    this.addTooltips();
                    this.addAccessibilityFeatures();
                    
                    resolve();
                });
            });
        });
    }

    preserveInteractiveElements() {
        // Preserve important interactive elements
        const preserved = {
            links: [],
            buttons: [],
            forms: [],
            media: []
        };

        // Store links with context
        this.mainContent.querySelectorAll('a[href]').forEach((link, index) => {
            preserved.links.push({
                href: link.href,
                text: link.textContent,
                title: link.title,
                target: link.target,
                context: this.getElementContext(link),
                index: index
            });
        });

        // Store buttons
        this.mainContent.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach((button, index) => {
            preserved.buttons.push({
                type: button.type,
                value: button.value,
                text: button.textContent,
                onclick: button.onclick,
                context: this.getElementContext(button),
                index: index
            });
        });

        // Store forms
        this.mainContent.querySelectorAll('form').forEach((form, index) => {
            preserved.forms.push({
                action: form.action,
                method: form.method,
                innerHTML: form.innerHTML,
                context: this.getElementContext(form),
                index: index
            });
        });

        // Store media elements
        this.mainContent.querySelectorAll('img, video, audio, iframe').forEach((media, index) => {
            preserved.media.push({
                tagName: media.tagName,
                src: media.src,
                alt: media.alt,
                title: media.title,
                width: media.width,
                height: media.height,
                context: this.getElementContext(media),
                index: index
            });
        });

        return preserved;
    }

    restoreInteractiveElements(preserved) {
        // Restore links in simplified content
        const textNodes = this.getTextNodes(this.mainContent);
        
        preserved.links.forEach(linkData => {
            this.restoreLinksInText(textNodes, linkData);
        });

        // Restore media elements
        preserved.media.forEach(mediaData => {
            this.restoreMediaElement(mediaData);
        });

        // Add preserved forms at the end if any
        preserved.forms.forEach(formData => {
            this.restoreFormElement(formData);
        });
    }

    getElementContext(element) {
        // Get surrounding text for context matching
        const parent = element.parentElement;
        const textBefore = this.getTextBefore(element, 50);
        const textAfter = this.getTextAfter(element, 50);
        
        return {
            textBefore: textBefore,
            textAfter: textAfter,
            parentTag: parent?.tagName,
            elementText: element.textContent?.substring(0, 100)
        };
    }

    getTextBefore(element, maxLength) {
        let text = '';
        let current = element.previousSibling;
        
        while (current && text.length < maxLength) {
            if (current.nodeType === Node.TEXT_NODE) {
                text = current.textContent + text;
            } else if (current.textContent) {
                text = current.textContent.substring(-maxLength) + text;
            }
            current = current.previousSibling;
        }
        
        return text.substring(-maxLength).trim();
    }

    getTextAfter(element, maxLength) {
        let text = '';
        let current = element.nextSibling;
        
        while (current && text.length < maxLength) {
            if (current.nodeType === Node.TEXT_NODE) {
                text += current.textContent;
            } else if (current.textContent) {
                text += current.textContent.substring(0, maxLength);
            }
            current = current.nextSibling;
        }
        
        return text.substring(0, maxLength).trim();
    }

    restoreLinksInText(textNodes, linkData) {
        // Find and restore links in simplified text
        for (const textNode of textNodes) {
            const text = textNode.textContent;
            if (text.includes(linkData.text)) {
                const linkElement = document.createElement('a');
                linkElement.href = linkData.href;
                linkElement.textContent = linkData.text;
                linkElement.title = linkData.title;
                linkElement.target = linkData.target;
                
                // Replace text with link
                const newText = text.replace(linkData.text, linkElement.outerHTML);
                const wrapper = document.createElement('div');
                wrapper.innerHTML = newText;
                
                // Replace text node with new content
                const parent = textNode.parentNode;
                while (wrapper.firstChild) {
                    parent.insertBefore(wrapper.firstChild, textNode);
                }
                parent.removeChild(textNode);
                break;
            }
        }
    }

    getTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim().length > 0) {
                textNodes.push(node);
            }
        }
        
        return textNodes;
    }

    restoreMediaElement(mediaData) {
        // Find appropriate location and restore media
        const paragraphs = this.mainContent.querySelectorAll('p');
        
        for (const p of paragraphs) {
            if (p.textContent.includes(mediaData.context.textBefore.substring(0, 20)) ||
                p.textContent.includes(mediaData.context.textAfter.substring(0, 20))) {
                
                const mediaElement = document.createElement(mediaData.tagName.toLowerCase());
                mediaElement.src = mediaData.src;
                mediaElement.alt = mediaData.alt;
                mediaElement.title = mediaData.title;
                
                if (mediaData.width) mediaElement.width = mediaData.width;
                if (mediaData.height) mediaElement.height = mediaData.height;
                
                // Insert after the paragraph
                p.parentNode.insertBefore(mediaElement, p.nextSibling);
                break;
            }
        }
    }

    restoreFormElement(formData) {
        // Add forms at the end of simplified content
        const formElement = document.createElement('form');
        formElement.action = formData.action;
        formElement.method = formData.method;
        formElement.innerHTML = formData.innerHTML;
        
        this.mainContent.appendChild(formElement);
    }

    parseSimplifiedContent(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const sections = [];
        let currentList = null;

        lines.forEach(line => {
            line = line.trim();
            
            if (line.startsWith('## ')) {
                // Heading
                if (currentList) {
                    sections.push(currentList);
                    currentList = null;
                }
                sections.push({
                    type: 'heading',
                    content: line.substring(3)
                });
            } else if (line.startsWith('• ')) {
                // List item
                if (!currentList) {
                    currentList = { type: 'list', items: [] };
                }
                currentList.items.push(line.substring(2));
            } else if (line.includes('important') || line.includes('note') || line.includes('warning')) {
                // Important information
                if (currentList) {
                    sections.push(currentList);
                    currentList = null;
                }
                sections.push({
                    type: 'important',
                    content: line
                });
            } else if (line.length > 0) {
                // Regular paragraph
                if (currentList) {
                    sections.push(currentList);
                    currentList = null;
                }
                sections.push({
                    type: 'paragraph',
                    content: line
                });
            }
        });

        if (currentList) {
            sections.push(currentList);
        }

        return sections;
    }

    addTooltips() {
        // Enhanced tooltips with original text comparison
        const elements = this.mainContent.querySelectorAll('p, li, h3');
        
        elements.forEach((element, index) => {
            // Store original text for comparison
            if (!element.dataset.originalText) {
                element.dataset.originalText = this.getOriginalTextForElement(element, index);
            }
            
            element.addEventListener('mouseenter', (e) => {
                this.showEnhancedTooltip(e.target);
            });
            
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
            
            // Add click handler for detailed comparison
            element.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) { // Ctrl+click or Cmd+click
                    this.showDetailedComparison(e.target);
                }
            });
        });
    }

    getOriginalTextForElement(element, index) {
        if (!this.originalContent) return element.textContent;
        
        // Try to find corresponding element in original content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.originalContent;
        const originalElements = tempDiv.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6');
        
        if (originalElements[index]) {
            return originalElements[index].textContent.trim();
        }
        
        return element.textContent;
    }

    showEnhancedTooltip(element) {
        const originalText = element.dataset.originalText || element.textContent;
        const currentText = element.textContent;
        
        // Calculate improvement metrics
        const originalWords = originalText.split(/\s+/).length;
        const currentWords = currentText.split(/\s+/).length;
        const wordReduction = originalWords - currentWords;
        const complexityBefore = this.quickComplexityScore(originalText);
        const complexityAfter = this.quickComplexityScore(currentText);
        
        const tooltip = document.createElement('div');
        tooltip.className = 'websimplify-enhanced-tooltip';
        
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-title">Simplification Details</span>
                <span class="tooltip-close">×</span>
            </div>
            <div class="tooltip-content">
                <div class="metric-row">
                    <span class="metric-label">Complexity:</span>
                    <span class="metric-value">
                        ${complexityBefore}/10 → ${complexityAfter}/10
                        <span class="improvement ${complexityBefore > complexityAfter ? 'positive' : 'neutral'}">
                            ${complexityBefore > complexityAfter ? '↓' + (complexityBefore - complexityAfter) : '→'}
                        </span>
                    </span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Words:</span>
                    <span class="metric-value">
                        ${originalWords} → ${currentWords}
                        ${wordReduction > 0 ? `<span class="improvement positive">-${wordReduction}</span>` : ''}
                    </span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Reading time:</span>
                    <span class="metric-value">
                        ${Math.ceil(originalWords/200)}min → ${Math.ceil(currentWords/200)}min
                    </span>
                </div>
                ${originalText !== currentText ? `
                <div class="original-preview">
                    <div class="preview-label">Original text:</div>
                    <div class="preview-text">${originalText.substring(0, 150)}${originalText.length > 150 ? '...' : ''}</div>
                </div>
                ` : ''}
                <div class="tooltip-hint">Ctrl+click for detailed comparison</div>
            </div>
        `;
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.position = 'fixed';
        tooltip.style.left = Math.min(rect.left, window.innerWidth - 350) + 'px';
        tooltip.style.top = Math.max(10, rect.top - 200) + 'px';
        tooltip.style.zIndex = '10003';
        
        // Add close handler
        tooltip.querySelector('.tooltip-close').addEventListener('click', () => {
            this.hideTooltip();
        });
        
        document.body.appendChild(tooltip);
        this.currentTooltip = tooltip;
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (this.currentTooltip === tooltip) {
                this.hideTooltip();
            }
        }, 10000);
    }

    showDetailedComparison(element) {
        const originalText = element.dataset.originalText || element.textContent;
        const currentText = element.textContent;
        
        if (originalText === currentText) {
            this.showStatus('This section has not been simplified', 'info');
            return;
        }
        
        // Create detailed comparison modal
        const modal = document.createElement('div');
        modal.className = 'websimplify-comparison-modal';
        
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Detailed Text Comparison</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="comparison-container">
                    <div class="comparison-side original-side">
                        <h4>Original Text</h4>
                        <div class="text-content">${originalText}</div>
                        <div class="text-stats">
                            <span>Words: ${originalText.split(/\s+/).length}</span>
                            <span>Complexity: ${this.quickComplexityScore(originalText)}/10</span>
                            <span>Reading time: ${Math.ceil(originalText.split(/\s+/).length/200)}min</span>
                        </div>
                    </div>
                    <div class="comparison-divider">→</div>
                    <div class="comparison-side simplified-side">
                        <h4>Simplified Text</h4>
                        <div class="text-content">${currentText}</div>
                        <div class="text-stats">
                            <span>Words: ${currentText.split(/\s+/).length}</span>
                            <span>Complexity: ${this.quickComplexityScore(currentText)}/10</span>
                            <span>Reading time: ${Math.ceil(currentText.split(/\s+/).length/200)}min</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="revertSection">Revert This Section</button>
                    <button class="btn-primary" id="closeModal">Close</button>
                </div>
            </div>
        `;
        
        // Add event handlers
        const closeModal = () => {
            modal.remove();
        };
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
        modal.querySelector('#closeModal').addEventListener('click', closeModal);
        
        modal.querySelector('#revertSection').addEventListener('click', () => {
            element.textContent = originalText;
            element.dataset.originalText = originalText;
            closeModal();
            this.showStatus('Section reverted to original text', 'info');
        });
        
        document.body.appendChild(modal);
        
        // Focus trap for accessibility
        modal.querySelector('.modal-close').focus();
    }

    async getExportData(options) {
        if (!this.mainContent) {
            throw new Error('No content available for export');
        }

        const title = document.title || 'Untitled Page';
        const url = window.location.href;
        
        // Get original and simplified content
        const originalText = this.originalContent ? 
            this.extractTextFromHTML(this.originalContent) : 
            this.extractTextContent(this.mainContent);
        
        const simplifiedText = this.extractTextContent(this.mainContent);
        const originalHTML = this.originalContent || this.mainContent.innerHTML;
        const simplifiedHTML = this.mainContent.innerHTML;

        // Calculate metrics
        const metrics = this.calculateReadingTime(originalText, simplifiedText);
        
        return {
            title,
            url,
            originalText,
            simplifiedText,
            originalContent: originalHTML,
            simplifiedContent: simplifiedHTML,
            metrics: {
                before: metrics.before,
                after: metrics.after,
                saved: metrics.saved,
                complexityReduction: metrics.detailed ? metrics.detailed.complexityReduction : 0
            },
            includeOriginal: options.includeOriginal,
            includeMetrics: options.includeMetrics,
            includeTimestamp: options.includeTimestamp,
            timestamp: new Date().toISOString()
        };
    }

    extractTextFromHTML(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        // Remove script and style elements
        tempDiv.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
        return tempDiv.textContent.trim();
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }

    calculateReadingTime(original, simplified) {
        const avgWordsPerMinute = 200;
        const avgWordsPerMinuteFast = 250;
        const avgWordsPerMinuteSlow = 150;
        
        const originalWords = original.split(/\s+/).length;
        const simplifiedWords = simplified.split(/\s+/).length;
        
        // Calculate for different reading speeds
        const times = {
            original: {
                average: Math.ceil(originalWords / avgWordsPerMinute),
                fast: Math.ceil(originalWords / avgWordsPerMinuteFast),
                slow: Math.ceil(originalWords / avgWordsPerMinuteSlow)
            },
            simplified: {
                average: Math.ceil(simplifiedWords / avgWordsPerMinute),
                fast: Math.ceil(simplifiedWords / avgWordsPerMinuteFast),
                slow: Math.ceil(simplifiedWords / avgWordsPerMinuteSlow)
            }
        };
        
        // Calculate savings
        const saved = {
            average: Math.max(0, times.original.average - times.simplified.average),
            fast: Math.max(0, times.original.fast - times.simplified.fast),
            slow: Math.max(0, times.original.slow - times.simplified.slow)
        };
        
        // Calculate comprehension improvement (estimated)
        const complexityReduction = this.calculateComplexityReduction(original, simplified);
        const comprehensionBoost = Math.round(complexityReduction * 15); // 15% boost per complexity point
        
        return {
            before: times.original.average,
            after: times.simplified.average,
            saved: saved.average,
            detailed: {
                original: times.original,
                simplified: times.simplified,
                saved: saved,
                wordCount: {
                    original: originalWords,
                    simplified: simplifiedWords,
                    reduction: originalWords - simplifiedWords
                },
                comprehensionBoost: comprehensionBoost,
                complexityReduction: complexityReduction
            }
        };
    }

    calculateComplexityReduction(original, simplified) {
        const originalComplexity = this.quickComplexityScore(original);
        const simplifiedComplexity = this.quickComplexityScore(simplified);
        return Math.max(0, originalComplexity - simplifiedComplexity);
    }

    quickComplexityScore(text) {
        const words = text.split(/\s+/);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgWordsPerSentence = words.length / Math.max(1, sentences.length);
        
        let score = 1;
        if (avgWordsPerSentence > 20) score += 3;
        else if (avgWordsPerSentence > 15) score += 2;
        else if (avgWordsPerSentence > 10) score += 1;
        
        const longWords = words.filter(word => word.length > 7).length;
        score += (longWords / words.length) * 2;
        
        return Math.min(10, Math.max(1, Math.round(score)));
    }

    restoreOriginal() {
        if (this.originalContent && this.mainContent) {
            this.mainContent.innerHTML = this.originalContent;
            this.mainContent.classList.remove('websimplify-simplified');
            this.isSimplified = false;
        }
    }

    async updateSimplificationLevel(level) {
        if (this.isSimplified) {
            // Re-simplify with new level
            await this.simplifyPage(level);
        }
    }

    toggleSplitView() {
        if (!this.mainContent) return;

        if (!this.isSplitView) {
            this.enableSplitView();
        } else {
            this.disableSplitView();
        }
        
        this.isSplitView = !this.isSplitView;
    }

    enableSplitView() {
        // Store original content if not already stored
        if (!this.originalContent) {
            this.originalContent = this.mainContent.innerHTML;
        }

        // Create split container
        const splitContainer = document.createElement('div');
        splitContainer.className = 'websimplify-split-container';
        splitContainer.id = 'websimplify-split';

        // Create original content side
        const originalSide = document.createElement('div');
        originalSide.className = 'websimplify-split-original';
        originalSide.innerHTML = this.originalContent;

        // Create simplified content side
        const simplifiedSide = document.createElement('div');
        simplifiedSide.className = 'websimplify-split-simplified';
        
        // Get simplified content
        if (this.isSimplified) {
            simplifiedSide.innerHTML = this.mainContent.innerHTML;
        } else {
            // Generate simplified version
            const text = this.extractTextContent(this.mainContent);
            this.simplifyBasic(text, 2).then(simplified => {
                const sections = this.parseSimplifiedContent(simplified);
                let html = '';
                sections.forEach(section => {
                    switch (section.type) {
                        case 'heading':
                            html += `<h3 class="websimplify-heading">${section.content}</h3>`;
                            break;
                        case 'list':
                            html += '<ul class="websimplify-list">';
                            section.items.forEach(item => {
                                html += `<li class="websimplify-list-item">${item}</li>`;
                            });
                            html += '</ul>';
                            break;
                        case 'paragraph':
                            html += `<p class="websimplify-paragraph">${section.content}</p>`;
                            break;
                    }
                });
                simplifiedSide.innerHTML = html;
            });
        }

        // Add synchronized scrolling
        this.addSynchronizedScrolling(originalSide, simplifiedSide);

        // Assemble split view
        splitContainer.appendChild(originalSide);
        splitContainer.appendChild(simplifiedSide);

        // Replace main content
        this.mainContent.style.display = 'none';
        this.mainContent.parentNode.insertBefore(splitContainer, this.mainContent);

        console.log('Split view enabled');
    }

    disableSplitView() {
        const splitContainer = document.getElementById('websimplify-split');
        if (splitContainer) {
            splitContainer.remove();
            this.mainContent.style.display = '';
        }
        console.log('Split view disabled');
    }

    addSynchronizedScrolling(left, right) {
        let isScrolling = false;

        left.addEventListener('scroll', () => {
            if (isScrolling) return;
            isScrolling = true;
            
            const scrollPercentage = left.scrollTop / (left.scrollHeight - left.clientHeight);
            right.scrollTop = scrollPercentage * (right.scrollHeight - right.clientHeight);
            
            setTimeout(() => { isScrolling = false; }, 10);
        });

        right.addEventListener('scroll', () => {
            if (isScrolling) return;
            isScrolling = true;
            
            const scrollPercentage = right.scrollTop / (right.scrollHeight - right.clientHeight);
            left.scrollTop = scrollPercentage * (left.scrollHeight - left.clientHeight);
            
            setTimeout(() => { isScrolling = false; }, 10);
        });
    }

    toggleHeatmap() {
        if (!this.mainContent) return;

        if (!this.isHeatmapActive) {
            this.enableHeatmap();
        } else {
            this.disableHeatmap();
        }
        
        this.isHeatmapActive = !this.isHeatmapActive;
    }

    async enableHeatmap() {
        // Performance-optimized heatmap generation
        return await this.measurePerformanceAsync('enableHeatmap', async () => {
            // Use Intersection Observer for performance
            const contentSections = this.getContentSectionsOptimized();
            this.heatmapElements = [];

            // Batch process sections for better performance
            const batchSize = 5;
            for (let i = 0; i < contentSections.length; i += batchSize) {
                const batch = contentSections.slice(i, i + batchSize);
                
                await Promise.all(batch.map(async (section) => {
                    const complexity = await this.analyzeElementComplexity(section);
                    const overlay = this.createHeatmapOverlay(section, complexity);
                    this.heatmapElements.push(overlay);
                }));
                
                // Use requestAnimationFrame for smooth rendering
                await new Promise(resolve => requestAnimationFrame(resolve));
            }

            // Batch DOM insertion
            const fragment = document.createDocumentFragment();
            this.heatmapElements.forEach(overlay => fragment.appendChild(overlay));
            document.body.appendChild(fragment);

            // Add click handlers with event delegation
            this.addHeatmapInteractionsOptimized();
            
            console.log('Heatmap enabled with', this.heatmapElements.length, 'overlays');
        });
    }

    getContentSectionsOptimized() {
        // More efficient content section detection
        const sections = [];
        const walker = document.createTreeWalker(
            this.mainContent,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    // Filter relevant elements efficiently
                    const tagName = node.tagName.toLowerCase();
                    const textLength = node.textContent.trim().length;
                    
                    if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) && textLength > 50) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    if (tagName === 'li' && textLength > 30) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    if (tagName === 'div' && textLength > 100 && 
                        !node.querySelector('p, h1, h2, h3, h4, h5, h6')) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            sections.push(node);
            // Limit sections for performance
            if (sections.length >= 50) break;
        }

        return sections;
    }

    addHeatmapInteractionsOptimized() {
        // Use event delegation for better performance
        document.body.addEventListener('click', this.handleHeatmapClick.bind(this));
        document.body.addEventListener('mouseenter', this.handleHeatmapHover.bind(this), true);
        document.body.addEventListener('mouseleave', this.handleHeatmapLeave.bind(this), true);
    }

    handleHeatmapClick(e) {
        if (!e.target.classList.contains('websimplify-heatmap')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const complexity = parseInt(e.target.dataset.complexity);
        this.simplifySection(e.target, complexity);
    }

    handleHeatmapHover(e) {
        if (!e.target.classList.contains('websimplify-heatmap')) return;
        
        const complexity = e.target.dataset.complexity;
        this.showComplexityTooltip(e.target, complexity);
    }

    handleHeatmapLeave(e) {
        if (!e.target.classList.contains('websimplify-heatmap')) return;
        
        this.hideTooltip();
    }

    disableHeatmap() {
        this.heatmapElements.forEach(overlay => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });
        this.heatmapElements = [];
        console.log('Heatmap disabled');
    }

    getContentSections() {
        const sections = [];
        
        // Get paragraphs
        this.mainContent.querySelectorAll('p').forEach(p => {
            if (p.textContent.trim().length > 50) {
                sections.push(p);
            }
        });

        // Get headings with following content
        this.mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            sections.push(heading);
        });

        // Get list items
        this.mainContent.querySelectorAll('li').forEach(li => {
            if (li.textContent.trim().length > 30) {
                sections.push(li);
            }
        });

        // Get divs with substantial text
        this.mainContent.querySelectorAll('div').forEach(div => {
            if (div.textContent.trim().length > 100 && 
                !div.querySelector('p, h1, h2, h3, h4, h5, h6')) {
                sections.push(div);
            }
        });

        return sections;
    }

    async analyzeElementComplexity(element) {
        const text = element.textContent.trim();
        if (text.length < 20) return 1;

        // Quick complexity analysis for individual elements
        let complexity = 1;
        
        const words = text.split(/\s+/);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        // Sentence length
        const avgWordsPerSentence = words.length / Math.max(1, sentences.length);
        if (avgWordsPerSentence > 20) complexity += 3;
        else if (avgWordsPerSentence > 15) complexity += 2;
        else if (avgWordsPerSentence > 10) complexity += 1;
        
        // Long words
        const longWords = words.filter(word => word.length > 7).length;
        complexity += (longWords / words.length) * 2;
        
        // Technical terms
        const technicalTerms = text.match(/\b(algorithm|implementation|methodology|infrastructure|optimization|quantum|molecular|constitutional|derivative)\b/gi) || [];
        complexity += Math.min(2, technicalTerms.length / 3);
        
        return Math.min(10, Math.max(1, Math.round(complexity)));
    }

    createHeatmapOverlay(element, complexity) {
        const overlay = document.createElement('div');
        overlay.className = 'websimplify-heatmap';
        
        // Set complexity class
        if (complexity <= 3) {
            overlay.classList.add('complexity-low');
        } else if (complexity <= 6) {
            overlay.classList.add('complexity-medium');
        } else {
            overlay.classList.add('complexity-high');
        }

        // Position overlay
        this.positionOverlay(overlay, element);
        
        // Store reference to original element
        overlay.dataset.complexity = complexity;
        overlay.dataset.elementId = this.generateElementId(element);
        
        return overlay;
    }

    positionOverlay(overlay, element) {
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        overlay.style.position = 'absolute';
        overlay.style.top = (rect.top + scrollTop) + 'px';
        overlay.style.left = (rect.left + scrollLeft) + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.zIndex = '9999';
    }

    generateElementId(element) {
        return 'elem_' + Math.random().toString(36).substr(2, 9);
    }

    addHeatmapInteractions() {
        this.heatmapElements.forEach(overlay => {
            // Click to simplify specific section
            overlay.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const complexity = parseInt(overlay.dataset.complexity);
                const elementId = overlay.dataset.elementId;
                
                // Find original element and simplify it
                await this.simplifySection(overlay, complexity);
            });

            // Hover to show complexity info
            overlay.addEventListener('mouseenter', (e) => {
                const complexity = overlay.dataset.complexity;
                this.showComplexityTooltip(e.target, complexity);
            });

            overlay.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    async simplifySection(overlay, complexity) {
        // Find the original element
        const rect = {
            top: parseInt(overlay.style.top),
            left: parseInt(overlay.style.left),
            width: parseInt(overlay.style.width),
            height: parseInt(overlay.style.height)
        };

        const element = this.findElementByPosition(rect);
        if (!element) return;

        // Simplify the specific element
        const originalText = element.textContent;
        const simplifiedText = await this.simplifyBasic(originalText, 2);
        
        // Apply simplification with animation
        element.style.transition = 'all 0.3s ease';
        element.style.opacity = '0.5';
        
        setTimeout(() => {
            element.textContent = simplifiedText;
            element.style.opacity = '1';
            
            // Update overlay color to show it's been simplified
            overlay.className = 'websimplify-heatmap complexity-low';
            overlay.dataset.complexity = '2';
        }, 300);
    }

    findElementByPosition(rect) {
        const elements = this.mainContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div');
        
        for (const element of elements) {
            const elementRect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            const elementTop = elementRect.top + scrollTop;
            const elementLeft = elementRect.left + scrollLeft;
            
            if (Math.abs(elementTop - rect.top) < 5 && 
                Math.abs(elementLeft - rect.left) < 5 &&
                Math.abs(elementRect.width - rect.width) < 10) {
                return element;
            }
        }
        
        return null;
    }

    showComplexityTooltip(element, complexity) {
        const tooltip = document.createElement('div');
        tooltip.className = 'websimplify-complexity-tooltip';
        
        const level = complexity <= 3 ? 'Low' : complexity <= 6 ? 'Medium' : 'High';
        const color = complexity <= 3 ? '#2ecc71' : complexity <= 6 ? '#f39c12' : '#e74c3c';
        
        tooltip.innerHTML = `
            <div style="color: ${color}; font-weight: bold;">
                Complexity: ${level} (${complexity}/10)
            </div>
            <div style="font-size: 12px; margin-top: 4px;">
                Click to simplify this section
            </div>
        `;
        
        const rect = element.getBoundingClientRect();
        tooltip.style.position = 'fixed';
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.top - 60) + 'px';
        tooltip.style.zIndex = '10002';
        
        document.body.appendChild(tooltip);
        this.currentTooltip = tooltip;
    }

    resetPage() {
        // Restore original content
        this.restoreOriginal();
        
        // Disable split view
        if (this.isSplitView) {
            this.disableSplitView();
            this.isSplitView = false;
        }
        
        // Disable heatmap
        if (this.isHeatmapActive) {
            this.disableHeatmap();
            this.isHeatmapActive = false;
        }
        
        // Remove any overlays or modifications
        document.querySelectorAll('.websimplify-overlay, .websimplify-heatmap, .websimplify-complexity-tooltip').forEach(el => {
            el.remove();
        });
        
        // Hide tooltip
        this.hideTooltip();
        
        console.log('Page reset to original state');
    }

    injectStyles() {
        // Inject CSS for simplified content with performance optimization
        if (document.getElementById('websimplify-styles')) return; // Prevent duplicate injection
        
        const style = document.createElement('style');
        style.id = 'websimplify-styles';
        style.textContent = `
            .websimplify-simplified {
                line-height: 1.6 !important;
                font-size: 16px !important;
                max-width: 800px !important;
                margin: 0 auto !important;
                padding: 20px !important;
                transition: all 0.3s ease !important;
                will-change: opacity, transform !important;
            }
            
            .websimplify-simplified p {
                margin-bottom: 16px !important;
                text-align: left !important;
            }
            
            .websimplify-simplified ul {
                margin: 16px 0 !important;
                padding-left: 24px !important;
            }
            
            .websimplify-simplified li {
                margin-bottom: 8px !important;
            }
            
            .websimplify-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 10000;
            }

            /* Accessibility enhancements */
            .websimplify-simplified:focus-within {
                outline: 3px solid #3498db !important;
                outline-offset: 2px !important;
            }

            /* High contrast mode */
            @media (prefers-contrast: high) {
                .websimplify-simplified {
                    background: #ffffff !important;
                    color: #000000 !important;
                    border: 2px solid #000000 !important;
                }
            }

            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                .websimplify-simplified,
                .websimplify-heatmap,
                .websimplify-tooltip {
                    transition: none !important;
                    animation: none !important;
                }
            }

            /* Performance optimizations */
            .websimplify-heatmap {
                transform: translateZ(0) !important;
                backface-visibility: hidden !important;
            }
        `;
        
        document.head.appendChild(style);
    }

    async loadContextAnalyzer() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('src/utils/context-analyzer.js');
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Learning Mode Methods
    toggleLearningMode() {
        // Load learning overlay if not already loaded
        if (!document.getElementById('learning-overlay')) {
            this.loadLearningOverlay();
        }

        // Send message to learning overlay
        const event = new CustomEvent('toggleLearningMode');
        document.dispatchEvent(event);
    }

    loadLearningOverlay() {
        // Inject learning overlay script
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/content/learning-overlay.js');
        document.head.appendChild(script);
    }

    // Performance monitoring
    measurePerformance(operation, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        console.log(`WebSimplify: ${operation} took ${(end - start).toFixed(2)}ms`);
        
        // Track performance metrics
        this.trackPerformance(operation, end - start);
        
        return result;
    }

    async measurePerformanceAsync(operation, fn) {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        
        console.log(`WebSimplify: ${operation} took ${(end - start).toFixed(2)}ms`);
        
        // Track performance metrics
        this.trackPerformance(operation, end - start);
        
        return result;
    }

    trackPerformance(operation, duration) {
        try {
            chrome.runtime.sendMessage({
                action: 'trackAnalytics',
                data: {
                    type: 'performance',
                    operation: operation,
                    duration: duration,
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            // Silently fail if analytics tracking fails
        }
    }
}

// Initialize content script
if (document.location.href.startsWith('http')) {
    new WebSimplifyContent();
}
