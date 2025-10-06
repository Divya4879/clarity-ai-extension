// AI Confidence Analyzer - Transparency & Uncertainty Detection
class ConfidenceAnalyzer {
    constructor() {
        this.confidenceThresholds = {
            high: 0.8,
            medium: 0.6,
            low: 0.4
        };
        this.uncertaintyPatterns = [];
        this.userFeedback = new Map();
        this.init();
    }

    init() {
        this.setupUncertaintyPatterns();
        this.loadUserFeedback();
    }

    setupUncertaintyPatterns() {
        this.uncertaintyPatterns = [
            // Ambiguous language indicators
            { pattern: /\b(might|could|perhaps|possibly|maybe|likely|probably)\b/gi, weight: 0.3 },
            { pattern: /\b(unclear|ambiguous|uncertain|vague)\b/gi, weight: 0.5 },
            
            // Technical complexity indicators
            { pattern: /\b[A-Z]{3,}\b/g, weight: 0.2 }, // Acronyms
            { pattern: /\b\w{15,}\b/g, weight: 0.3 }, // Very long words
            { pattern: /[()[\]{}]/g, weight: 0.1 }, // Parentheses and brackets
            
            // Sentence structure complexity
            { pattern: /[,;:]{2,}/g, weight: 0.4 }, // Multiple punctuation
            { pattern: /\b(however|nevertheless|furthermore|moreover|consequently)\b/gi, weight: 0.2 },
            
            // Domain-specific uncertainty
            { pattern: /\b(approximately|roughly|about|around|estimated)\b/gi, weight: 0.3 },
            { pattern: /\b(according to|allegedly|reportedly|supposedly)\b/gi, weight: 0.4 }
        ];
    }

    async analyzeConfidence(originalText, simplifiedText, context = {}) {
        try {
            // Multi-factor confidence analysis
            const factors = {
                textSimilarity: this.calculateTextSimilarity(originalText, simplifiedText),
                complexityReduction: this.calculateComplexityReduction(originalText, simplifiedText),
                uncertaintyScore: this.detectUncertainty(originalText),
                contextualFit: this.analyzeContextualFit(simplifiedText, context),
                aiModelConfidence: await this.getAIModelConfidence(originalText, simplifiedText),
                userFeedbackScore: this.getUserFeedbackScore(originalText, simplifiedText)
            };

            // Calculate weighted confidence score
            const confidence = this.calculateWeightedConfidence(factors);
            
            // Determine confidence level and flags
            const level = this.getConfidenceLevel(confidence);
            const flags = this.generateConfidenceFlags(factors, confidence);
            const recommendations = this.generateRecommendations(factors, confidence);

            return {
                confidence: Math.round(confidence * 100) / 100,
                level,
                factors,
                flags,
                recommendations,
                needsReview: confidence < this.confidenceThresholds.medium,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('Confidence analysis failed:', error);
            return this.getDefaultConfidence();
        }
    }

    calculateTextSimilarity(original, simplified) {
        // Calculate semantic similarity using word overlap and structure
        const originalWords = this.tokenize(original.toLowerCase());
        const simplifiedWords = this.tokenize(simplified.toLowerCase());
        
        const commonWords = originalWords.filter(word => simplifiedWords.includes(word));
        const similarity = commonWords.length / Math.max(originalWords.length, simplifiedWords.length);
        
        // Adjust for length difference (too much change might indicate low confidence)
        const lengthRatio = Math.min(simplified.length, original.length) / Math.max(simplified.length, original.length);
        
        return (similarity * 0.7) + (lengthRatio * 0.3);
    }

    calculateComplexityReduction(original, simplified) {
        const originalComplexity = this.calculateTextComplexity(original);
        const simplifiedComplexity = this.calculateTextComplexity(simplified);
        
        // Good simplification should reduce complexity significantly
        const reduction = (originalComplexity - simplifiedComplexity) / originalComplexity;
        
        // Optimal reduction is 30-70% (too little or too much might indicate issues)
        if (reduction >= 0.3 && reduction <= 0.7) {
            return 0.9;
        } else if (reduction >= 0.2 && reduction <= 0.8) {
            return 0.7;
        } else {
            return 0.4;
        }
    }

    detectUncertainty(text) {
        let uncertaintyScore = 0;
        let totalMatches = 0;

        this.uncertaintyPatterns.forEach(({ pattern, weight }) => {
            const matches = text.match(pattern) || [];
            uncertaintyScore += matches.length * weight;
            totalMatches += matches.length;
        });

        // Normalize by text length
        const normalizedScore = uncertaintyScore / (text.length / 1000);
        
        // Convert to confidence (inverse of uncertainty)
        return Math.max(0, 1 - Math.min(normalizedScore, 1));
    }

    analyzeContextualFit(simplifiedText, context) {
        const { domain, userLevel, targetAudience } = context;
        
        let fitScore = 0.7; // Base score
        
        // Domain-specific analysis
        if (domain) {
            const domainTerms = this.getDomainTerms(domain);
            const hasAppropriateTerms = domainTerms.some(term => 
                simplifiedText.toLowerCase().includes(term.toLowerCase())
            );
            fitScore += hasAppropriateTerms ? 0.1 : -0.1;
        }

        // User level appropriateness
        if (userLevel) {
            const complexity = this.calculateTextComplexity(simplifiedText);
            const expectedComplexity = this.getExpectedComplexity(userLevel);
            const complexityDiff = Math.abs(complexity - expectedComplexity);
            fitScore += Math.max(0, 0.2 - complexityDiff);
        }

        return Math.max(0, Math.min(fitScore, 1));
    }

    async getAIModelConfidence(original, simplified) {
        // Simulate AI model confidence (in real implementation, this would come from the AI API)
        try {
            // Factors that might indicate AI confidence
            const factors = {
                lengthRatio: simplified.length / original.length,
                structurePreservation: this.analyzeStructurePreservation(original, simplified),
                grammarCorrectness: this.checkGrammar(simplified),
                coherence: this.analyzeCoherence(simplified)
            };

            // Weighted confidence calculation
            let confidence = 0.7; // Base confidence
            
            // Optimal length ratio is 0.6-0.8
            if (factors.lengthRatio >= 0.6 && factors.lengthRatio <= 0.8) {
                confidence += 0.1;
            } else {
                confidence -= 0.1;
            }

            confidence += factors.structurePreservation * 0.1;
            confidence += factors.grammarCorrectness * 0.1;
            confidence += factors.coherence * 0.1;

            return Math.max(0, Math.min(confidence, 1));

        } catch (error) {
            return 0.5; // Default moderate confidence
        }
    }

    getUserFeedbackScore(original, simplified) {
        const key = this.generateContentKey(original, simplified);
        const feedback = this.userFeedback.get(key);
        
        if (!feedback) return 0.7; // Default score for new content
        
        const { positive, negative, total } = feedback;
        return total > 0 ? positive / total : 0.7;
    }

    calculateWeightedConfidence(factors) {
        const weights = {
            textSimilarity: 0.2,
            complexityReduction: 0.25,
            uncertaintyScore: 0.15,
            contextualFit: 0.15,
            aiModelConfidence: 0.15,
            userFeedbackScore: 0.1
        };

        let weightedSum = 0;
        let totalWeight = 0;

        Object.entries(factors).forEach(([factor, value]) => {
            if (weights[factor] && typeof value === 'number') {
                weightedSum += value * weights[factor];
                totalWeight += weights[factor];
            }
        });

        return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    }

    getConfidenceLevel(confidence) {
        if (confidence >= this.confidenceThresholds.high) return 'high';
        if (confidence >= this.confidenceThresholds.medium) return 'medium';
        return 'low';
    }

    generateConfidenceFlags(factors, confidence) {
        const flags = [];

        if (confidence < this.confidenceThresholds.low) {
            flags.push({
                type: 'warning',
                message: 'Low confidence simplification - review recommended',
                severity: 'high'
            });
        }

        if (factors.uncertaintyScore < 0.5) {
            flags.push({
                type: 'uncertainty',
                message: 'Original text contains ambiguous language',
                severity: 'medium'
            });
        }

        if (factors.complexityReduction < 0.5) {
            flags.push({
                type: 'complexity',
                message: 'Limited complexity reduction achieved',
                severity: 'medium'
            });
        }

        if (factors.textSimilarity < 0.3) {
            flags.push({
                type: 'similarity',
                message: 'Significant changes from original - verify accuracy',
                severity: 'high'
            });
        }

        if (factors.aiModelConfidence < 0.6) {
            flags.push({
                type: 'ai_uncertainty',
                message: 'AI model reports low confidence',
                severity: 'medium'
            });
        }

        return flags;
    }

    generateRecommendations(factors, confidence) {
        const recommendations = [];

        if (confidence < this.confidenceThresholds.medium) {
            recommendations.push({
                action: 'review',
                message: 'Manual review recommended before using this simplification',
                priority: 'high'
            });
        }

        if (factors.complexityReduction < 0.4) {
            recommendations.push({
                action: 'increase_simplification',
                message: 'Consider using a higher simplification level',
                priority: 'medium'
            });
        }

        if (factors.uncertaintyScore < 0.6) {
            recommendations.push({
                action: 'clarify_source',
                message: 'Original content may need clarification before simplification',
                priority: 'medium'
            });
        }

        if (factors.userFeedbackScore < 0.5) {
            recommendations.push({
                action: 'check_feedback',
                message: 'Similar content has received negative feedback',
                priority: 'high'
            });
        }

        return recommendations;
    }

    // User feedback methods
    async recordFeedback(original, simplified, isPositive, comment = '') {
        const key = this.generateContentKey(original, simplified);
        const existing = this.userFeedback.get(key) || { positive: 0, negative: 0, total: 0, comments: [] };
        
        if (isPositive) {
            existing.positive++;
        } else {
            existing.negative++;
        }
        existing.total++;
        
        if (comment) {
            existing.comments.push({
                comment,
                isPositive,
                timestamp: Date.now()
            });
        }

        this.userFeedback.set(key, existing);
        await this.saveFeedbackToStorage();
        
        return existing;
    }

    async loadUserFeedback() {
        try {
            const result = await chrome.storage.local.get({ confidenceFeedback: {} });
            this.userFeedback = new Map(Object.entries(result.confidenceFeedback));
        } catch (error) {
            console.error('Failed to load user feedback:', error);
        }
    }

    async saveFeedbackToStorage() {
        try {
            const feedbackObj = Object.fromEntries(this.userFeedback);
            await chrome.storage.local.set({ confidenceFeedback: feedbackObj });
        } catch (error) {
            console.error('Failed to save user feedback:', error);
        }
    }

    // Helper methods
    tokenize(text) {
        return text.toLowerCase().match(/\b\w+\b/g) || [];
    }

    calculateTextComplexity(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = this.tokenize(text);
        
        const avgSentenceLength = words.length / sentences.length;
        const longWords = words.filter(word => word.length > 6).length;
        const longWordRatio = longWords / words.length;
        
        return (avgSentenceLength / 20) + (longWordRatio * 2);
    }

    analyzeStructurePreservation(original, simplified) {
        const originalSentences = original.split(/[.!?]+/).length;
        const simplifiedSentences = simplified.split(/[.!?]+/).length;
        
        const structureRatio = Math.min(originalSentences, simplifiedSentences) / 
                              Math.max(originalSentences, simplifiedSentences);
        
        return structureRatio;
    }

    checkGrammar(text) {
        // Basic grammar checking (in real implementation, use proper grammar checker)
        const issues = [
            /\b(a)\s+[aeiou]/gi, // "a" before vowels
            /\s{2,}/g, // Multiple spaces
            /[.!?]{2,}/g // Multiple punctuation
        ];
        
        let issueCount = 0;
        issues.forEach(pattern => {
            const matches = text.match(pattern) || [];
            issueCount += matches.length;
        });
        
        return Math.max(0, 1 - (issueCount / (text.length / 100)));
    }

    analyzeCoherence(text) {
        // Basic coherence analysis
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length < 2) return 1;
        
        let coherenceScore = 0;
        for (let i = 1; i < sentences.length; i++) {
            const similarity = this.calculateTextSimilarity(sentences[i-1], sentences[i]);
            coherenceScore += similarity;
        }
        
        return coherenceScore / (sentences.length - 1);
    }

    getDomainTerms(domain) {
        const domainTerms = {
            academic: ['research', 'study', 'analysis', 'theory', 'methodology'],
            legal: ['law', 'legal', 'court', 'rights', 'contract'],
            technical: ['system', 'process', 'method', 'technology', 'implementation'],
            medical: ['health', 'medical', 'treatment', 'patient', 'diagnosis'],
            financial: ['money', 'cost', 'investment', 'financial', 'economic']
        };
        
        return domainTerms[domain] || [];
    }

    getExpectedComplexity(userLevel) {
        const complexityLevels = {
            beginner: 0.3,
            intermediate: 0.5,
            expert: 0.7
        };
        
        return complexityLevels[userLevel] || 0.5;
    }

    generateContentKey(original, simplified) {
        // Generate a hash-like key for content identification
        const combined = original.substring(0, 100) + simplified.substring(0, 100);
        return btoa(combined).substring(0, 20);
    }

    getDefaultConfidence() {
        return {
            confidence: 0.5,
            level: 'medium',
            factors: {},
            flags: [{
                type: 'error',
                message: 'Unable to analyze confidence',
                severity: 'low'
            }],
            recommendations: [],
            needsReview: true,
            timestamp: Date.now()
        };
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfidenceAnalyzer;
} else {
    window.ConfidenceAnalyzer = ConfidenceAnalyzer;
}
