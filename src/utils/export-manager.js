// Enhanced Export Manager - Multiple Formats & Sharing
class ExportManager {
    constructor() {
        this.supportedFormats = ['pdf', 'html', 'markdown', 'txt', 'docx', 'epub'];
        this.shareTargets = ['email', 'social', 'clipboard', 'print'];
        this.init();
    }

    init() {
        this.setupExportTemplates();
        this.setupSharingIntegration();
    }

    async exportContent(content, options = {}) {
        const {
            format = 'html',
            includeOriginal = false,
            includeMetrics = true,
            includeTimestamp = true,
            includeImages = true,
            preserveFormatting = true,
            accessibility = true
        } = options;

        try {
            const exportData = await this.prepareExportData(content, options);
            
            switch (format.toLowerCase()) {
                case 'pdf':
                    return await this.exportToPDF(exportData, options);
                case 'html':
                    return await this.exportToHTML(exportData, options);
                case 'markdown':
                    return await this.exportToMarkdown(exportData, options);
                case 'txt':
                    return await this.exportToText(exportData, options);
                case 'docx':
                    return await this.exportToDocx(exportData, options);
                case 'epub':
                    return await this.exportToEpub(exportData, options);
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    async prepareExportData(content, options) {
        const url = window.location.href;
        const title = document.title;
        const timestamp = new Date().toISOString();
        
        // Extract content data
        const originalText = content.originalContent || '';
        const simplifiedText = content.simplifiedContent || '';
        const complexity = content.complexity || 0;
        const readingTime = content.readingTime || {};
        
        // Prepare metadata
        const metadata = {
            title,
            url,
            timestamp,
            exportOptions: options,
            complexity,
            readingTime,
            wordCount: {
                original: originalText.split(/\s+/).length,
                simplified: simplifiedText.split(/\s+/).length
            }
        };

        // Extract images if requested
        let images = [];
        if (options.includeImages) {
            images = await this.extractImages();
        }

        return {
            metadata,
            originalText,
            simplifiedText,
            images,
            styles: await this.extractStyles()
        };
    }

    async exportToHTML(data, options) {
        const template = this.getHTMLTemplate(options);
        
        const html = template
            .replace('{{TITLE}}', data.metadata.title)
            .replace('{{TIMESTAMP}}', new Date(data.metadata.timestamp).toLocaleString())
            .replace('{{URL}}', data.metadata.url)
            .replace('{{ORIGINAL_CONTENT}}', options.includeOriginal ? this.formatHTMLContent(data.originalText) : '')
            .replace('{{SIMPLIFIED_CONTENT}}', this.formatHTMLContent(data.simplifiedText))
            .replace('{{METRICS}}', options.includeMetrics ? this.generateMetricsHTML(data.metadata) : '')
            .replace('{{STYLES}}', options.preserveFormatting ? data.styles : '')
            .replace('{{ACCESSIBILITY_ATTRS}}', options.accessibility ? this.getAccessibilityAttributes() : '');

        return this.createDownloadableFile(html, 'text/html', `${this.sanitizeFilename(data.metadata.title)}.html`);
    }

    async exportToPDF(data, options) {
        // Create HTML first, then convert to PDF using browser's print functionality
        const htmlContent = await this.exportToHTML(data, { ...options, format: 'pdf' });
        
        // Create a new window for PDF generation
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent.content);
        printWindow.document.close();
        
        // Trigger print dialog (user can save as PDF)
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);

        return { success: true, message: 'PDF print dialog opened' };
    }

    async exportToMarkdown(data, options) {
        let markdown = `# ${data.metadata.title}\n\n`;
        
        if (options.includeMetrics) {
            markdown += `**Source:** ${data.metadata.url}\n`;
            markdown += `**Exported:** ${new Date(data.metadata.timestamp).toLocaleString()}\n`;
            markdown += `**Complexity:** ${data.metadata.complexity}/10\n`;
            markdown += `**Reading Time Saved:** ${data.metadata.readingTime.timeSaved || 0} minutes\n\n`;
        }

        if (options.includeOriginal) {
            markdown += `## Original Content\n\n${this.formatMarkdownContent(data.originalText)}\n\n`;
        }

        markdown += `## Simplified Content\n\n${this.formatMarkdownContent(data.simplifiedText)}\n\n`;

        if (options.includeMetrics) {
            markdown += `## Statistics\n\n`;
            markdown += `- Original word count: ${data.metadata.wordCount.original}\n`;
            markdown += `- Simplified word count: ${data.metadata.wordCount.simplified}\n`;
            markdown += `- Reduction: ${Math.round((1 - data.metadata.wordCount.simplified / data.metadata.wordCount.original) * 100)}%\n`;
        }

        return this.createDownloadableFile(markdown, 'text/markdown', `${this.sanitizeFilename(data.metadata.title)}.md`);
    }

    async exportToText(data, options) {
        let text = `${data.metadata.title}\n${'='.repeat(data.metadata.title.length)}\n\n`;
        
        if (options.includeMetrics) {
            text += `Source: ${data.metadata.url}\n`;
            text += `Exported: ${new Date(data.metadata.timestamp).toLocaleString()}\n`;
            text += `Complexity: ${data.metadata.complexity}/10\n`;
            text += `Reading Time Saved: ${data.metadata.readingTime.timeSaved || 0} minutes\n\n`;
        }

        if (options.includeOriginal) {
            text += `ORIGINAL CONTENT\n${'-'.repeat(16)}\n\n${this.formatTextContent(data.originalText)}\n\n`;
        }

        text += `SIMPLIFIED CONTENT\n${'-'.repeat(18)}\n\n${this.formatTextContent(data.simplifiedText)}\n\n`;

        if (options.includeMetrics) {
            text += `STATISTICS\n${'-'.repeat(10)}\n`;
            text += `Original word count: ${data.metadata.wordCount.original}\n`;
            text += `Simplified word count: ${data.metadata.wordCount.simplified}\n`;
            text += `Reduction: ${Math.round((1 - data.metadata.wordCount.simplified / data.metadata.wordCount.original) * 100)}%\n`;
        }

        return this.createDownloadableFile(text, 'text/plain', `${this.sanitizeFilename(data.metadata.title)}.txt`);
    }

    async shareContent(content, target, options = {}) {
        try {
            switch (target) {
                case 'email':
                    return await this.shareViaEmail(content, options);
                case 'clipboard':
                    return await this.shareViaClipboard(content, options);
                case 'social':
                    return await this.shareViaWebShare(content, options);
                case 'print':
                    return await this.shareViaPrint(content, options);
                default:
                    throw new Error(`Unsupported share target: ${target}`);
            }
        } catch (error) {
            console.error('Share failed:', error);
            throw error;
        }
    }

    async shareViaEmail(content, options) {
        const subject = encodeURIComponent(`Simplified: ${document.title}`);
        const body = encodeURIComponent(
            `I've simplified this content for easier reading:\n\n` +
            `Original: ${window.location.href}\n\n` +
            `Simplified Content:\n${content.simplifiedText}\n\n` +
            `Complexity reduced from ${content.complexity}/10\n` +
            `Reading time saved: ${content.readingTime.timeSaved || 0} minutes\n\n` +
            `Simplified using WebSimplify Pro`
        );

        const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
        window.open(mailtoLink);

        return { success: true, message: 'Email client opened' };
    }

    async shareViaClipboard(content, options) {
        const textToShare = options.format === 'markdown' 
            ? await this.formatAsMarkdown(content)
            : await this.formatAsText(content);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textToShare);
            return { success: true, message: 'Content copied to clipboard' };
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = textToShare;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return { success: true, message: 'Content copied to clipboard (fallback)' };
        }
    }

    async shareViaWebShare(content, options) {
        if (navigator.share) {
            const shareData = {
                title: `Simplified: ${document.title}`,
                text: `Check out this simplified content:\n\n${content.simplifiedText.substring(0, 200)}...`,
                url: window.location.href
            };

            await navigator.share(shareData);
            return { success: true, message: 'Content shared via Web Share API' };
        } else {
            // Fallback to social media URLs
            const text = encodeURIComponent(`Simplified: ${document.title}`);
            const url = encodeURIComponent(window.location.href);
            
            const socialUrls = {
                twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
                facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
                linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
            };

            // Open Twitter by default
            window.open(socialUrls.twitter, '_blank');
            return { success: true, message: 'Social sharing opened' };
        }
    }

    async shareViaPrint(content, options) {
        const printContent = await this.exportToHTML(content, { ...options, format: 'print' });
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent.content);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
        }, 500);

        return { success: true, message: 'Print dialog opened' };
    }

    // Template and formatting methods
    getHTMLTemplate(options) {
        return `
<!DOCTYPE html>
<html lang="en" {{ACCESSIBILITY_ATTRS}}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}} - Simplified</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #eee; margin-bottom: 30px; padding-bottom: 20px; }
        .metadata { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .content-section { margin-bottom: 30px; }
        .content-section h2 { color: #333; border-left: 4px solid #4A90E2; padding-left: 15px; }
        .metrics { background: #e8f4fd; padding: 15px; border-radius: 8px; }
        .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 600px) { .comparison { grid-template-columns: 1fr; } }
        {{STYLES}}
    </style>
</head>
<body>
    <div class="header">
        <h1>{{TITLE}}</h1>
        <div class="metadata">
            <p><strong>Source:</strong> <a href="{{URL}}">{{URL}}</a></p>
            <p><strong>Exported:</strong> {{TIMESTAMP}}</p>
        </div>
    </div>
    
    {{METRICS}}
    
    <div class="comparison">
        {{ORIGINAL_CONTENT}}
        <div class="content-section">
            <h2>Simplified Content</h2>
            {{SIMPLIFIED_CONTENT}}
        </div>
    </div>
    
    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
        <p>Simplified using WebSimplify Pro - Making web content accessible to everyone</p>
    </footer>
</body>
</html>`;
    }

    formatHTMLContent(text) {
        return text
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    formatMarkdownContent(text) {
        return text
            .replace(/\n\n/g, '\n\n')
            .replace(/^#+ /gm, '### '); // Convert headings to level 3
    }

    formatTextContent(text) {
        return text.replace(/\s+/g, ' ').trim();
    }

    generateMetricsHTML(metadata) {
        return `
        <div class="metrics">
            <h2>Simplification Metrics</h2>
            <ul>
                <li><strong>Complexity:</strong> ${metadata.complexity}/10</li>
                <li><strong>Reading Time Saved:</strong> ${metadata.readingTime.timeSaved || 0} minutes</li>
                <li><strong>Word Count Reduction:</strong> ${metadata.wordCount.original} → ${metadata.wordCount.simplified} (${Math.round((1 - metadata.wordCount.simplified / metadata.wordCount.original) * 100)}% reduction)</li>
            </ul>
        </div>`;
    }

    getAccessibilityAttributes() {
        return 'role="document" aria-label="Simplified content export"';
    }

    async extractImages() {
        const images = Array.from(document.images);
        return images.map(img => ({
            src: img.src,
            alt: img.alt || 'Image',
            width: img.naturalWidth,
            height: img.naturalHeight
        }));
    }

    async extractStyles() {
        // Extract minimal styles for formatting preservation
        return `
        .simplified-content { background: #f9f9f9; padding: 15px; border-radius: 8px; }
        .complexity-high { border-left: 4px solid #ff6b6b; }
        .complexity-medium { border-left: 4px solid #ffa726; }
        .complexity-low { border-left: 4px solid #66bb6a; }
        `;
    }

    createDownloadableFile(content, mimeType, filename) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return {
            success: true,
            filename,
            size: blob.size,
            content: content
        };
    }

    sanitizeFilename(filename) {
        return filename
            .replace(/[^a-z0-9]/gi, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50);
    }

    async formatAsMarkdown(content) {
        return `# ${document.title}\n\n${content.simplifiedText}\n\n*Simplified using WebSimplify Pro*`;
    }

    async formatAsText(content) {
        return `${document.title}\n\n${content.simplifiedText}\n\nSimplified using WebSimplify Pro`;
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportManager;
} else {
    window.ExportManager = ExportManager;
}
