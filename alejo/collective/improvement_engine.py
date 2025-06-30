"""
Improvement Engine for ALEJO Collective Learning
Generates improvement proposals based on collective insights and creates pull requests
for automated improvements using GitHub as the central repository.
"""

import logging
import json
import asyncio
import base64
import hashlib
import tempfile
import subprocess
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import os
from pathlib import Path
import aiohttp

from ..core.config_manager import ConfigManager
from .data_manager import CollectiveDataManager
from ..utils.exceptions import ImprovementEngineError

logger = logging.getLogger("alejo.collective.improvement_engine")

class ImprovementEngine:
    """
    Engine for generating and applying improvements based on collective insights
    using GitHub for pull requests and continuous integration.
    
    Responsibilities:
    - Analyze insights to identify patterns and improvement opportunities
    - Generate improvement proposals as GitHub pull requests
    - Track improvement outcomes through GitHub workflows
    - Ensure all improvements meet quality and security standards
    """
    
    def __init__(self, config_manager: ConfigManager, data_manager=None):
        """
        Initialize the improvement engine
        
        Args:
            config_manager: Configuration manager instance
            data_manager: Data manager instance
        """
        self.config_manager = config_manager
        self._data_manager = data_manager
        
        # Load configuration
        self.improvement_config = self.config_manager.get_config("collective.improvements", {})
        self.auto_apply = self.improvement_config.get("auto_apply", False)
        self.min_confidence = self.improvement_config.get("min_confidence", 0.8)
        
        # GitHub configuration
        github_config = self.config_manager.get_config("github", {})
        self.github_enabled = github_config.get("enabled", False)
        self.github_repo = github_config.get("repo", "")
        self.github_token = github_config.get("token", "")
        self.github_branch = github_config.get("branch", "collective-learning")
        self.github_improvements_path = github_config.get("improvements_path", "data/collective/improvements")
        
        # Initialize improvement categories
        self.improvement_categories = {
            "performance": self._generate_performance_improvements,
            "security": self._generate_security_improvements,
            "usability": self._generate_usability_improvements,
            "reliability": self._generate_reliability_improvements,
            "feature": self._generate_feature_improvements,
            "accessibility": self._generate_accessibility_improvements,
            "privacy": self._generate_privacy_improvements
        }
        
    @property
    def data_manager(self):
        """Lazy load data manager"""
        if not self._data_manager:
            from .data_manager import CollectiveDataManager
            self._data_manager = CollectiveDataManager(self.config_manager)
        return self._data_manager
        
    async def _github_api_request(self, method: str, url: str, data: Optional[Dict] = None) -> Dict:
        """
        Make a GitHub API request
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            url: API endpoint URL
            data: Optional request data
            
        Returns:
            Response data as dictionary
        """
        if not self.github_enabled or not self.github_token:
            raise ImprovementEngineError("GitHub integration is not enabled or configured")
            
        headers = {
            "Authorization": f"token {self.github_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        base_url = "https://api.github.com"
        full_url = f"{base_url}/{url}" if not url.startswith("http") else url
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(method, full_url, headers=headers, json=data) as response:
                    response_data = await response.json()
                    
                    if response.status >= 400:
                        logger.error(f"GitHub API error: {response.status} - {response_data.get('message', 'Unknown error')}")
                        raise ImprovementEngineError(f"GitHub API error: {response.status} - {response_data.get('message', 'Unknown error')}")
                        
                    return response_data
        except aiohttp.ClientError as e:
            logger.error(f"GitHub API request error: {e}")
            raise ImprovementEngineError(f"GitHub API request error: {e}")
    
    async def _create_branch(self, branch_name: str, base_branch: str = "main") -> bool:
        """
        Create a new branch for improvements
        
        Args:
            branch_name: Name of the branch to create
            base_branch: Base branch to create from
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get the SHA of the latest commit on the base branch
            url = f"repos/{self.github_repo}/git/refs/heads/{base_branch}"
            ref_data = await self._github_api_request("GET", url)
            sha = ref_data["object"]["sha"]
            
            # Create new branch
            url = f"repos/{self.github_repo}/git/refs"
            data = {
                "ref": f"refs/heads/{branch_name}",
                "sha": sha
            }
            await self._github_api_request("POST", url, data)
            
            return True
        except Exception as e:
            logger.error(f"Error creating branch {branch_name}: {e}")
            return False
            
    async def check_for_improvements(self) -> bool:
        """
        Check for available improvements both locally and on GitHub
        
        Returns:
            True if improvements are available, False otherwise
        """
        try:
            self.last_check = datetime.now()
            
            # Get available improvements locally
            improvements = await self.data_manager.get_available_improvements()
            
            # If GitHub integration is enabled, check for improvements in the GitHub repo
            if self.github_enabled and self.github_token and self.github_repo:
                try:
                    # Check for open improvement PRs
                    url = f"repos/{self.github_repo}/pulls?state=open&head={self.github_repo.split('/')[0]}:improvement"
                    prs = await self._github_api_request("GET", url)
                    
                    if prs:
                        logger.info(f"Found {len(prs)} open improvement PRs on GitHub")
                        
                        # Get improvement files from each PR
                        for pr in prs:
                            # Get PR files
                            url = f"repos/{self.github_repo}/pulls/{pr['number']}/files"
                            files = await self._github_api_request("GET", url)
                            
                            for file in files:
                                if file["filename"].startswith(self.github_improvements_path):
                                    # Get file content
                                    url = f"repos/{self.github_repo}/contents/{file['filename']}?ref={pr['head']['ref']}"
                                    file_data = await self._github_api_request("GET", url)
                                    content = base64.b64decode(file_data["content"]).decode("utf-8")
                                    
                                    # Parse improvement data
                                    try:
                                        improvement_data = json.loads(content)
                                        improvements.append(improvement_data)
                                    except json.JSONDecodeError:
                                        logger.error(f"Invalid JSON in improvement file: {file['filename']}")
                except Exception as e:
                    logger.error(f"Error checking for improvements on GitHub: {e}")
            
            if improvements:
                logger.info(f"Found {len(improvements)} available improvements total")
                return True
            
            return False
        except Exception as e:
            logger.error(f"Error checking for improvements: {e}")
            return False
    
    async def _create_file_in_branch(self, branch_name: str, file_path: str, content: str, message: str) -> bool:
        """
        Create or update a file in a branch
        
        Args:
            branch_name: Name of the branch
            file_path: Path to the file
            content: File content
            message: Commit message
            
        Returns:
            True if successful, False otherwise
        """
        try:
            url = f"repos/{self.github_repo}/contents/{file_path}"
            data = {
                "message": message,
                "content": base64.b64encode(content.encode("utf-8")).decode("utf-8"),
                "branch": branch_name
            }
            
            # Check if file already exists
            try:
                existing_file = await self._github_api_request("GET", f"{url}?ref={branch_name}")
                # If file exists, include its SHA in the update request
                data["sha"] = existing_file["sha"]
            except Exception:
                # File doesn't exist, continue with creation
                pass
                
            await self._github_api_request("PUT", url, data)
            return True
        except Exception as e:
            logger.error(f"Error creating/updating file {file_path} in branch {branch_name}: {e}")
            return False
    
    async def _create_pull_request(self, branch_name: str, title: str, body: str) -> Dict:
        """
        Create a pull request for an improvement branch
        
        Args:
            branch_name: Name of the branch with improvements
            title: Pull request title
            body: Pull request description
            
        Returns:
            Pull request data or empty dict if failed
        """
        try:
            url = f"repos/{self.github_repo}/pulls"
            data = {
                "title": title,
                "body": body,
                "head": branch_name,
                "base": "main",  # Target branch
                "draft": True,    # Create as draft PR first for review
                "maintainer_can_modify": True
            }
            
            return await self._github_api_request("POST", url, data)
        except Exception as e:
            logger.error(f"Error creating pull request: {e}")
            return {}
            
    async def _create_github_pull_requests(self, improvements: List[Dict]) -> bool:
        """
        Create GitHub pull requests for improvement proposals
        
        Args:
            improvements: List of improvement proposals
            
        Returns:
            True if any PRs were created, False otherwise
        """
        if not improvements:
            return False
            
        if not self.github_enabled or not self.github_token or not self.github_repo:
            logger.warning("GitHub integration is not enabled or configured")
            return False
            
        try:
            # Group improvements by category
            improvements_by_category = {}
            for improvement in improvements:
                category = improvement.get("category", "general")
                if category not in improvements_by_category:
                    improvements_by_category[category] = []
                improvements_by_category[category].append(improvement)
            
            prs_created = False
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            
            # Create a branch and PR for each category
            for category, category_improvements in improvements_by_category.items():
                # Create a branch for this category's improvements
                branch_name = f"improvement/{category}/{timestamp}"
                if not await self._create_branch(branch_name):
                    continue
                    
                # Add improvement files to the branch
                for i, improvement in enumerate(category_improvements):
                    # Create a unique filename for the improvement
                    filename = f"{self.github_improvements_path}/{category}/{timestamp}-{i}.json"
                    content = json.dumps(improvement, indent=2)
                    message = f"Add improvement proposal: {improvement.get('title', 'Untitled')}"
                    
                    if not await self._create_file_in_branch(branch_name, filename, content, message):
                        logger.error(f"Failed to create improvement file {filename}")
                        continue
                
                # Create a PR for this category
                pr_title = f"Improvement Proposals: {category.capitalize()} ({len(category_improvements)})"
                pr_body = f"## Automated Improvement Proposals\n\n"
                pr_body += f"This pull request contains {len(category_improvements)} improvement proposals for the {category} category, generated from anonymized collective insights.\n\n"
                pr_body += "### Improvements\n\n"
                
                for improvement in category_improvements:
                    pr_body += f"- **{improvement.get('title', 'Untitled')}**"  
                    pr_body += f": {improvement.get('description', 'No description')}\n"
                
                pr_body += "\n### Validation\n\n"
                pr_body += "These improvements have been automatically generated and should be reviewed before merging.\n"
                pr_body += "The CI pipeline will run validation tests on these improvements."
                
                pr_data = await self._create_pull_request(branch_name, pr_title, pr_body)
                if pr_data:
                    # Store the PR number in the improvements
                    pr_number = pr_data.get('number')
                    for improvement in category_improvements:
                        improvement['github_pr_number'] = pr_number
                    
                    # Update the improvements in the data manager
                    await self.data_manager.update_improvements(category_improvements)
                    
                    logger.info(f"Created pull request #{pr_number} for category {category}")
                    prs_created = True
                else:
                    logger.error(f"Failed to create pull request for category {category}")
            
            return prs_created
            
        except Exception as e:
            logger.error(f"Error creating GitHub pull requests: {e}")
            return False
            
    async def _handle_improvement_available(self, event: Event):
        """Handle improvement available event"""
        improvement = event.payload.get("improvement")
        if improvement:
            # Auto-apply if configured
            collective_config = self.config_manager.get_config("collective_learning", {})
            auto_apply = collective_config.get("auto_apply_improvements", False)
            
            if auto_apply and self.auto_apply:
                # Apply the improvement
                await self.apply_improvement(improvement["id"])
    
    async def generate_improvements(self) -> List[Dict]:
        """
        Generate improvement proposals based on collective insights
        and create GitHub pull requests for them
        
        Returns:
            List of improvement proposals
        """
        if not self.data_manager:
            logger.error("Cannot generate improvements: data manager not available")
            return []
            
        # Get insights from data manager
        insights = await self.data_manager.get_unprocessed_insights()
        if not insights:
            logger.info("No new insights available for generating improvements")
            return []
            
        logger.info(f"Generating improvements from {len(insights)} insights")
        
        # Group insights by category
        insights_by_category = {}
        for insight in insights:
            category = insight.get('category', 'unknown')
            if category not in insights_by_category:
                insights_by_category[category] = []
            insights_by_category[category].append(insight)
            
        # Generate improvements for each category
        improvements = []
        for category, category_insights in insights_by_category.items():
            if category in self.improvement_categories:
                category_improvements = await self.improvement_categories[category](category_insights)
                improvements.extend(category_improvements)
                
        # Mark insights as processed
        await self.data_manager.mark_insights_processed(insights)
        
        # Store improvements and create pull requests if GitHub is enabled
        if improvements:
            await self.data_manager.store_improvements(improvements)
            
            if self.github_enabled and self.github_token and self.github_repo:
                await self._create_github_pull_requests(improvements)
            
        return improvements
        
    async def _generate_performance_improvements(self, insights: List[Dict]) -> List[Dict]:
        """
        Generate performance improvement proposals from insights
        
        Args:
            insights: List of insights related to performance
            
        Returns:
            List of improvement proposals
        """
        improvements = []
        
        # Group insights by component
        components = {}
        for insight in insights:
            component = insight.get('component', 'general')
            if component not in components:
                components[component] = []
            components[component].append(insight)
            
        # Generate improvements for each component
        for component, component_insights in components.items():
            # Analyze patterns in insights
            slow_operations = self._extract_slow_operations(component_insights)
            memory_issues = self._extract_memory_issues(component_insights)
            bottlenecks = self._extract_bottlenecks(component_insights)
            
            # Generate improvement proposals for slow operations
            for operation, data in slow_operations.items():
                if len(data['insights']) >= 3:  # Require multiple insights to confirm pattern
                    improvement = {
                        'id': f"perf-{component}-{hashlib.md5(operation.encode()).hexdigest()[:8]}",
                        'title': f"Optimize {operation} in {component}",
                        'description': f"Performance optimization for {operation} based on {len(data['insights'])} user insights",
                        'category': 'performance',
                        'component': component,
                        'operation': operation,
                        'confidence': min(0.5 + (len(data['insights']) * 0.1), 0.95),
                        'data': data,
                        'created_at': datetime.now().isoformat(),
                        'type': 'code',
                        'status': 'proposed'
                    }
                    improvements.append(improvement)
                    
            # Memory optimization improvements
            for issue, data in memory_issues.items():
                if len(data['insights']) >= 2:
                    improvement = {
                        'id': f"mem-{component}-{hashlib.md5(issue.encode()).hexdigest()[:8]}",
                        'title': f"Reduce memory usage in {component} ({issue})",
                        'description': f"Memory optimization to address {issue} based on {len(data['insights'])} user insights",
                        'category': 'performance',
                        'component': component,
                        'issue': issue,
                        'confidence': min(0.4 + (len(data['insights']) * 0.15), 0.9),
                        'data': data,
                        'created_at': datetime.now().isoformat(),
                        'type': 'code',
                        'status': 'proposed'
                    }
                    improvements.append(improvement)
                    
        return improvements
    
    def _extract_slow_operations(self, insights: List[Dict]) -> Dict:
        """Extract slow operations from insights"""
        operations = {}
        for insight in insights:
            if 'performance' in insight.get('tags', []) and 'slow' in insight.get('tags', []):
                operation = insight.get('operation', 'unknown')
                if operation not in operations:
                    operations[operation] = {
                        'insights': [],
                        'avg_time': 0,
                        'frequency': 0
                    }
                operations[operation]['insights'].append(insight)
                operations[operation]['avg_time'] += insight.get('time', 0)
                operations[operation]['frequency'] += 1
                
        # Calculate averages
        for operation in operations:
            if operations[operation]['frequency'] > 0:
                operations[operation]['avg_time'] /= operations[operation]['frequency']
                
        return operations
    
    def _extract_memory_issues(self, insights: List[Dict]) -> Dict:
        """Extract memory issues from insights"""
        issues = {}
        for insight in insights:
            if 'performance' in insight.get('tags', []) and 'memory' in insight.get('tags', []):
                issue = insight.get('issue', 'unknown')
                if issue not in issues:
                    issues[issue] = {
                        'insights': [],
                        'frequency': 0
                    }
                issues[issue]['insights'].append(insight)
                issues[issue]['frequency'] += 1
                
        return issues
    
    def _extract_bottlenecks(self, insights: List[Dict]) -> List[Dict]:
        """Extract bottlenecks from insights"""
        bottlenecks = []
        for insight in insights:
            if 'performance' in insight.get('tags', []) and 'bottleneck' in insight.get('tags', []):
                bottlenecks.append(insight)
                
        return bottlenecks
        
    async def _generate_security_improvements(self, insights: List[Dict]) -> List[Dict]:
        """
        Generate security improvement proposals from insights
        
        Args:
            insights: List of insights related to security
            
        Returns:
            List of improvement proposals
        """
        improvements = []
        
        # Group insights by vulnerability type
        vulnerabilities = {}
        for insight in insights:
            vuln_type = insight.get('vulnerability_type', 'unknown')
            if vuln_type not in vulnerabilities:
                vulnerabilities[vuln_type] = []
            vulnerabilities[vuln_type].append(insight)
            
        # Generate improvements for each vulnerability type
        for vuln_type, vuln_insights in vulnerabilities.items():
            if len(vuln_insights) >= 1:  # Security issues need immediate attention
                # Get affected components
                components = set()
                for insight in vuln_insights:
                    components.add(insight.get('component', 'unknown'))
                
                components_str = ", ".join(sorted(list(components)))
                
                improvement = {
                    'id': f"sec-{vuln_type}-{hashlib.md5(components_str.encode()).hexdigest()[:8]}",
                    'title': f"Fix {vuln_type} vulnerability in {components_str}",
                    'description': f"Security improvement to address {vuln_type} vulnerability based on {len(vuln_insights)} user insights",
                    'category': 'security',
                    'vulnerability_type': vuln_type,
                    'components': list(components),
                    'confidence': min(0.7 + (len(vuln_insights) * 0.1), 0.99),  # Security issues get higher base confidence
                    'severity': self._calculate_security_severity(vuln_insights),
                    'created_at': datetime.now().isoformat(),
                    'type': 'code',
                    'status': 'proposed'
                }
                improvements.append(improvement)
                
        return improvements
    
    def _calculate_security_severity(self, insights: List[Dict]) -> str:
        """Calculate security severity from insights"""
        severity_scores = {
            'critical': 4,
            'high': 3,
            'medium': 2,
            'low': 1,
            'info': 0
        }
        
        total_score = 0
        for insight in insights:
            severity = insight.get('severity', 'medium')
            total_score += severity_scores.get(severity.lower(), 2)
            
        avg_score = total_score / len(insights) if insights else 2
        
        if avg_score > 3.5:
            return 'critical'
        elif avg_score > 2.5:
            return 'high'
        elif avg_score > 1.5:
            return 'medium'
        elif avg_score > 0.5:
            return 'low'
        else:
            return 'info'
            
    async def _generate_usability_improvements(self, insights: List[Dict]) -> List[Dict]:
        """
        Generate usability improvement proposals from insights
        
        Args:
            insights: List of insights related to usability
            
        Returns:
            List of improvement proposals
        """
        improvements = []
        
        # Group insights by UI component
        ui_components = {}
        for insight in insights:
            component = insight.get('ui_component', 'general')
            if component not in ui_components:
                ui_components[component] = []
            ui_components[component].append(insight)
            
        # Generate improvements for each UI component
        for component, component_insights in ui_components.items():
            # Group by issue type
            issues = {}
            for insight in component_insights:
                issue_type = insight.get('issue_type', 'general')
                if issue_type not in issues:
                    issues[issue_type] = []
                issues[issue_type].append(insight)
                
            # Generate improvement for each issue type with sufficient insights
            for issue_type, issue_insights in issues.items():
                if len(issue_insights) >= 2:  # Require multiple insights to confirm pattern
                    improvement = {
                        'id': f"ui-{component}-{hashlib.md5(issue_type.encode()).hexdigest()[:8]}",
                        'title': f"Improve {issue_type} in {component} UI",
                        'description': f"Usability improvement for {component} UI to address {issue_type} based on {len(issue_insights)} user insights",
                        'category': 'usability',
                        'ui_component': component,
                        'issue_type': issue_type,
                        'confidence': min(0.4 + (len(issue_insights) * 0.1), 0.9),
                        'created_at': datetime.now().isoformat(),
                        'type': 'code',
                        'status': 'proposed'
                    }
                    improvements.append(improvement)
                    
        return improvements
        
    async def _generate_reliability_improvements(self, insights: List[Dict]) -> List[Dict]:
        """
        Generate reliability improvement proposals from insights
        
        Args:
            insights: List of insights related to reliability
            
        Returns:
            List of improvement proposals
        """
        improvements = []
        
        # Group insights by error type
        error_types = {}
        for insight in insights:
            error_type = insight.get('error_type', 'unknown')
            if error_type not in error_types:
                error_types[error_type] = []
            error_types[error_type].append(insight)
            
        # Generate improvements for each error type
        for error_type, error_insights in error_types.items():
            if len(error_insights) >= 2:  # Require multiple insights to confirm pattern
                # Get affected components
                components = set()
                for insight in error_insights:
                    components.add(insight.get('component', 'unknown'))
                
                components_str = ", ".join(sorted(list(components)))
                
                improvement = {
                    'id': f"rel-{error_type}-{hashlib.md5(components_str.encode()).hexdigest()[:8]}",
                    'title': f"Fix {error_type} errors in {components_str}",
                    'description': f"Reliability improvement to address {error_type} errors based on {len(error_insights)} user insights",
                    'category': 'reliability',
                    'error_type': error_type,
                    'components': list(components),
                    'confidence': min(0.5 + (len(error_insights) * 0.1), 0.95),
                    'frequency': self._calculate_error_frequency(error_insights),
                    'created_at': datetime.now().isoformat(),
                    'type': 'code',
                    'status': 'proposed'
                }
                improvements.append(improvement)
                
        return improvements
    
    def _calculate_error_frequency(self, insights: List[Dict]) -> str:
        """Calculate error frequency from insights"""
        total_occurrences = sum(insight.get('occurrences', 1) for insight in insights)
        avg_occurrences = total_occurrences / len(insights) if insights else 1
        
        if avg_occurrences >= 10:
            return 'very_high'
        elif avg_occurrences >= 5:
            return 'high'
        elif avg_occurrences >= 2:
            return 'medium'
        else:
            return 'low'
            
    async def _generate_feature_improvements(self, insights: List[Dict]) -> List[Dict]:
        """
        Generate feature improvement proposals from insights
        
        Args:
            insights: List of insights related to feature requests
            
        Returns:
            List of improvement proposals
        """
        improvements = []
        
        # Group insights by requested feature
        features = {}
        for insight in insights:
            feature = insight.get('feature', 'unknown')
            if feature not in features:
                features[feature] = []
            features[feature].append(insight)
            
        # Generate improvements for each requested feature
        for feature, feature_insights in features.items():
            if len(feature_insights) >= 3:  # Require multiple insights to confirm demand
                improvement = {
                    'id': f"feat-{hashlib.md5(feature.encode()).hexdigest()[:8]}",
                    'title': f"Add {feature} feature",
                    'description': f"New feature implementation for {feature} based on {len(feature_insights)} user requests",
                    'category': 'feature',
                    'feature': feature,
                    'confidence': min(0.3 + (len(feature_insights) * 0.1), 0.8),  # Features start with lower confidence
                    'demand': len(feature_insights),
                    'created_at': datetime.now().isoformat(),
                    'type': 'code',
                    'status': 'proposed'
                }
                improvements.append(improvement)
                
        return improvements
        
    async def _generate_accessibility_improvements(self, insights: List[Dict]) -> List[Dict]:
        """
        Generate accessibility improvement proposals from insights
        
        Args:
            insights: List of insights related to accessibility
            
        Returns:
            List of improvement proposals
        """
        improvements = []
        
        # Group insights by accessibility issue
        accessibility_issues = {}
        for insight in insights:
            issue_type = insight.get('issue_type', 'unknown')
            if issue_type not in accessibility_issues:
                accessibility_issues[issue_type] = []
            accessibility_issues[issue_type].append(insight)
            
        # Generate improvements for each accessibility issue
        for issue_type, issue_insights in accessibility_issues.items():
            if len(issue_insights) >= 1:  # Accessibility issues need immediate attention
                # Get affected components
                components = set()
                for insight in issue_insights:
                    components.add(insight.get('component', 'unknown'))
                
                components_str = ", ".join(sorted(list(components)))
                
                # Calculate WCAG compliance level
                wcag_level = self._calculate_wcag_level(issue_insights)
                
                improvement = {
                    'id': f"a11y-{issue_type}-{hashlib.md5(components_str.encode()).hexdigest()[:8]}",
                    'title': f"Fix {issue_type} accessibility issue in {components_str}",
                    'description': f"Accessibility improvement to address {issue_type} based on {len(issue_insights)} user insights (WCAG {wcag_level})",
                    'category': 'accessibility',
                    'issue_type': issue_type,
                    'components': list(components),
                    'wcag_level': wcag_level,
                    'confidence': min(0.6 + (len(issue_insights) * 0.1), 0.95),
                    'created_at': datetime.now().isoformat(),
                    'type': 'code',
                    'status': 'proposed'
                }
                improvements.append(improvement)
                
        return improvements
    
    def _calculate_wcag_level(self, insights: List[Dict]) -> str:
        """Calculate WCAG compliance level from insights"""
        # Default to AA if not specified
        levels = [insight.get('wcag_level', 'AA') for insight in insights]
        
        # If any insight requires AAA compliance, use that
        if 'AAA' in levels:
            return 'AAA'
        # If any insight requires AA compliance, use that
        elif 'AA' in levels:
            return 'AA'
        # Otherwise use A
        else:
            return 'A'
            
    async def _generate_privacy_improvements(self, insights: List[Dict]) -> List[Dict]:
        """
        Generate privacy improvement proposals from insights
        
        Args:
            insights: List of insights related to privacy
            
        Returns:
            List of improvement proposals
        """
        improvements = []
        
        # Group insights by privacy issue
        privacy_issues = {}
        for insight in insights:
            issue_type = insight.get('issue_type', 'unknown')
            if issue_type not in privacy_issues:
                privacy_issues[issue_type] = []
            privacy_issues[issue_type].append(insight)
            
        # Generate improvements for each privacy issue
        for issue_type, issue_insights in privacy_issues.items():
            if len(issue_insights) >= 1:  # Privacy issues need immediate attention
                # Get affected components
                components = set()
                for insight in issue_insights:
                    components.add(insight.get('component', 'unknown'))
                
                components_str = ", ".join(sorted(list(components)))
                
                # Calculate privacy impact
                impact = self._calculate_privacy_impact(issue_insights)
                
                improvement = {
                    'id': f"priv-{issue_type}-{hashlib.md5(components_str.encode()).hexdigest()[:8]}",
                    'title': f"Fix {issue_type} privacy issue in {components_str}",
                    'description': f"Privacy improvement to address {issue_type} based on {len(issue_insights)} user insights (Impact: {impact})",
                    'category': 'privacy',
                    'issue_type': issue_type,
                    'components': list(components),
                    'impact': impact,
                    'confidence': min(0.7 + (len(issue_insights) * 0.1), 0.99),  # Privacy issues get higher base confidence
                    'created_at': datetime.now().isoformat(),
                    'type': 'code',
                    'status': 'proposed'
                }
                improvements.append(improvement)
                
        return improvements
    
    def _calculate_privacy_impact(self, insights: List[Dict]) -> str:
        """Calculate privacy impact level from insights"""
        impact_scores = {
            'critical': 4,
            'high': 3,
            'medium': 2,
            'low': 1
        }
        
        total_score = 0
        for insight in insights:
            impact = insight.get('impact', 'medium')
            total_score += impact_scores.get(impact.lower(), 2)
            
        avg_score = total_score / len(insights) if insights else 2
        
        if avg_score > 3.5:
            return 'critical'
        elif avg_score > 2.5:
            return 'high'
        elif avg_score > 1.5:
            return 'medium'
        else:
            return 'low'
    
    async def get_available_improvements(self) -> List[Dict[str, Any]]:
        """
        Get available improvements
        
        Returns:
            List of available improvements
        """
        try:
            return await self.data_manager.get_available_improvements()
        except Exception as e:
            logger.error(f"Error getting available improvements: {e}")
            return []
    
    async def apply_improvements(self, improvements: List[Dict[str, Any]]) -> bool:
        """
        Apply multiple improvements
        
        Args:
            improvements: List of improvements to apply
            
        Returns:
            True if all improvements were applied successfully, False otherwise
        """
        success = True
        for improvement in improvements:
            result = await self.apply_improvement(improvement)
            if not result:
                success = False
                
        return success
    
    async def apply_improvement(self, improvement: Dict[str, Any]) -> bool:
        """
        Apply an improvement to the system
        
        Args:
            improvement: Improvement to apply
            
        Returns:
            True if successful, False otherwise
        """
        try:
            improvement_id = improvement.get('id')
            improvement_type = improvement.get('type')
            module = improvement.get('module')
            data = improvement.get('data', {})
            
            logger.info(f"Applying improvement {improvement_id} of type {improvement_type} to {module}")
            
            # Apply based on improvement type
            result = False
            if improvement_type == "parameter_update":
                result = await self._apply_parameter_update(module, data)
            elif improvement_type == "model_update":
                result = await self._apply_model_update(module, data)
            elif improvement_type == "code_update":
                result = await self._apply_code_update(module, data)
            elif improvement_type == "config_update":
                result = await self._apply_config_update(module, data)
            else:
                logger.warning(f"Unknown improvement type: {improvement_type}")
                return False
            
            if result:
                # Mark as applied
                await self.data_manager.mark_improvement_applied(improvement_id)
                
                # Update module version if provided
                version = improvement.get('version')
                if version:
                    await self.data_manager.update_module_version(module, version)
                
                # Track applied improvement
                self.improvements_applied += 1
                self.last_improvement = datetime.now()
                self.improvement_history.append({
                    "id": improvement_id,
                    "type": improvement_type,
                    "module": module,
                    "timestamp": self.last_improvement.isoformat()
                })
                
                # Emit event
                event = Event(
                    type=EventType.IMPROVEMENT_APPLIED,
                    payload={
                        "improvement_id": improvement_id,
                        "type": improvement_type,
                        "module": module
                    },
                    source="improvement_engine"
                )
                await self.event_bus.emit(event)
                
                logger.info(f"Successfully applied improvement {improvement_id}")
                return True
            else:
                logger.warning(f"Failed to apply improvement {improvement_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error applying improvement: {e}")
            return False
    
    async def _apply_parameter_update(self, module: str, data: Dict[str, Any]) -> bool:
        """
        Apply parameter update
        
        Args:
            module: Module to update
            data: Parameter data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get module
            module_parts = module.split('.')
            if len(module_parts) < 2:
                logger.error(f"Invalid module format: {module}")
                return False
                
            # Get the class/function and parameter
            module_path = '.'.join(module_parts[:-1])
            target_name = module_parts[-1]
            
            # Import module
            try:
                mod = importlib.import_module(module_path)
            except ImportError:
                logger.error(f"Could not import module: {module_path}")
                return False
                
            # Get target
            if not hasattr(mod, target_name):
                logger.error(f"Module {module_path} has no attribute {target_name}")
                return False
                
            target = getattr(mod, target_name)
            
            # Apply parameters
            parameters = data.get("parameters", {})
            for param_name, param_value in parameters.items():
                if hasattr(target, param_name):
                    setattr(target, param_name, param_value)
                    logger.info(f"Updated parameter {param_name} in {module}")
                else:
                    logger.warning(f"Parameter {param_name} not found in {module}")
            
            return True
        except Exception as e:
            logger.error(f"Error applying parameter update: {e}")
            return False
    
    async def _apply_model_update(self, module: str, data: Dict[str, Any]) -> bool:
        """
        Apply model update
        
        Args:
            module: Module to update
            data: Model data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # This would typically download and update a model file
            # For now, we'll just update the model configuration
            
            model_type = data.get("model_type")
            model_path = data.get("model_path")
            model_config = data.get("model_config", {})
            
            if not model_type or not model_config:
                logger.error("Missing model type or configuration")
                return False
                
            # Update model configuration
            config_key = f"models.{model_type}"
            self.config_manager.set_config(config_key, model_config)
            self.config_manager.save_config()
            
            logger.info(f"Updated model configuration for {model_type}")
            return True
        except Exception as e:
            logger.error(f"Error applying model update: {e}")
            return False
    
    async def _apply_code_update(self, module: str, data: Dict[str, Any]) -> bool:
        """
        Apply code update - this is a placeholder for CI/CD integration
        In a production system, this would be handled by the CI/CD pipeline
        
        Args:
            module: Module to update
            data: Code update data
            
        Returns:
            True if successful, False otherwise
        """
        # In a production system, code updates would be handled by the CI/CD pipeline
        # This is just a placeholder to show how it would integrate
        logger.info(f"Code update for {module} would be handled by CI/CD pipeline")
        
        # Instead of directly modifying code, we'll just log what would happen
        changes = data.get("changes", [])
        for change in changes:
            file_path = change.get("file")
            change_type = change.get("type")
            logger.info(f"Would {change_type} file {file_path}")
            
        return True
    
    async def _apply_config_update(self, module: str, data: Dict[str, Any]) -> bool:
        """
        Apply configuration update
        
        Args:
            module: Module to update
            data: Configuration data
            
        Returns:
            True if successful, False otherwise
        """
        try:
            config_updates = data.get("config", {})
            if not config_updates:
                logger.error("No configuration updates provided")
                return False
                
            # Update configuration
            for config_key, config_value in config_updates.items():
                self.config_manager.set_config(config_key, config_value)
                
            self.config_manager.save_config()
            
            logger.info(f"Updated configuration for {module}")
            return True
        except Exception as e:
            logger.error(f"Error applying configuration update: {e}")
            return False
            
    def get_status(self) -> Dict[str, Any]:
        """
        Get the status of the improvement engine
        
        Returns:
            Dictionary with status information
        """
        return {
            "improvements_applied": self.improvements_applied,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "last_improvement": self.last_improvement.isoformat() if self.last_improvement else None,
            "improvement_history": self.improvement_history[-10:] if self.improvement_history else []
        }
