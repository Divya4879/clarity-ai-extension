// Contextual Simplification - User Background Analysis
class ContextAnalyzer {
    constructor() {
        this.userProfile = null;
        this.domainFamiliarity = {};
        this.browsingPatterns = {};
        this.init();
    }

    async init() {
        await this.loadUserProfile();
        this.setupPatternTracking();
    }

    async loadUserProfile() {
        const profile = await chrome.storage.sync.get({
            userProfile: {
                experienceLevel: 'intermediate', // beginner, intermediate, expert
                domains: {},
                preferences: {
                    technicalTerms: 'simplify',
                    sentenceLength: 'medium',
                    explanationDepth: 'moderate'
                },
                learningGoals: []
            }
        });

        this.userProfile = profile.userProfile;
    }

    async analyzeUserContext(domain, content) {
        // Analyze domain familiarity
        const domainFamiliarity = await this.getDomainFamiliarity(domain);
        
        // Analyze content complexity relative to user
        const relativeComplexity = this.calculateRelativeComplexity(content, domainFamiliarity);
        
        // Determine optimal simplification level
        const simplificationLevel = this.determineSimplificationLevel(relativeComplexity, domainFamiliarity);
        
        return {
            domainFamiliarity,
            relativeComplexity,
            simplificationLevel,
            adaptivePrompt: this.generateAdaptivePrompt(domain, simplificationLevel)
        };
    }

    async getDomainFamiliarity(domain) {
        const domainData = this.userProfile.domains[domain] || {
            visitCount: 0,
            timeSpent: 0,
            complexityHandled: 0,
            lastVisit: null
        };

        // Calculate familiarity score (0-1)
        const visitScore = Math.min(domainData.visitCount / 20, 1);
        const timeScore = Math.min(domainData.timeSpent / 3600000, 1); // 1 hour = max
        const complexityScore = Math.min(domainData.complexityHandled / 10, 1);

        return {
            score: (visitScore + timeScore + complexityScore) / 3,
            level: this.getFamiliarityLevel((visitScore + timeScore + complexityScore) / 3),
            data: domainData
        };
    }

    getFamiliarityLevel(score) {
        if (score < 0.3) return 'novice';
        if (score < 0.7) return 'familiar';
        return 'expert';
    }

    calculateRelativeComplexity(content, domainFamiliarity) {
        // Base complexity analysis
        const baseComplexity = this.analyzeBaseComplexity(content);
        
        // Adjust based on domain familiarity
        const familiarityAdjustment = 1 - (domainFamiliarity.score * 0.4);
        
        return Math.min(baseComplexity * familiarityAdjustment, 10);
    }

    analyzeBaseComplexity(content) {
        const text = content.textContent || content;
        
        // Multiple complexity factors
        const avgSentenceLength = this.getAverageSentenceLength(text);
        const technicalTerms = this.countTechnicalTerms(text);
        const passiveVoice = this.countPassiveVoice(text);
        const nestedClauses = this.countNestedClauses(text);
        
        // Weighted complexity score
        let complexity = 0;
        complexity += Math.min(avgSentenceLength / 5, 3); // Max 3 points
        complexity += Math.min(technicalTerms / 10, 2); // Max 2 points
        complexity += Math.min(passiveVoice / 5, 2); // Max 2 points
        complexity += Math.min(nestedClauses / 3, 3); // Max 3 points
        
        return Math.min(complexity, 10);
    }

    determineSimplificationLevel(relativeComplexity, domainFamiliarity) {
        const userExperience = this.userProfile.experienceLevel;
        
        // Base level from complexity
        let level = 1;
        if (relativeComplexity > 6) level = 3;
        else if (relativeComplexity > 3) level = 2;
        
        // Adjust for user experience
        if (userExperience === 'beginner') level = Math.min(level + 1, 3);
        if (userExperience === 'expert') level = Math.max(level - 1, 1);
        
        // Adjust for domain familiarity
        if (domainFamiliarity.level === 'expert') level = Math.max(level - 1, 1);
        if (domainFamiliarity.level === 'novice') level = Math.min(level + 1, 3);
        
        return level;
    }

    generateAdaptivePrompt(domain, level) {
        const domainPrompts = {
            'academic': {
                1: 'Explain this academic content in simple terms, like explaining to a high school student.',
                2: 'Simplify this academic content while keeping key concepts clear.',
                3: 'Make this academic content more accessible while preserving technical accuracy.'
            },
            'legal': {
                1: 'Translate this legal text into plain English that anyone can understand.',
                2: 'Simplify this legal content while keeping important legal concepts.',
                3: 'Make this legal text clearer while maintaining legal precision.'
            },
            'technical': {
                1: 'Explain this technical content in everyday language with simple analogies.',
                2: 'Simplify this technical content for someone learning the field.',
                3: 'Make this technical content clearer while keeping necessary technical terms.'
            },
            'medical': {
                1: 'Explain this medical information in simple terms for patients.',
                2: 'Simplify this medical content while keeping important health information.',
                3: 'Make this medical text more accessible while maintaining medical accuracy.'
            },
            'financial': {
                1: 'Explain this financial information in simple, everyday terms.',
                2: 'Simplify this financial content for general understanding.',
                3: 'Make this financial text clearer while keeping key financial concepts.'
            }
        };

        const domainType = this.detectDomainType(domain);
        return domainPrompts[domainType]?.[level] || 
               `Simplify this content to level ${level} complexity while preserving meaning.`;
    }

    detectDomainType(domain) {
        const patterns = {
            'academic': /\.(edu|ac\.|uni-)/,
            'legal': /law|legal|court|gov/,
            'technical': /github|stackoverflow|docs|api/,
            'medical': /health|medical|med|hospital/,
            'financial': /bank|finance|invest|money/
        };

        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(domain)) return type;
        }
        return 'general';
    }

    async updateUserProfile(domain, complexity, timeSpent) {
        if (!this.userProfile.domains[domain]) {
            this.userProfile.domains[domain] = {
                visitCount: 0,
                timeSpent: 0,
                complexityHandled: 0,
                lastVisit: null
            };
        }

        const domainData = this.userProfile.domains[domain];
        domainData.visitCount++;
        domainData.timeSpent += timeSpent;
        domainData.complexityHandled = Math.max(domainData.complexityHandled, complexity);
        domainData.lastVisit = Date.now();

        await chrome.storage.sync.set({ userProfile: this.userProfile });
    }

    // Helper methods
    getAverageSentenceLength(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const totalWords = text.split(/\s+/).length;
        return sentences.length > 0 ? totalWords / sentences.length : 0;
    }

    countTechnicalTerms(text) {
        const technicalPatterns = [
            /\b\w+tion\b/g, /\b\w+ment\b/g, /\b\w+ness\b/g,
            /\b\w{12,}\b/g, // Long words
            /\b[A-Z]{2,}\b/g // Acronyms
        ];
        
        let count = 0;
        technicalPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) count += matches.length;
        });
        
        return count;
    }

    countPassiveVoice(text) {
        const passivePatterns = [
            /\b(was|were|is|are|been|being)\s+\w+ed\b/g,
            /\b(was|were|is|are|been|being)\s+\w+en\b/g
        ];
        
        let count = 0;
        passivePatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) count += matches.length;
        });
        
        return count;
    }

    countNestedClauses(text) {
        const nestedPatterns = [
            /,\s*which/g, /,\s*that/g, /,\s*who/g,
            /\([^)]+\)/g, // Parenthetical clauses
        ];
        
        let count = 0;
        nestedPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) count += matches.length;
        });
        
        return count;
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContextAnalyzer;
} else {
    window.ContextAnalyzer = ContextAnalyzer;
}
