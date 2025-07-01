"""
ALEJO SEO Analyzer

A lightweight SEO analysis tool that evaluates ALEJO pages for common SEO issues
and provides actionable recommendations for improvement.

Features:
- Content analysis (meta tags, headings, keywords)
- Technical SEO validation (schema.org, OpenGraph, Twitter cards)
- Performance impact assessment
- Accessibility review for SEO impact
- Integration with ALEJO's testing system
"""

import os
import re
import json
import logging
import requests
import argparse
from typing import Dict, List, Any, Optional, Union
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/seo_analysis.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("alejo.seo.analyzer")

class SEOAnalyzer:
    """Analyze web pages for SEO issues and provide recommendations."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize the analyzer with the base URL."""
        self.base_url = base_url
        self.results = {
            "overall_score": 0,
            "issues": [],
            "recommendations": [],
            "pages_analyzed": 0,
            "page_results": {}
        }
        self.critical_issues = 0
        self.major_issues = 0
        self.minor_issues = 0
    
    def analyze_url(self, url: str) -> Dict:
        """Analyze a single URL for SEO issues."""
        logger.info(f"Analyzing URL: {url}")
        
        # Make the URL absolute if it's relative
        if not url.startswith(('http://', 'https://')):
            url = urljoin(self.base_url, url)
        
        # Get the page content
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch {url}: {e}")
            self._add_issue("critical", f"Failed to fetch URL: {url}", "Check if the page is accessible")
            return {"url": url, "success": False, "error": str(e)}
        
        # Parse the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        page_title = soup.title.string.strip() if soup.title else ""
        
        # Initialize page results
        page_results = {
            "url": url,
            "title": page_title,
            "score": 0,
            "issues": [],
            "recommendations": []
        }
        
        # Run analyses
        self._analyze_meta_tags(soup, page_results)
        self._analyze_headings(soup, page_results)
        self._analyze_content(soup, page_results)
        self._analyze_structured_data(soup, page_results)
        self._analyze_images(soup, page_results)
        self._analyze_links(soup, page_results, url)
        self._analyze_mobile_friendliness(soup, page_results)
        self._analyze_page_speed(url, page_results)
        
        # Calculate page score
        page_score = 100
        for issue in page_results["issues"]:
            if issue["severity"] == "critical":
                page_score -= 15
            elif issue["severity"] == "major":
                page_score -= 8
            else:
                page_score -= 3
        
        # Ensure score is within bounds
        page_results["score"] = max(0, min(100, page_score))
        
        # Add to overall results
        self.results["pages_analyzed"] += 1
        self.results["page_results"][url] = page_results
        
        # Aggregate issues
        for issue in page_results["issues"]:
            if issue["severity"] == "critical":
                self.critical_issues += 1
            elif issue["severity"] == "major":
                self.major_issues += 1
            else:
                self.minor_issues += 1
        
        logger.info(f"Analysis complete for {url}. Score: {page_results['score']}")
        return page_results
    
    def analyze_site(self, urls: Optional[List[str]] = None) -> Dict:
        """Analyze multiple pages of the site."""
        if not urls:
            urls = [
                "/",
                "/features",
                "/docs",
                "/demo",
                "/contact"
            ]
        
        for url in urls:
            self.analyze_url(url)
        
        # Calculate overall score
        total_score = sum(page["score"] for page in self.results["page_results"].values())
        if self.results["pages_analyzed"] > 0:
            self.results["overall_score"] = total_score / self.results["pages_analyzed"]
        
        # Generate overall recommendations
        self._generate_overall_recommendations()
        
        return self.results
    
    def _analyze_meta_tags(self, soup: BeautifulSoup, results: Dict) -> None:
        """Analyze meta tags for SEO issues."""
        # Check title
        title = soup.title.string if soup.title else None
        if not title:
            self._add_page_issue(results, "critical", "Missing page title", 
                                 "Add a descriptive title tag")
        elif len(title) < 10:
            self._add_page_issue(results, "major", "Title too short", 
                                 "Expand title to 50-60 characters with relevant keywords")
        elif len(title) > 70:
            self._add_page_issue(results, "minor", "Title too long", 
                                 "Shorten title to 50-60 characters while maintaining keywords")
        
        # Check meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if not meta_desc:
            self._add_page_issue(results, "major", "Missing meta description", 
                                 "Add a descriptive meta description with relevant keywords")
        elif meta_desc.get('content') and len(meta_desc['content']) < 50:
            self._add_page_issue(results, "minor", "Meta description too short", 
                                 "Expand description to 150-160 characters with relevant keywords")
        elif meta_desc.get('content') and len(meta_desc['content']) > 160:
            self._add_page_issue(results, "minor", "Meta description too long", 
                                 "Shorten description to 150-160 characters while maintaining keywords")
        
        # Check viewport
        viewport = soup.find('meta', attrs={'name': 'viewport'})
        if not viewport:
            self._add_page_issue(results, "major", "Missing viewport meta tag", 
                                 "Add viewport meta tag for mobile responsiveness")
        
        # Check robots
        robots = soup.find('meta', attrs={'name': 'robots'})
        if not robots:
            self._add_page_issue(results, "minor", "Missing robots meta tag", 
                                 "Add robots meta tag to control indexing and following")
        elif robots.get('content') and 'noindex' in robots['content']:
            self._add_page_issue(results, "critical", "Page set to noindex", 
                                 "Remove noindex directive if this page should be indexed")
        
        # Check canonical
        canonical = soup.find('link', attrs={'rel': 'canonical'})
        if not canonical:
            self._add_page_issue(results, "major", "Missing canonical URL", 
                                 "Add canonical link to prevent duplicate content issues")
    
    def _analyze_headings(self, soup: BeautifulSoup, results: Dict) -> None:
        """Analyze heading structure for SEO issues."""
        h1_tags = soup.find_all('h1')
        if not h1_tags:
            self._add_page_issue(results, "major", "Missing H1 heading", 
                                 "Add an H1 heading with the main keyword")
        elif len(h1_tags) > 1:
            self._add_page_issue(results, "minor", "Multiple H1 headings", 
                                 "Use only one H1 heading per page")
        
        # Check heading hierarchy
        headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        heading_levels = [int(h.name[1]) for h in headings]
        
        # Check for skipped levels
        for i in range(len(heading_levels) - 1):
            if heading_levels[i+1] > heading_levels[i] + 1:
                self._add_page_issue(results, "minor", "Skipped heading level", 
                                     "Maintain a logical heading hierarchy without skipping levels")
                break
    
    def _analyze_content(self, soup: BeautifulSoup, results: Dict) -> None:
        """Analyze page content for SEO issues."""
        # Get text content and remove scripts, styles
        for script in soup(['script', 'style']):
            script.decompose()
        text = soup.get_text()
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Check content length
        word_count = len(text.split())
        if word_count < 300:
            self._add_page_issue(results, "major", "Thin content", 
                                 "Add more quality content to reach at least 300 words")
        
        # Check keyword density
        title = soup.title.string if soup.title else ""
        if title:
            main_keywords = self._extract_keywords(title)
            for keyword in main_keywords:
                keyword_count = text.lower().count(keyword.lower())
                keyword_density = keyword_count / max(1, word_count) * 100
                
                if keyword_density > 5:
                    self._add_page_issue(results, "major", f"Keyword stuffing detected for '{keyword}'", 
                                         "Reduce keyword density to avoid penalty")
                elif keyword_density < 0.5 and word_count > 300:
                    self._add_page_issue(results, "minor", f"Low keyword density for '{keyword}'", 
                                         "Increase relevant keyword usage naturally in content")
    
    def _analyze_structured_data(self, soup: BeautifulSoup, results: Dict) -> None:
        """Analyze structured data for SEO issues."""
        # Check for JSON-LD structured data
        json_ld = soup.find_all('script', type='application/ld+json')
        if not json_ld:
            self._add_page_issue(results, "major", "Missing structured data", 
                                 "Add JSON-LD structured data to improve rich results in search")
            return
        
        # Check structured data validity
        for script in json_ld:
            try:
                data = json.loads(script.string)
                if '@context' not in data or data.get('@context') != 'https://schema.org':
                    self._add_page_issue(results, "minor", "Invalid structured data context", 
                                         "Use 'https://schema.org' as the @context")
                if '@type' not in data:
                    self._add_page_issue(results, "minor", "Missing @type in structured data", 
                                         "Specify the @type property in structured data")
            except json.JSONDecodeError:
                self._add_page_issue(results, "major", "Invalid JSON-LD", 
                                     "Fix the JSON-LD structured data format")
        
        # Check OpenGraph tags
        og_title = soup.find('meta', property='og:title')
        og_desc = soup.find('meta', property='og:description')
        og_image = soup.find('meta', property='og:image')
        
        if not og_title or not og_desc or not og_image:
            missing = []
            if not og_title:
                missing.append("og:title")
            if not og_desc:
                missing.append("og:description")
            if not og_image:
                missing.append("og:image")
            
            self._add_page_issue(results, "major", f"Missing OpenGraph tags: {', '.join(missing)}", 
                                 "Add all required OpenGraph tags for social sharing")
        
        # Check Twitter Card tags
        twitter_card = soup.find('meta', attrs={'name': 'twitter:card'})
        if not twitter_card:
            self._add_page_issue(results, "minor", "Missing Twitter Card", 
                                 "Add Twitter Card tags for better social sharing on Twitter")
    
    def _analyze_images(self, soup: BeautifulSoup, results: Dict) -> None:
        """Analyze images for SEO issues."""
        images = soup.find_all('img')
        
        if not images:
            return
        
        missing_alt = 0
        for img in images:
            if not img.get('alt'):
                missing_alt += 1
        
        if missing_alt > 0:
            self._add_page_issue(results, "major", f"Missing alt text on {missing_alt} images", 
                                 "Add descriptive alt text to all images")
    
    def _analyze_links(self, soup: BeautifulSoup, results: Dict, current_url: str) -> None:
        """Analyze links for SEO issues."""
        links = soup.find_all('a')
        
        if not links:
            self._add_page_issue(results, "minor", "No links found", 
                                 "Add internal and external links for better SEO")
            return
        
        # Check for empty or javascript links
        empty_links = sum(1 for link in links if not link.get('href') or link['href'] == '#')
        js_links = sum(1 for link in links if link.get('href') and link['href'].startswith('javascript:'))
        
        if empty_links > 0:
            self._add_page_issue(results, "minor", f"{empty_links} empty href attributes", 
                                 "Replace empty links with proper URLs")
        
        if js_links > 0:
            self._add_page_issue(results, "minor", f"{js_links} JavaScript links", 
                                 "Use proper URLs instead of JavaScript links when possible")
    
    def _analyze_mobile_friendliness(self, soup: BeautifulSoup, results: Dict) -> None:
        """Analyze mobile friendliness for SEO."""
        viewport = soup.find('meta', attrs={'name': 'viewport'})
        
        if not viewport or not viewport.get('content'):
            return  # Already flagged in meta tags analysis
        
        # Check if viewport content is correct
        viewport_content = viewport['content']
        if 'width=device-width' not in viewport_content:
            self._add_page_issue(results, "major", "Incorrect viewport configuration", 
                                 "Set viewport to 'width=device-width, initial-scale=1'")
        
        # Check for mobile-unfriendly elements
        has_flash = bool(soup.find('object') or soup.find('embed'))
        if has_flash:
            self._add_page_issue(results, "critical", "Page uses Flash", 
                                 "Remove Flash content as it's not supported on mobile devices")
    
    def _analyze_page_speed(self, url: str, results: Dict) -> None:
        """Analyze page speed factors that impact SEO."""
        # This is a simple implementation. For a real check, you'd use tools like Lighthouse API
        # For now, we'll do some basic checks on the HTML
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            # Check response size
            size_kb = len(response.text) / 1024
            if size_kb > 500:
                self._add_page_issue(results, "major", f"Large page size: {size_kb:.1f} KB", 
                                     "Optimize page size to improve loading time")
            
            # Check for render-blocking resources
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Check if CSS is in head
            css_in_body = bool(soup.body and soup.body.find_all('link', rel='stylesheet'))
            if css_in_body:
                self._add_page_issue(results, "minor", "CSS resources found in body", 
                                     "Move CSS to head to avoid render-blocking")
            
            # Check for inline CSS/JS size
            inline_styles = soup.find_all('style')
            if inline_styles:
                total_inline_css = sum(len(style.string or "") for style in inline_styles)
                if total_inline_css > 5000:  # 5KB
                    self._add_page_issue(results, "minor", "Large inline CSS", 
                                         "Move large inline styles to external CSS files")
            
            # Count scripts
            scripts = soup.find_all('script')
            if len(scripts) > 15:
                self._add_page_issue(results, "minor", f"High number of scripts: {len(scripts)}", 
                                     "Reduce and combine script files")
            
        except requests.exceptions.RequestException:
            # Already handled in the main fetch
            pass
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extract potential keywords from text."""
        # This is a simple implementation
        # Remove common stop words
        stop_words = {'the', 'a', 'an', 'and', 'in', 'on', 'at', 'of', 'to', 'for', 'with'}
        words = re.findall(r'\b\w+\b', text.lower())
        words = [word for word in words if word not in stop_words and len(word) > 3]
        
        # Get word frequency
        word_freq = {}
        for word in words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # Return top keywords
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [word for word, _ in sorted_words[:5]]
    
    def _generate_overall_recommendations(self) -> None:
        """Generate overall recommendations based on the issues found."""
        if self.critical_issues > 0:
            self.results["recommendations"].append(
                f"Fix {self.critical_issues} critical SEO issues immediately"
            )
        
        if self.major_issues > 0:
            self.results["recommendations"].append(
                f"Address {self.major_issues} major SEO issues to improve rankings"
            )
        
        # Get most common issues
        issue_count = {}
        for url, page_data in self.results["page_results"].items():
            for issue in page_data["issues"]:
                issue_type = issue["description"]
                issue_count[issue_type] = issue_count.get(issue_type, 0) + 1
        
        # Add recommendations for common issues
        common_issues = sorted(issue_count.items(), key=lambda x: x[1], reverse=True)
        for issue_type, count in common_issues[:3]:
            if count > 1:  # Only if it occurs on multiple pages
                self.results["recommendations"].append(
                    f"Fix '{issue_type}' issue found on {count} pages"
                )
        
        # Add general recommendation
        self.results["recommendations"].append(
            "Set up regular SEO monitoring and implement progressive improvements"
        )
    
    def _add_issue(self, severity: str, description: str, recommendation: str) -> None:
        """Add an issue to the global issues list."""
        self.results["issues"].append({
            "severity": severity,
            "description": description,
            "recommendation": recommendation
        })
    
    def _add_page_issue(self, page_results: Dict, severity: str, description: str, recommendation: str) -> None:
        """Add an issue to a specific page's results."""
        page_results["issues"].append({
            "severity": severity,
            "description": description,
            "recommendation": recommendation
        })
        page_results["recommendations"].append(recommendation)
    
    def export_results(self, output_file: str) -> None:
        """Export analysis results to JSON file."""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2)
        
        logger.info(f"Results exported to {output_file}")

def analyze_site(base_url: str = "http://localhost:8000", urls: Optional[List[str]] = None, 
                output_file: Optional[str] = None) -> Dict:
    """Convenience function to analyze a site and optionally export results."""
    analyzer = SEOAnalyzer(base_url)
    results = analyzer.analyze_site(urls)
    
    if output_file:
        analyzer.export_results(output_file)
    
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ALEJO SEO Analyzer")
    parser.add_argument("--base-url", type=str, default="http://localhost:8000",
                        help="Base URL of the site to analyze")
    parser.add_argument("--urls", type=str, nargs="+",
                        help="Specific URLs to analyze (relative to base URL)")
    parser.add_argument("--output", type=str, default="seo_analysis_report.json",
                        help="Output file path for the analysis report")
    args = parser.parse_args()
    
    analyze_site(args.base_url, args.urls, args.output)
    print(f"SEO analysis complete. Report saved to {args.output}")
