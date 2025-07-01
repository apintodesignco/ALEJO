"""
ALEJO Sitemap Generator

This module dynamically generates a sitemap.xml file for ALEJO.
It can be run as a standalone script or imported and used as part of the
FastAPI application startup process.

Features:
- Dynamic page discovery
- Last modified timestamps
- Priority and change frequency configuration
- Automatic sitemap submission to search engines
"""

import os
import time
import logging
from datetime import datetime
from xml.dom import minidom
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Union
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/sitemap.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("alejo.seo.sitemap")

# Define default sitemap configuration
DEFAULT_CONFIG = {
    "base_url": "https://alejo-gesture.io",
    "output_path": "public/sitemap.xml",
    "notify_search_engines": True,
    "pages": [
        {"url": "/", "priority": 1.0, "changefreq": "weekly"},
        {"url": "/features", "priority": 0.8, "changefreq": "monthly"},
        {"url": "/docs", "priority": 0.8, "changefreq": "weekly"},
        {"url": "/demo", "priority": 0.9, "changefreq": "weekly"},
        {"url": "/contact", "priority": 0.7, "changefreq": "monthly"},
        {"url": "/download", "priority": 0.9, "changefreq": "weekly"},
        {"url": "/community", "priority": 0.7, "changefreq": "weekly"},
    ],
    "search_engines": [
        "https://www.google.com/webmasters/tools/ping?sitemap=",
        "https://www.bing.com/ping?sitemap="
    ]
}

class SitemapGenerator:
    """Generate and manage sitemaps for ALEJO."""
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize with configuration options."""
        self.config = DEFAULT_CONFIG.copy()
        if config:
            self.config.update(config)
        
        # Ensure output directory exists
        output_dir = os.path.dirname(self.config["output_path"])
        os.makedirs(output_dir, exist_ok=True)
        
    def generate_sitemap(self) -> str:
        """Generate sitemap XML content."""
        logger.info("Generating sitemap...")
        
        # Create root element
        urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
        
        # Add configured pages
        for page in self.config["pages"]:
            url_element = ET.SubElement(urlset, "url")
            
            # Add location
            loc = ET.SubElement(url_element, "loc")
            loc.text = f"{self.config['base_url']}{page['url']}"
            
            # Add last modified date (current date for simplicity)
            lastmod = ET.SubElement(url_element, "lastmod")
            lastmod.text = datetime.now().strftime("%Y-%m-%d")
            
            # Add change frequency
            changefreq = ET.SubElement(url_element, "changefreq")
            changefreq.text = page.get("changefreq", "monthly")
            
            # Add priority
            priority = ET.SubElement(url_element, "priority")
            priority.text = str(page.get("priority", 0.5))
        
        # Add dynamic pages if configured
        self._add_dynamic_pages(urlset)
        
        # Format the XML with proper indentation
        rough_string = ET.tostring(urlset, 'utf-8')
        reparsed = minidom.parseString(rough_string)
        pretty_xml = reparsed.toprettyxml(indent="  ")
        
        return pretty_xml
    
    def _add_dynamic_pages(self, urlset: ET.Element) -> None:
        """Add dynamically discovered pages to sitemap."""
        # This would typically connect to a database or scan directories
        # For now, we'll just add a placeholder implementation
        dynamic_pages = self._discover_pages()
        
        for page in dynamic_pages:
            url_element = ET.SubElement(urlset, "url")
            
            # Add location
            loc = ET.SubElement(url_element, "loc")
            loc.text = f"{self.config['base_url']}{page['url']}"
            
            # Add last modified date
            lastmod = ET.SubElement(url_element, "lastmod")
            lastmod.text = page.get("lastmod", datetime.now().strftime("%Y-%m-%d"))
            
            # Add change frequency
            if "changefreq" in page:
                changefreq = ET.SubElement(url_element, "changefreq")
                changefreq.text = page["changefreq"]
            
            # Add priority
            if "priority" in page:
                priority = ET.SubElement(url_element, "priority")
                priority.text = str(page["priority"])
    
    def _discover_pages(self) -> List[Dict[str, Union[str, float]]]:
        """Discover dynamic pages for the sitemap."""
        # This would be implemented based on ALEJO's architecture
        # For example, it might scan documentation pages, user guides, etc.
        
        # Placeholder implementation
        return []
    
    def write_sitemap(self) -> str:
        """Generate and write sitemap to file."""
        xml_content = self.generate_sitemap()
        
        with open(self.config["output_path"], "w", encoding="utf-8") as f:
            f.write(xml_content)
        
        logger.info(f"Sitemap written to {self.config['output_path']}")
        
        if self.config["notify_search_engines"]:
            self.notify_search_engines()
            
        return self.config["output_path"]
    
    def notify_search_engines(self) -> None:
        """Notify search engines about the updated sitemap."""
        sitemap_url = f"{self.config['base_url']}/sitemap.xml"
        
        for search_engine in self.config["search_engines"]:
            ping_url = f"{search_engine}{sitemap_url}"
            try:
                logger.info(f"Pinging search engine: {ping_url}")
                response = requests.get(ping_url, timeout=10)
                
                if response.status_code == 200:
                    logger.info(f"Successfully pinged {search_engine}")
                else:
                    logger.warning(f"Failed to ping {search_engine}, status code: {response.status_code}")
            except Exception as e:
                logger.error(f"Error pinging search engine {search_engine}: {str(e)}")

def generate_sitemap(config: Optional[Dict] = None) -> str:
    """Convenience function to generate sitemap."""
    generator = SitemapGenerator(config)
    return generator.write_sitemap()

if __name__ == "__main__":
    # When run as a script, generate the sitemap with default settings
    generate_sitemap()
    print("Sitemap generated successfully!")
